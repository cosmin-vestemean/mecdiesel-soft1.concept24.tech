import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { getDefaultConfig } from './config.js';
import { SoftOneGateway } from './softone-client.js';

const server = new McpServer({
    name: 's1-api',
    version: '0.1.0'
});

const gateway = new SoftOneGateway(getDefaultConfig());

const primitiveArraySchema = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const primitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function buildToolResult(payload: unknown) {
    return { content: [{ text: JSON.stringify(payload, null, 2), type: 'text' as const }] };
}

function buildErrorResult(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ text: JSON.stringify({ error: message, success: false }, null, 2), type: 'text' as const }],
        isError: true
    };
}

function registerJsonTool(
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    handler: (input: Record<string, unknown>) => Promise<unknown>
) {
    server.registerTool(name, { description, inputSchema }, async (input: Record<string, unknown>) => {
        try {
            return buildToolResult(await handler(input));
        } catch (error) {
            return buildErrorResult(error);
        }
    });
}

const commonConnectionSchema = {
    appId: z.union([z.string(), z.number()]).optional().describe('SoftOne appId. Defaults to S1_APP_ID.'),
    baseUrl: z.string().url().optional().describe('Explicit URL override (bypasses env selection). Prefer using env instead.'),
    env: z.enum(['prod', 'test']).optional().describe('Target environment. "prod" uses S1_PROD_URL; "test" uses S1_TEST_URL. Defaults to S1_ENV (project .env), which itself defaults to "test".'),
    password: z.string().optional().describe('SoftOne web account password. Prefer the project .env (S1_WS_PASS) over inline usage.'),
    sessionName: z.string().default('default').describe('Logical session bucket. Automatically namespaced per env (prod:default vs test:default).'),
    username: z.string().optional().describe('SoftOne web account username. Prefer the project .env (S1_WS_USR) over inline usage.')
};

const authenticateSchema = {
    ...commonConnectionSchema,
    branch: z.union([z.string(), z.number()]).optional().describe('Branch ID returned by login.'),
    clientID: z.string().optional().describe('Temporary clientID returned by login. If omitted, the MCP reuses the stored login response.'),
    company: z.union([z.string(), z.number()]).optional().describe('Company ID returned by login.'),
    module: z.union([z.string(), z.number()]).optional().describe('Module/entity ID returned by login.'),
    refid: z.union([z.string(), z.number()]).optional().describe('RefID returned by login.')
};

registerJsonTool('s1_ping', 'Ping the SoftOne web service endpoint.', {
    baseUrl: z.string().url().optional().describe('Optional override for the SoftOne base URL.')
}, async input => gateway.ping(input));

registerJsonTool('s1_refresh', 'Trigger the SoftOne refresh endpoint.', {
    baseUrl: z.string().url().optional().describe('Optional override for the SoftOne base URL.')
}, async input => gateway.refresh(input));

registerJsonTool('s1_login', 'Login to SoftOne and cache the temporary clientID for a session.', commonConnectionSchema,
    async input => gateway.login(input));

registerJsonTool('s1_authenticate', 'Authenticate a previously logged-in SoftOne session and cache the access token.', authenticateSchema,
    async input => gateway.authenticate(input));

registerJsonTool('s1_get_objects', 'Return all SoftOne objects available for the current appId.', authenticateSchema,
    async input => gateway.getObjects(input));

registerJsonTool('s1_get_object_tables', 'Return all tables defined for a SoftOne object.', {
    ...authenticateSchema,
    object: z.string().describe('SoftOne object name, for example SALDOC.')
}, async input => gateway.getObjectTables(input as Parameters<SoftOneGateway['getObjectTables']>[0]));

registerJsonTool('s1_get_table_fields', 'Return all fields and properties for a SoftOne object table.', {
    ...authenticateSchema,
    object: z.string().describe('SoftOne object name, for example SALDOC.'),
    table: z.string().describe('Table alias or database table name, for example SALDOC.')
}, async input => gateway.getTableFields(input as Parameters<SoftOneGateway['getTableFields']>[0]));

registerJsonTool(
    's1_query_dataset',
    'Execute a READ-ONLY SQL query via GETSQLDATASET. Enforced in code (not just description): only SELECT/WITH, single statement. INSERT/UPDATE/DELETE are rejected — use s1_execute_sql_write.',
    {
        ...authenticateSchema,
        params: primitiveArraySchema.optional().describe('Positional SQL parameters used as :1, :2, :3 and so on.'),
        sql: z.string().describe('Read-only SQL query that starts with SELECT or WITH.'),
        sqlEndpointPath: z.string().optional().describe('Custom JS endpoint path. Defaults to S1_SQL_ENDPOINT_PATH.')
    },
    async input => gateway.queryDataset(input as Parameters<SoftOneGateway['queryDataset']>[0])
);

