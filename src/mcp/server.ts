import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pg from "pg";
import { listTables, describeTable, describeTables, query, ToolDefinition } from "../tools.js";

export async function createMcpServer(databaseUrl: string): Promise<McpServer> {
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
