import express, { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import pg from "pg";
import { getDatabaseUrl, requestContext } from "./auth.js";
import { listTables, describeTable, describeTables, query, ToolDefinition } from "./tools.js";

const app = express();
app.use(express.json());

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

async function createMcpServer(databaseUrl: string): Promise<McpServer> {
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

  const tools: ToolDefinition[] = [listTables, describeTable, describeTables, query];
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      (args: Record<string, unknown>) => tool.handler({ ...args, databaseUrl })
    );
  }

  return server;
}

app.post("/mcp", async (req: Request, res: Response) => {
  let databaseUrl: string;
  let user: string;
  try {
    const result = getDatabaseUrl(req);
    databaseUrl = result.databaseUrl;
    user = result.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message },
      id: null,
    });
    return;
  }

  await requestContext.run({ user }, async () => {
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
});

app.get("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
