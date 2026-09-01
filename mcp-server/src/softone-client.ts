import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { logWriteAudit } from './audit-log.js';
import { soft1DataHeader, soft1ScriptPayload, sqlString, sqlVarBinaryMax } from './ajs-binary.js';
import { classifySql, isReadVerb, isWriteVerb } from './sql-guard.js';
import { mergeRuntimeConfig, type S1RuntimeConfig } from './config.js';

type Primitive = boolean | null | number | string;

type BaseOptions = {
    appId?: number | string;
    baseUrl?: string;
    branch?: number | string;
    clientID?: string;
    company?: number | string;
    env?: 'prod' | 'test';
    module?: number | string;
    password?: string;
    refid?: number | string;
    sessionName?: string;
    sqlEndpointPath?: string;
    username?: string;
};

export type SqlDatasetOptions = BaseOptions & {
    params?: Primitive[];
    sql: string;
};

export type SqlWriteOptions = SqlDatasetOptions & {
    commit?: boolean;
};

export type SetDataOptions = BaseOptions & {
    commit?: boolean;
    data: Record<string, Array<Record<string, Primitive>>>;
    key?: number | string;
    object: string;
    objectparams?: Record<string, Primitive>;
};

export type GetObjectTablesOptions = BaseOptions & {
    object: string;
};

export type GetTableFieldsOptions = BaseOptions & {
    object: string;
    table: string;
};

export type CallServiceOptions = BaseOptions & {
    payload?: Record<string, unknown>;
    service: string;
};

export type CallJsEndpointOptions = BaseOptions & {
    path: string;
    payload?: Record<string, unknown>;
};

export type DeployAjsScriptOptions = BaseOptions & {
    commit?: boolean;
    filePath: string;
    scriptName: string;
    updatedBy: string;
};

type LoginPermission = {
    BRANCH?: number | string;
    BRANCHNAME?: string;
    COMPANY?: number | string;
    COMPANYNAME?: string;
    MODULE?: number | string;
    MODULENAME?: string;
    REFID?: number | string;
    REFIDNAME?: string;
    [key: string]: unknown;
};

type LoginResponse = {
    clientID?: string;
    objs?: LoginPermission[];
    success?: boolean;
    [key: string]: unknown;
};

type AuthSelection = {
    branch: string;
    company: string;
    module: string;
    refid: string;
};

type SessionState = {
    authenticatedClientId?: string;
    login?: LoginResponse;
};

function asNonEmptyString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
}

function ensureSuccess(action: string, response: Record<string, unknown>): Record<string, unknown> {
    if (response.success === true) {
        return response;
    }
    const errorCode = response.errorcode ?? 'unknown';
    const errorMessage = asNonEmptyString(response.error) || asNonEmptyString(response.message) || 'Unknown SoftOne error';
    throw new Error(`${action} failed (${errorCode}): ${errorMessage}`);
}

function toSelection(permission?: LoginPermission): AuthSelection {
    return {
        branch: asNonEmptyString(permission && permission.BRANCH) || '',
        company: asNonEmptyString(permission && permission.COMPANY) || '',
        module: asNonEmptyString(permission && permission.MODULE) || '',
        refid: asNonEmptyString(permission && permission.REFID) || ''
    };
}

function buildUrl(baseUrl: string, suffix: string): string {
    if (!suffix) {
        return baseUrl;
    }
    if (suffix.charAt(0) === '?') {
        return `${baseUrl}${suffix}`;
    }
    return `${baseUrl}${suffix.charAt(0) === '/' ? suffix : `/${suffix}`}`;
}

export class SoftOneGateway {
    private readonly sessions = new Map<string, SessionState>();

    public constructor(private readonly baseConfig: S1RuntimeConfig) {}

