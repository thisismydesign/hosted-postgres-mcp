import express, { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Create and configure MCP server
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "hosted-postgres-mcp",
    version: "1.0.0",
  });

  // Register a simple tool that returns a random number
  server.registerTool(
    "random_number",
    {
      description: "Returns a random number between min and max",
      inputSchema: {
        min: z.number().default(0).describe("Minimum value (default 0)"),
        max: z.number().default(100).describe("Maximum value (default 100)"),
      },
    },
    async ({ min, max }) => {
      const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
      return {
        content: [
          {
            type: "text" as const,
            text: `Random number: ${randomNumber}`,
          },
        ],
      };
    }
  );

  return server;
}

// MCP POST endpoint - stateless mode
app.post("/mcp", async (req: Request, res: Response) => {
  const server = createMcpServer();
  try {
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
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
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

