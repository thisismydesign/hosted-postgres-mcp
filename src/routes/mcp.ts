import { Router, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getDatabaseUrl, requestContext } from "../auth.js";
import { createMcpServer } from "../mcp/server.js";

export const mcpRouter = Router();

mcpRouter.post("/mcp", async (req: Request, res: Response) => {
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

mcpRouter.get("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});