    public async ping(options: Pick<BaseOptions, 'baseUrl'> = {}): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const responseText = await this.fetchText(buildUrl(config.baseUrl, '?ping'), { method: 'GET' });
        return { baseUrl: config.baseUrl, response: responseText, success: true };
    }

    public async refresh(options: Pick<BaseOptions, 'baseUrl'> = {}): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const responseText = await this.fetchText(buildUrl(config.baseUrl, '?refresh'), { method: 'GET' });
        return { baseUrl: config.baseUrl, response: responseText, success: true };
    }

    public async login(options: BaseOptions = {}): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const username = asNonEmptyString(options.username) || config.username;
        const password = asNonEmptyString(options.password) || config.password;
        const appId = asNonEmptyString(options.appId) || config.appId;
        const sessionName = this.getSessionName(options.sessionName, options.env);

        if (!username || !password || !appId) {
            throw new Error('Missing login configuration. Set S1_WS_USR, S1_WS_PASS, S1_APP_ID in the project .env or pass them as tool arguments.');
        }

        const response = ensureSuccess('login', await this.postJson(config.baseUrl, {
            appId, password, service: 'login', username
        }));

        const state = this.getSessionState(sessionName);
        state.authenticatedClientId = undefined;
        state.login = response as LoginResponse;

        return {
            availableSelections: Array.isArray((response as LoginResponse).objs) ? (response as LoginResponse).objs : [],
            response,
            sessionName,
            success: true
        };
    }

    public async authenticate(options: BaseOptions = {}): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const sessionName = this.getSessionName(options.sessionName, options.env);
        const state = this.getSessionState(sessionName);
        const loginResponse = state.login || await this.ensureLogin(options);
        const tempClientId = asNonEmptyString(options.clientID) || asNonEmptyString(loginResponse.clientID);

        if (!tempClientId) {
            throw new Error('No temporary clientID available. Call s1_login first or pass clientID explicitly.');
        }

        const selection = this.resolveSelection(loginResponse, config, options);
        const response = ensureSuccess('authenticate', await this.postJson(config.baseUrl, {
            branch: selection.branch,
            clientID: tempClientId,
            company: selection.company,
            module: selection.module,
            refid: selection.refid,
            service: 'authenticate'
        }));

        state.authenticatedClientId = asNonEmptyString(response.clientID) || tempClientId;

        return { response, selectedPermission: selection, sessionName, success: true };
    }

    public async getObjects(options: BaseOptions = {}): Promise<Record<string, unknown>> {
        return this.callAuthenticatedService('getObjects', {}, options);
    }

    public async getObjectTables(options: GetObjectTablesOptions): Promise<Record<string, unknown>> {
        const objectName = asNonEmptyString(options.object);
        if (!objectName) {
            throw new Error('object is required');
        }
        return this.callAuthenticatedService('getObjectTables', { object: objectName }, options);
    }

    public async getTableFields(options: GetTableFieldsOptions): Promise<Record<string, unknown>> {
        const objectName = asNonEmptyString(options.object);
        const tableName = asNonEmptyString(options.table);
        if (!objectName) {
            throw new Error('object is required');
        }
        if (!tableName) {
            throw new Error('table is required');
        }
        return this.callAuthenticatedService('getTableFields', { object: objectName, table: tableName }, options);
    }

    /** Read-only, enforced in code: rejects anything whose leading verb isn't SELECT/WITH. */
    public async queryDataset(options: SqlDatasetOptions): Promise<Record<string, unknown>> {
        const classification = classifySql(options.sql);
        if (!classification.ok || !isReadVerb(classification.verb)) {
            throw new Error(
                `s1_query_dataset only accepts SELECT/WITH statements. ${classification.reason || `Got verb ${classification.verb}.`} ` +
                'Use s1_execute_sql_write for INSERT/UPDATE/DELETE — it requires S1_WRITE_MODE to be enabled.'
            );
        }
        return this.executeRawSql(options);
    }

    /** Gated: requires S1_WRITE_MODE != "off"; INSERT/UPDATE/DELETE only, single statement. */
    public async executeSqlWrite(options: SqlWriteOptions): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const classification = classifySql(options.sql);

        if (!classification.ok) {
            throw new Error(`SQL rejected: ${classification.reason}`);
        }
        if (!isWriteVerb(classification.verb)) {
            throw new Error(`s1_execute_sql_write only accepts INSERT/UPDATE/DELETE. Got ${classification.verb}. Use s1_query_dataset for SELECT/WITH.`);
        }

        const effectiveEnv = options.env || config.defaultEnv;
        this.assertWriteAllowed(config, effectiveEnv);

        if (options.commit !== true) {
            return { commit: false, dryRun: true, note: 'Set commit=true to actually execute this write.', sql: options.sql, verb: classification.verb };
        }

        logWriteAudit({ env: effectiveEnv, tool: 's1_execute_sql_write', verb: classification.verb });
        return this.executeRawSql(options);
    }

    /** Gated: setData with no key = insert, with key = update. Requires S1_WRITE_MODE != "off". */
    public async setData(options: SetDataOptions): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const effectiveEnv = options.env || config.defaultEnv;
        this.assertWriteAllowed(config, effectiveEnv);

        const object = asNonEmptyString(options.object);
        if (!object) {
            throw new Error('object is required (e.g. CUSTOMER, SALDOC, SPCPRD).');
        }
        if (!options.data || typeof options.data !== 'object') {
            throw new Error('data is required — an object mapping table names to arrays of row objects.');
        }

        const toolName = options.key !== undefined ? 's1_update' : 's1_insert';
        if (options.commit !== true) {
            return { commit: false, dryRun: true, key: options.key, note: 'Set commit=true to actually execute this write.', object };
        }

        const sessionName = this.getSessionName(options.sessionName, options.env);
        const appId = asNonEmptyString(options.appId) || config.appId;
        const clientId = await this.ensureAuthenticatedClientId(options, config);

        const body: Record<string, unknown> = { appId, clientID: clientId, data: options.data, object, service: 'setData' };
        if (options.key !== undefined) {
            body.key = options.key;
        }
        if (options.objectparams !== undefined) {
            body.objectparams = options.objectparams;
        }

        logWriteAudit({ env: effectiveEnv, key: options.key, object, tool: toolName });
        const response = ensureSuccess('setData', await this.postJson(config.baseUrl, body));

        return { env: effectiveEnv, id: response.id, response, sessionName, success: true };
    }

    /** Generic passthrough for read/metadata services (getData, getBrowserInfo, ...). setData is
     * hard-blocked here so this can never become a bypass of the s1_insert/s1_update write gate. */
    public async callService(options: CallServiceOptions): Promise<Record<string, unknown>> {
        const service = asNonEmptyString(options.service);
        if (!service) {
            throw new Error('service is required');
        }
        if (service.toLowerCase() === 'setdata') {
            throw new Error('service="setData" is blocked on s1_call_service. Use s1_insert / s1_update, which apply the S1_WRITE_MODE gate and audit logging.');
        }
        return this.callAuthenticatedService(service, options.payload || {}, options);
    }

    /** Generic passthrough to a deployed custom AJS endpoint (e.g. /JS/pnl/Ping). Not SQL-guarded —
     * whatever the endpoint itself does is the endpoint author's responsibility. Paths under
     * S1_CUSTOM_WS_PREFIX get S1_WS_SHARED_SECRET auto-injected as authKey (some projects gate
     * their own custom /JS/WS/* endpoints on a shared secret, independent of the S1 session). */
    public async callJsEndpoint(options: CallJsEndpointOptions): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const clientId = await this.ensureAuthenticatedClientId(options, config);
        const appId = asNonEmptyString(options.appId) || config.appId;
        const path = asNonEmptyString(options.path);

        if (!path) {
            throw new Error('path is required, e.g. /JS/pnl/Ping');
        }

        const response = await this.postJson(buildUrl(config.baseUrl, path),
            this.withCustomWsAuthKey(path, config, { appId, clientID: clientId, ...(options.payload || {}) }));

        return { response, success: true };
    }

    /** Gated on commit=true: requires S1_WRITE_MODE != "off". Dry-run (commit=false, default) only
     * reports the target CSTINFO row and never touches data. Ported from Pet-Factory-ABC. */
    public async deployAjsScript(options: DeployAjsScriptOptions): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);

        if (!/^[A-Za-z0-9_-]+$/.test(options.scriptName)) {
            throw new Error('scriptName may contain only letters, numbers, underscore and dash');
        }

        const effectiveEnv = options.env || config.defaultEnv;
        if (options.commit === true) {
            this.assertWriteAllowed(config, effectiveEnv);
        }

        const { resolve } = await import('node:path');
        const absolutePath = resolve(options.filePath);
        const source = await readFile(absolutePath, 'utf8');
        const sourceBytes = Buffer.from(source, 'utf8');
        const storedPayloadBytes = soft1ScriptPayload(sourceBytes);
        const headerBytes = soft1DataHeader(storedPayloadBytes.length);
        const sha256 = createHash('sha256').update(source, 'utf8').digest('hex');
        const targetName = sqlString(options.scriptName, 128);
        const userName = sqlString(options.updatedBy, 128);
        const sourceLiteral = sqlVarBinaryMax(storedPayloadBytes);
        const headerLiteral = sqlVarBinaryMax(headerBytes);

        const sql = options.commit === true
            ? `SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN; ` +
              `DECLARE @current VARBINARY(MAX), @prefix VARBINARY(MAX), @payload VARBINARY(MAX), @header VARBINARY(MAX), @text VARCHAR(MAX), @dataPos INT, @beforeLen INT, @afterLen INT; ` +
              `SET @payload = ${sourceLiteral}; ` +
              `SET @header = ${headerLiteral}; ` +
              `SELECT @current = CONVERT(VARBINARY(MAX), SODATA) FROM CSTINFO WHERE CSTTYPE=16 AND CSTNAME=${targetName} AND CSTINFO=0; ` +
              `IF @current IS NULL THROW 51000, 'CSTINFO target row not found', 1; ` +
              `SET @text = CAST(@current AS VARCHAR(MAX)); ` +
              `SET @dataPos = CHARINDEX('Data' + CHAR(10), @text); ` +
              `IF @dataPos <= 0 THROW 51000, 'Could not locate Soft1 Data marker in existing SODATA', 1; ` +
              `SET @prefix = SUBSTRING(@current, 1, @dataPos + 4) + @header; ` +
              `SET @beforeLen = DATALENGTH(@current); ` +
              `UPDATE CSTINFO SET SOTYPE=878, SODEFAULT=0, NAME=${targetName}, SODATA=@prefix + @payload, UPDUSERNAME=${userName}, SOUPDDATE=GETDATE(), CSTGEN=N'', SOQV=0 ` +
              `WHERE CSTTYPE=16 AND CSTNAME=${targetName} AND CSTINFO=0; ` +
              `IF @@ROWCOUNT <> 1 THROW 51000, 'Expected exactly one CSTINFO row to update', 1; ` +
              `SELECT @afterLen = DATALENGTH(SODATA) FROM CSTINFO WHERE CSTTYPE=16 AND CSTNAME=${targetName} AND CSTINFO=0; ` +
              `COMMIT TRAN; SELECT 'deployed' AS status, ${targetName} AS scriptName, @beforeLen AS beforeBytes, @afterLen AS afterBytes, DATALENGTH(@prefix) AS prefixBytes, DATALENGTH(@payload) AS payloadBytes, UPDUSERNAME, SOUPDDATE FROM CSTINFO WHERE CSTTYPE=16 AND CSTNAME=${targetName} AND CSTINFO=0; ` +
              `END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK TRAN; THROW; END CATCH`
            : `SET NOCOUNT ON; SELECT TOP 1 'dry-run' AS status, ${targetName} AS scriptName, CSTTYPE, CSTINFO, SOTYPE, SODEFAULT, NAME, DATALENGTH(SODATA) AS currentBytes, UPDUSERNAME, SOUPDDATE FROM CSTINFO WHERE CSTTYPE=16 AND CSTNAME=${targetName} AND CSTINFO=0;`;

        if (options.commit === true) {
            logWriteAudit({ env: effectiveEnv, scriptName: options.scriptName, sha256, tool: 's1_deploy_ajs_script' });
        }

        const result = await this.executeRawSql({ ...options, sql });

        return {
            committed: options.commit === true,
            filePath: absolutePath,
            result,
            scriptName: options.scriptName,
            sha256,
            sourceBytes: sourceBytes.length
        };
    }

    private assertWriteAllowed(config: S1RuntimeConfig, effectiveEnv: 'prod' | 'test'): void {
        if (config.writeMode === 'off') {
            throw new Error('Write blocked: S1_WRITE_MODE is "off" for this project. Set S1_WRITE_MODE=test or S1_WRITE_MODE=all in the project .env to enable.');
        }
        if (config.writeMode === 'test' && effectiveEnv !== 'test') {
            throw new Error(`Write blocked: S1_WRITE_MODE=test only allows writes against env="test". Requested env="${effectiveEnv}". Set S1_WRITE_MODE=all to allow prod writes.`);
        }
    }

    /** Low-level, unfiltered SQL execution — only ever called AFTER a caller (queryDataset,
     * executeSqlWrite, deployAjsScript) has already validated/gated the statement. */
    private async executeRawSql(options: SqlDatasetOptions): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const sessionName = this.getSessionName(options.sessionName, options.env);
        const appId = asNonEmptyString(options.appId) || config.appId;
        const clientId = await this.ensureAuthenticatedClientId(options, config);

        if (!appId) {
            throw new Error('appId is required. Set S1_APP_ID or pass appId as tool argument.');
        }
        const sql = asNonEmptyString(options.sql);
        if (!sql) {
            throw new Error('sql is required');
        }
        const params = Array.isArray(options.params) ? options.params : [];

        // Custom AJS SQL endpoints are not standardized across projects. Send each
        // supported key variant; every endpoint reads only the pair it recognizes.
        const response = await this.postJson(buildUrl(config.baseUrl, config.sqlEndpointPath),
            this.withCustomWsAuthKey(config.sqlEndpointPath, config, {
                appId,
                clientID: clientId,
                PARAMS: params,
                SQL: sql,
                params,
                sql,
                sqlParams: params,
                sqlQuery: sql
            }));

        return { response: ensureSuccess('queryDataset', response), sessionName, success: true };
    }

    private withCustomWsAuthKey(path: string, config: S1RuntimeConfig, body: Record<string, unknown>): Record<string, unknown> {
        if (body.authKey !== undefined || !path.startsWith(config.customWsPrefix)) {
            return body;
        }
        if (!config.wsSharedSecret) {
            return body;
        }
        return { ...body, authKey: config.wsSharedSecret };
    }

    private async callAuthenticatedService(
        service: string,
        payload: Record<string, unknown>,
        options: BaseOptions = {}
    ): Promise<Record<string, unknown>> {
        const config = this.resolveConfig(options);
        const sessionName = this.getSessionName(options.sessionName, options.env);
        const appId = asNonEmptyString(options.appId) || config.appId;
        const clientId = await this.ensureAuthenticatedClientId(options, config);

        if (!appId) {
            throw new Error('appId is required. Set S1_APP_ID or pass appId as tool argument.');
        }

        const response = ensureSuccess(service, await this.postJson(config.baseUrl, {
            appId, clientID: clientId, service, ...payload
        }));

        return { response, sessionName, success: true };
    }

    private async ensureAuthenticatedClientId(options: BaseOptions, config: S1RuntimeConfig): Promise<string> {
        const explicitClientId = asNonEmptyString(options.clientID);
        if (explicitClientId) {
            return explicitClientId;
        }

        const sessionName = this.getSessionName(options.sessionName, options.env);
        const session = this.sessions.get(sessionName);
        if (session && session.authenticatedClientId) {
            return session.authenticatedClientId;
        }

        const authResult = await this.authenticate({
            ...options,
            appId: options.appId || config.appId,
            baseUrl: options.baseUrl || config.baseUrl,
            sqlEndpointPath: options.sqlEndpointPath || config.sqlEndpointPath
        });

        const response = authResult.response as Record<string, unknown>;
        const authenticatedClientId = asNonEmptyString(response.clientID);
        if (!authenticatedClientId) {
            throw new Error('authenticate did not return a clientID');
        }
        return authenticatedClientId;
    }

    private async ensureLogin(options: BaseOptions): Promise<LoginResponse> {
        const loginResult = await this.login(options);
        return loginResult.response as LoginResponse;
    }

    private fetchText(url: string, init: RequestInit): Promise<string> {
        return fetch(url, init).then(async response => {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while calling ${url}: ${text}`);
            }
            return text;
        });
    }

    private getSessionName(sessionName?: string, env?: 'prod' | 'test'): string {
        const base = asNonEmptyString(sessionName) || 'default';
        if (base.startsWith('prod:') || base.startsWith('test:')) {
            return base;
        }
        return `${env || 'prod'}:${base}`;
    }

    private getSessionState(sessionName: string): SessionState {
        const existing = this.sessions.get(sessionName);
        if (existing) {
            return existing;
        }
        const created: SessionState = {};
        this.sessions.set(sessionName, created);
        return created;
    }

    private async postJson(url: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
        const response = await fetch(url, {
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        });

        const text = await response.text();
        let parsed: Record<string, unknown> = {};

        if (text.length > 0) {
            try {
                parsed = JSON.parse(text) as Record<string, unknown>;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // S1's own web-service layer short-circuits some reserved path segments
                // (confirmed: any function literally named "ping") to a raw, non-JSON
                // "<code>;<serialnumber>" liveness-probe response, before custom AJS
                // dispatch ever runs. This is easy to mistake for a network/HTTP problem,
                // so surface the two most likely causes explicitly.
                if (/^-?\d+;\S+$/.test(text.trim())) {
                    throw new Error(
                        `SoftOne returned a raw platform-level response ("${text}") instead of JSON from ${url}. ` +
                        `This usually means either (a) the last path segment is a reserved name the platform ` +
                        `intercepts before custom AJS dispatch (known case: a function literally named "ping" ` +
                        `— rename it, e.g. to "health"), or (b) the custom module isn't deployed/published yet ` +
                        `on this S1 instance — verify with s1_deploy_ajs_script (dry-run) that a CSTINFO row ` +
                        `exists, deploy it, then call s1_refresh before retrying.`
                    );
                }
                throw new Error(`Invalid JSON response from ${url}: ${message}. Raw response: ${text}`);
            }
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while calling ${url}: ${text}`);
        }
        return parsed;
    }

    private resolveConfig(options: BaseOptions): S1RuntimeConfig {
        const merged = mergeRuntimeConfig(this.baseConfig, {
            appId: asNonEmptyString(options.appId),
            baseUrl: asNonEmptyString(options.baseUrl),
            defaultBranch: asNonEmptyString(options.branch),
            defaultCompany: asNonEmptyString(options.company),
            defaultModule: asNonEmptyString(options.module),
            defaultRefId: asNonEmptyString(options.refid),
            password: asNonEmptyString(options.password),
            sqlEndpointPath: asNonEmptyString(options.sqlEndpointPath),
            username: asNonEmptyString(options.username)
        });

        if (options.env && !options.baseUrl) {
            if (options.env === 'test') {
                if (!merged.testUrl) {
                    throw new Error('Test URL not configured. Set S1_TEST_URL in the project .env.');
                }
                return { ...merged, baseUrl: merged.testUrl, defaultEnv: 'test' };
            }
            if (!merged.prodUrl) {
                throw new Error('Prod URL not configured. Set S1_PROD_URL in the project .env.');
            }
            return { ...merged, baseUrl: merged.prodUrl, defaultEnv: 'prod' };
        }

        return merged;
    }

    private resolveSelection(loginResponse: LoginResponse | undefined, config: S1RuntimeConfig, options: BaseOptions): AuthSelection {
        const firstPermission = Array.isArray(loginResponse && loginResponse.objs) ? loginResponse!.objs![0] : undefined;
        const fallback = toSelection(firstPermission);

        const selection: AuthSelection = {
            branch: asNonEmptyString(options.branch) || config.defaultBranch || fallback.branch,
            company: asNonEmptyString(options.company) || config.defaultCompany || fallback.company,
            module: asNonEmptyString(options.module) || config.defaultModule || fallback.module,
            refid: asNonEmptyString(options.refid) || config.defaultRefId || fallback.refid
        };

        if (!selection.company || !selection.branch || !selection.module || !selection.refid) {
            throw new Error('Missing company/branch/module/refid. Set S1_DEFAULT_* in the project .env, call s1_login first, or pass them explicitly.');
        }

        return selection;
    }
}
