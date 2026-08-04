/**
 * SoftOne MEC - MCP Server
 *
 * Exposes SoftOne S1 database and schema capabilities as MCP tools:
 *
 * Connection & Auth (Section C – Methods/API Calls):
 *   - s1_ping            : ping the SoftOne API (GET)
 *   - s1_refresh         : restart/refresh the SoftOne API (GET)
 *   - s1_login           : login and list available company/branch/module/user options
 *   - s1_authenticate    : authenticate with a specific company/branch/module/refid
 *
 * Data & Schema:
 *   - s1_sql_query       : execute a T-SQL query via getSqlDataset (AJS)
 *   - s1_get_objects     : list all SoftOne objects (EditMaster / EditList)
 *   - s1_get_object_tables : list tables of a SoftOne object
 *   - s1_get_table_fields  : list fields of a table in a SoftOne object
 *
 * Environment variables:
 *   S1_BASE_URL   (default: https://mecdiesel.oncloud.gr/s1services)
 *   S1_USERNAME   (default: mecws)
 *   S1_PASSWORD   (required)
 *   S1_APP_ID     (default: 2002)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const S1_BASE_URL =
  process.env.S1_BASE_URL ?? "https://mecdiesel.oncloud.gr/s1services";
const S1_USERNAME = process.env.S1_USERNAME ?? "mecws";
const S1_PASSWORD = process.env.S1_PASSWORD;
const S1_APP_ID = process.env.S1_APP_ID ?? "2002";

if (!S1_PASSWORD) {
  process.stderr.write(
    "[softone-mec-mcp] ERROR: S1_PASSWORD environment variable is required.\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

let clientID = null;

/**
 * GET to the main S1 services endpoint (ping, refresh).
 * Returns the raw text response.
 */
