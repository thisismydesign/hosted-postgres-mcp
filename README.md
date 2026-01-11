# Hosted Postgres MCP Server

Remote MCP server for querying PostgreSQL databases via Streamable HTTP transport.

## Usage

### Connect via MCP Inspector

1. Start server: `npm run dev`
2. Run inspector: `npx @modelcontextprotocol/inspector`
3. Select **Streamable HTTP** transport
4. Enter URL: `http://localhost:3000/mcp`
5. Authenticate:
   - Via DB URL. Header: `x-database-url: postgresql://user:pass@localhost:5432/mydb` or `DATABASE_URL` env var.
   - Via DB credentials. Headers: `x-database-host`, `x-database-port`, `x-database-name`, `x-database-user`, `x-database-password` or `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` env vars.
   - Via Bearer token: `Authorization: Bearer <token>`. Set `AUTH_TOKENS` env var to contain a JSON of tokens and urls: `AUTH_TOKENS={"token1":"postgres://...","token2":"postgres://..."}`.

### Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DATABASE_SCHEMA` | PostgreSQL schema to use | `public` |
| `STATEMENT_TIMEOUT_SECONDS` | Query timeout in seconds | `5` |

### Tools

- `list_tables` - List all tables
- `describe_table` - Get column names and types for a table
- `describe_tables` - Get column names and types for all tables
- `query` - Run a read-only SQL query

## Development

```bash
npm install
npm run dev
```

## Endpoints

- `POST /mcp` - MCP streamable HTTP endpoint
- `GET /health` - Health check
