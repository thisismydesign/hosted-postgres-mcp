import { z } from "zod";
import pg from "pg";
import { getCurrentUser } from "../auth.js";

const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA || "public";
const STATEMENT_TIMEOUT_SECONDS = process.env.STATEMENT_TIMEOUT_SECONDS || "5";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType> | {};
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

export const listTables: ToolDefinition = {
  name: "list_tables",
  description: "List all tables",
  inputSchema: {},
  handler: async ({ databaseUrl }) => {
    const client = new pg.Client({ connectionString: databaseUrl as string });
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
  },
};

export const describeTable: ToolDefinition = {
  name: "describe_table",
  description: "Get column names and types for a table",
  inputSchema: {
    table_name: z.string().describe("Name of the table to describe"),
  },
  handler: async ({ table_name, databaseUrl }) => {
    const client = new pg.Client({ connectionString: databaseUrl as string });
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
  },
};

export const describeTables: ToolDefinition = {
  name: "describe_tables",
  description: "Get column names and types for all tables",
  inputSchema: {},
  handler: async ({ databaseUrl }) => {
    const client = new pg.Client({ connectionString: databaseUrl as string });
    try {
      await client.connect();
      const result = await client.query(
        "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position",
        [DATABASE_SCHEMA]
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
  },
};

export const describeIndexes: ToolDefinition = {
  name: "describe_indexes",
  description: "Get indexes for a table",
  inputSchema: {
    table_name: z.string().describe("Name of the table to get indexes for"),
  },
  handler: async ({ table_name, databaseUrl }) => {
    const client = new pg.Client({ connectionString: databaseUrl as string });
    try {
      await client.connect();
      const result = await client.query(
        `SELECT
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = $1 AND n.nspname = $2
        ORDER BY i.relname, a.attnum`,
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
  },
};

export const query: ToolDefinition = {
  name: "query",
  description: "Run a read-only SQL query",
  inputSchema: {
    sql: z.string().describe("SQL query to execute (read-only)"),
    intent: z.string().describe("Description of what the user wanted to achieve with this query"),
  },
  handler: async ({ sql, intent, databaseUrl }) => {
    // Block multiple statements to prevent transaction escape attacks
    // This is crude and may produce false positives, but better than nothing
    if ((sql as string).includes(';')) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Multiple statements not allowed",
          },
        ],
        isError: true,
      };
    }

    const user = getCurrentUser();
    console.log(`[query] user="${user}" intent="${intent}" sql="${sql}"`);

    const client = new pg.Client({ connectionString: databaseUrl as string });
    try {
      await client.connect();
      await client.query(`SET statement_timeout = '${STATEMENT_TIMEOUT_SECONDS}s'`);
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql as string);
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
  },
};