registerJsonTool(
    's1_execute_sql_write',
    [
        'Execute a single INSERT/UPDATE/DELETE statement via GETSQLDATASET.',
        'GATED: requires S1_WRITE_MODE=test|all in the project .env — fails closed ("off") otherwise.',
        'S1_WRITE_MODE=test additionally requires env="test" for this call.',
        'Defaults to a dry-run (commit=false) that reports the parsed verb without executing. Set commit=true to actually run it.',
        'DROP/TRUNCATE/ALTER/MERGE/EXEC/GRANT/etc. and multi-statement SQL are always rejected regardless of write mode.'
    ].join(' '),
    {
        ...authenticateSchema,
        commit: z.boolean().optional().default(false).describe('Set true to actually execute. false (default) only validates and reports.'),
        params: primitiveArraySchema.optional().describe('Positional SQL parameters used as :1, :2, :3 and so on.'),
        sql: z.string().describe('Single INSERT/UPDATE/DELETE statement.'),
        sqlEndpointPath: z.string().optional().describe('Custom JS endpoint path. Defaults to S1_SQL_ENDPOINT_PATH.')
    },
    async input => gateway.executeSqlWrite(input as Parameters<SoftOneGateway['executeSqlWrite']>[0])
);

const setDataBaseSchema = {
    ...authenticateSchema,
    commit: z.boolean().optional().default(false).describe('Set true to actually execute. false (default) only validates and reports.'),
    data: z.record(z.string(), z.array(z.record(z.string(), primitiveValueSchema)))
        .describe('Map of table name → array of row objects. Example: { "CUSTOMER": [{ "NAME": "Acme" }], "CUSBRANCH": [{ "LINENUM": 1 }, { "LINENUM": 9000001, "CODE": 111 }] }'),
    object: z.string().describe('SoftOne object name, for example CUSTOMER, SALDOC, SPCPRD.'),
    objectparams: z.record(z.string(), primitiveValueSchema).optional().describe('Optional object parameters, for example { "param1": 0 }.')
};

registerJsonTool(
    's1_insert',
    [
        'Insert a NEW SoftOne business object record (setData with no key).',
        'GATED: requires S1_WRITE_MODE=test|all in the project .env.',
        'For child table rows, use LINENUM >= 9000001.',
        'Defaults to a dry-run (commit=false). Set commit=true to actually run it.'
    ].join(' '),
    setDataBaseSchema,
    async input => gateway.setData(input as Parameters<SoftOneGateway['setData']>[0])
);

registerJsonTool(
    's1_update',
    [
        'Update an EXISTING SoftOne business object record (setData with key).',
        'GATED: requires S1_WRITE_MODE=test|all in the project .env.',
        'Child table rows: include LINENUM for rows to keep/update; omitting existing LINENUMs will DELETE those rows; LINENUM >= 9000001 adds a new child row.',
        'Defaults to a dry-run (commit=false). Set commit=true to actually run it.'
    ].join(' '),
    {
        ...setDataBaseSchema,
        key: z.union([z.string(), z.number()]).describe('Primary key of the record to update. Required — use s1_insert to create new records.')
    },
    async input => gateway.setData(input as Parameters<SoftOneGateway['setData']>[0])
);

registerJsonTool(
    's1_call_service',
    'Call any standard SoftOne read/metadata web service (getData, getBrowserInfo, getObjects, ...). clientID/appId are auto-injected. service="setData" is always blocked here — use s1_insert/s1_update instead.',
    {
        ...authenticateSchema,
        payload: z.record(z.string(), z.unknown()).optional().describe('Additional parameters for the service call (excluding clientID/appId).'),
        service: z.string().describe('SoftOne service name, e.g. getData, getBrowserInfo, getObjects.')
    },
    async input => gateway.callService(input as Parameters<SoftOneGateway['callService']>[0])
);

registerJsonTool(
    's1_call_js_endpoint',
    'Call a deployed SoftOne Advanced JavaScript endpoint (e.g. /JS/pnl/Ping). Not SQL-guarded — only call known, trusted endpoints.',
    {
        ...authenticateSchema,
        path: z.string().describe('Endpoint path, e.g. /JS/pnl/Ping or /JS/pnl/BatchRefinalize'),
        payload: z.record(z.string(), z.unknown()).optional().describe('Request body for the endpoint (excluding clientID/appId).')
    },
    async input => gateway.callJsEndpoint(input as Parameters<SoftOneGateway['callJsEndpoint']>[0])
);

registerJsonTool(
    's1_deploy_ajs_script',
    [
        'Deploy a local Advanced JavaScript file into SoftOne CSTINFO (CSTTYPE=16, CSTINFO=0).',
        'Dry-run (commit=false) is the default and only reports the target row.',
        'commit=true is GATED: requires S1_WRITE_MODE=test|all in the project .env.'
    ].join(' '),
    {
        ...authenticateSchema,
        commit: z.boolean().optional().default(false).describe('When false, only validates and reports the target row. Set true to update CSTINFO.SODATA.'),
        filePath: z.string().describe('Local JS file to deploy. Relative paths are resolved from the MCP server working directory.'),
        scriptName: z.string().describe('CSTNAME to update. Only letters, numbers, underscore and dash are allowed.'),
        updatedBy: z.string().describe('Value written to UPDUSERNAME when commit=true.')
    },
    async input => gateway.deployAjsScript(input as Parameters<SoftOneGateway['deployAjsScript']>[0])
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
