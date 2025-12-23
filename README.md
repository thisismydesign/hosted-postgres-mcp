# Hosted Postgres MCP Server

Remote MCP server for querying PostgreSQL databases via Streamable HTTP transport.

## Usage

### Connect via MCP Inspector

1. Start server: `npm run dev`
2. Run inspector: `npx @modelcontextprotocol/inspector`
3. Select **Streamable HTTP** transport
4. Enter URL: `http://localhost:3000/mcp`
5. Add header: `X-Database-Url: postgresql://user:pass@localhost:5432/mydb`

### Tools

- `list_tables` - List all tables in public schema
- `describe_table` - Get columns and types for a table
- `query` - Run read-only SQL queries

## Development

```bash
npm install
npm run dev
```

## Endpoints

- `POST /mcp` - MCP streamable HTTP endpoint
- `GET /health` - Health check
