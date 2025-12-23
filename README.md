# Hosted Postgres MCP Server

MCP server with Streamable HTTP transport, ready for remote deployment.

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Endpoints

- `POST /mcp` - MCP streamable HTTP endpoint
- `GET /health` - Health check

## Deploy to Railway

1. Push to GitHub
2. Connect repo to [Railway](https://railway.app)
3. Deploy - it auto-detects Node.js

Your MCP URL will be: `https://your-app.railway.app/mcp`