async function getMain(queryParam) {
  const url = `${S1_BASE_URL}?${queryParam}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`S1 HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * POST to the main S1 services endpoint (service calls: login, getObjects, etc.)
 */
async function postMain(body) {
  const res = await fetch(S1_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`S1 HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * POST to a specific AJS endpoint (e.g. /JS/Utile/getSqlDataset)
 */
async function postAJS(path, body) {
  const url = `${S1_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`S1 HTTP ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

async function login() {
  process.stderr.write("[softone-mec-mcp] Authenticating with SoftOne...\n");
  const result = await postMain({
    service: "login",
    username: S1_USERNAME,
    password: S1_PASSWORD,
    appId: S1_APP_ID,
  });
  if (!result.success) {
    throw new Error(`S1 login failed: ${result.error ?? "unknown error"}`);
  }
  clientID = result.clientID;
  process.stderr.write("[softone-mec-mcp] Authenticated OK.\n");
}

/** Ensure we have a valid session; re-login if needed. */
async function ensureSession() {
  if (!clientID) await login();
  return clientID;
}

/**
 * Execute fn(clientID) with automatic re-authentication on session expiry.
 * fn must return the S1 API response object.
 */
async function withSession(fn) {
  await ensureSession();
  const result = await fn(clientID);

  // S1 returns success:false with an auth-related message when session expires
  if (
    result &&
    result.success === false &&
    typeof result.error === "string" &&
    /session|clientid|unauthorized/i.test(result.error)
  ) {
    process.stderr.write("[softone-mec-mcp] Session expired, re-authenticating...\n");
    clientID = null;
    await ensureSession();
    return fn(clientID);
  }

  return result;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "softone-mec",
  version: "1.0.0",
});

// ── Tool 1: s1_ping ─────────────────────────────────────────────────────────

server.tool(
  "s1_ping",
  [
    "Pings the SoftOne API to verify it is reachable and functioning.",
    "Uses the GET ?ping endpoint.",
    "Returns the raw text response from the server.",
  ].join(" "),
  {},
  async () => {
    try {
      const text = await getMain("ping");
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool 2: s1_refresh ──────────────────────────────────────────────────────

server.tool(
  "s1_refresh",
  [
    "Restarts and refreshes the SoftOne API for the configured URL.",
    "Use when web application parameters have been changed in SoftOne and immediate effect is needed.",
    "Returns OK when completed.",
  ].join(" "),
  {},
  async () => {
    try {
      const text = await getMain("refresh");
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool 3: s1_login ────────────────────────────────────────────────────────

server.tool(
  "s1_login",
  [
    "Logs in to SoftOne and returns the available company/branch/module/user options (objs array).",
    "Uses the configured username and password. An optional appId overrides the default.",
    "Returns clientID, objs[], ver, sn.",
    "Useful for discovering which COMPANY, BRANCH, MODULE, REFID values are available before authenticating.",
  ].join(" "),
  {
    appId: z
      .string()
      .optional()
      .describe("Override the default appId (default: configured S1_APP_ID)"),
  },
  async ({ appId }) => {
    try {
      const result = await postMain({
        service: "login",
        username: S1_USERNAME,
        password: S1_PASSWORD,
        appId: appId ?? S1_APP_ID,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool 4: s1_authenticate ─────────────────────────────────────────────────

server.tool(
  "s1_authenticate",
  [
    "Authenticates with SoftOne using a specific company, branch, module, and refid.",
    "First call s1_login to discover valid combinations.",
    "Returns the authenticated clientID that can be used in subsequent tool calls.",
    "Also updates the internal session so all other tools use this new context.",
  ].join(" "),
  {
    loginClientId: z
      .string()
      .describe("The temporary clientID obtained from s1_login."),
    company: z
      .string()
      .describe("Company ID obtained from s1_login objs (e.g. '1000')."),
    branch: z
      .string()
      .describe("Branch ID obtained from s1_login objs (e.g. '1000')."),
    module: z
      .string()
      .default("0")
      .describe("Module ID obtained from s1_login objs. Defaults to '0'."),
    refid: z
      .string()
      .describe("RefID obtained from s1_login objs."),
  },
  async ({ loginClientId, company, branch, module, refid }) => {
    try {
      const result = await postMain({
        service: "authenticate",
        clientID: loginClientId,
        company,
        branch,
        module,
        refid,
      });
      if (result.success && result.clientID) {
        // Update internal session so subsequent tools use this authenticated context
        clientID = result.clientID;
        process.stderr.write(
          `[softone-mec-mcp] Session updated via s1_authenticate (company=${company}, branch=${branch}, refid=${refid}).\n`
        );
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool 5: s1_sql_query ────────────────────────────────────────────────────

server.tool(
  "s1_sql_query",
  [
    "Execute a T-SQL SELECT query against the SoftOne (S1) database.",
    "Uses the getSqlDataset AJS function (Utile.js) which runs via X.GETSQLDATASET.",
    "Returns { totalcount, rows[] } on success.",
    "Useful for exploring data, verifying field values, or correlating records.",
  ].join(" "),
  {
    sql: z
      .string()
      .describe(
        "Complete T-SQL query to execute. Only SELECT queries are recommended. No parameters — embed values directly in the query string."
      ),
  },
  async ({ sql }) => {
    const result = await withSession((cid) =>
      postAJS("/JS/Utile/getSqlDataset", {
        clientID: cid,
        appId: S1_APP_ID,
        SQL: sql,
      })
    );

    // Note: the AJS function uses 'succes' (typo) for the success flag
    if (!result.succes) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${result.message ?? "getSqlDataset returned succes=false"}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { totalcount: result.totalcount, rows: result.rows },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool 6: s1_get_objects ──────────────────────────────────────────────────

server.tool(
  "s1_get_objects",
  [
    "Returns all SoftOne objects (EditMaster and EditList) available in the application.",
    "Each object has: name, type (EditMaster|EditList), caption.",
    "Useful for discovering what objects exist before querying tables or fields.",
  ].join(" "),
  {},
  async () => {
    const result = await withSession((cid) =>
      postMain({ service: "getObjects", clientID: cid, appId: S1_APP_ID })
    );

    if (!result.success) {
      return {
        content: [
          { type: "text", text: `Error: ${result.error ?? "getObjects failed"}` },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { count: result.count, objects: result.objects },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool 7: s1_get_object_tables ────────────────────────────────────────────

server.tool(
  "s1_get_object_tables",
  [
    "Returns all tables defined in a SoftOne EditMaster object.",
    "Each table has: name (alias), dbname (actual DB table), caption, filltype.",
    "Use this before s1_get_table_fields to discover available tables.",
  ].join(" "),
  {
    object: z
      .string()
      .describe(
        "SoftOne object name (EditMaster), e.g. SALDOC, CUSTOMER, ITEM, PURCHDOC"
      ),
  },
  async ({ object }) => {
    const result = await withSession((cid) =>
      postMain({
        service: "getObjectTables",
        clientID: cid,
        appId: S1_APP_ID,
        object,
      })
    );

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${result.error ?? "getObjectTables failed"}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { count: result.count, tables: result.tables },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool 8: s1_get_table_fields ─────────────────────────────────────────────

server.tool(
  "s1_get_table_fields",
  [
    "Returns the fields and their properties for a specific table within a SoftOne object.",
    "Each field includes: name, alias, fullname, caption, size, type, edittype,",
    "defaultvalue, decimals, readOnly, visible, required, calculated.",
    "Use this to understand the schema before writing SQL queries.",
  ].join(" "),
  {
    object: z
      .string()
      .describe("SoftOne object name (EditMaster), e.g. SALDOC, CUSTOMER"),
    table: z
      .string()
      .describe(
        "Table alias or DB name within the object, e.g. SALDOC, ITELINES, MTRDOC"
      ),
  },
  async ({ object, table }) => {
    const result = await withSession((cid) =>
      postMain({
        service: "getTableFields",
        clientID: cid,
        appId: S1_APP_ID,
        object,
        table,
      })
    );

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${result.error ?? "getTableFields failed"}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { count: result.count, fields: result.fields },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
