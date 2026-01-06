import express, { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import pg from "pg";
import { getDatabaseUrl } from "./auth.js";

const app = express();
app.use(express.json());

const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA || "public";

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, X-Database-Url, X-Database-User, X-Database-Password, X-Database-Host, X-Database-Port, X-Database-Name, X-Custom-Auth-Headers"
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Create and configure MCP server with database URL
async function createMcpServer(databaseUrl: string): Promise<McpServer> {
  // Test database connection
  const testClient = new pg.Client({ connectionString: databaseUrl });
  try {
    await testClient.connect();
    await testClient.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Database connection failed: ${message}`);
  }

  const server = new McpServer({
    name: "hosted-postgres-mcp",
    version: "1.0.0",
  });

  // Tool: List all tables in the database
  server.registerTool(
    "list_tables",
    {
      description: `List all tables in the ${DATABASE_SCHEMA} schema`,
      inputSchema: {},
    },
    async () => {
      const client = new pg.Client({ connectionString: databaseUrl });
      try {
        await client.connect();
        const result = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
          [DATABASE_SCHEMA]
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.rows.map((r) => r.table_name), null, 2),
            },
          ],
        };
      } finally {
        await client.end();
      }
    }
  );

  // Tool: Get schema for a specific table
  server.registerTool(
    "describe_table",
    {
      description: "Get column names and types for a table",
      inputSchema: {
        table_name: z.string().describe("Name of the table to describe"),
      },
    },
    async ({ table_name }) => {
      const client = new pg.Client({ connectionString: databaseUrl });
      try {
        await client.connect();
        const result = await client.query(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 AND table_schema = $2 ORDER BY ordinal_position",
          [table_name, DATABASE_SCHEMA]
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      } finally {
        await client.end();
      }
    }
  );

  // Tool: Run a read-only SQL query
  server.registerTool(
    "query",
    {
      description: "Run a read-only SQL query",
      inputSchema: {
        sql: z.string().describe("SQL query to execute (read-only)"),
      },
    },
    async ({ sql }) => {
      const client = new pg.Client({ connectionString: databaseUrl });
      try {
        await client.connect();
        await client.query("BEGIN TRANSACTION READ ONLY");
        const result = await client.query(sql);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      } finally {
        await client.query("ROLLBACK").catch(() => {});
        await client.end();
      }
    }
  );

  return server;
}

// MCP POST endpoint - stateless mode
app.post("/mcp", async (req: Request, res: Response) => {
  let databaseUrl: string;
  try {
    databaseUrl = getDatabaseUrl(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message },
      id: null,
    });
    return;
  }

  try {
    const server = await createMcpServer(databaseUrl);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      });
    }
  }
});

// Handle unsupported methods
app.get("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
