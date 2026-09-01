import { config as loadDotEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Loads this package's own .env for standalone dev/testing only. In real use,
// VS Code's mcp.json `envFile` points at each PROJECT's own .env, so those
// values are already in process.env by the time this runs — dotenv never
// overwrites an already-set variable, so project env always wins.
const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
loadDotEnv({ path: join(serverDir, '.env') });

export type WriteMode = 'off' | 'test' | 'all';

export type S1RuntimeConfig = {
    appId: string;
    baseUrl: string;
    customWsPrefix: string;
    defaultBranch?: string;
    defaultCompany?: string;
    defaultEnv: 'prod' | 'test';
    defaultModule?: string;
    defaultRefId?: string;
    password?: string;
    prodUrl?: string;
    sqlEndpointPath: string;
    testUrl?: string;
    username?: string;
    wsSharedSecret?: string;
    writeMode: WriteMode;
};

function readWriteMode(): WriteMode {
    const raw = (process.env.S1_WRITE_MODE || 'off').trim().toLowerCase();
    return raw === 'test' || raw === 'all' ? raw : 'off';
}

export function getDefaultConfig(): S1RuntimeConfig {
    // Safe-by-default: unlike the per-project servers this replaces, an unset
    // S1_ENV resolves to "test", not "prod". Projects that only ever talk to
    // production must set S1_ENV=prod explicitly in their own .env.
    const defaultEnv: 'prod' | 'test' = process.env.S1_ENV === 'prod' ? 'prod' : 'test';
    const prodUrl = process.env.S1_PROD_URL;
    const testUrl = process.env.S1_TEST_URL;
    const baseUrl = defaultEnv === 'test' ? (testUrl || prodUrl) : (prodUrl || testUrl);

    if (!baseUrl) {
        throw new Error('Missing S1 base URL. Set S1_PROD_URL and/or S1_TEST_URL in the project .env (loaded via mcp.json envFile).');
    }

    return {
        appId: process.env.S1_APP_ID || '1001',
        baseUrl,
        customWsPrefix: process.env.S1_CUSTOM_WS_PREFIX || '/JS/WS/',
        defaultBranch: process.env.S1_DEFAULT_BRANCH,
        defaultCompany: process.env.S1_DEFAULT_COMPANY,
        defaultEnv,
        defaultModule: process.env.S1_DEFAULT_MODULE,
        defaultRefId: process.env.S1_DEFAULT_REFID,
        password: process.env.S1_WS_PASS,
        prodUrl,
        sqlEndpointPath: process.env.S1_SQL_ENDPOINT_PATH || '/JS/Utile/getSQLDataSet',
        testUrl,
        username: process.env.S1_WS_USR,
        wsSharedSecret: process.env.S1_WS_SHARED_SECRET,
        writeMode: readWriteMode()
    };
}

export function mergeRuntimeConfig(
    base: S1RuntimeConfig,
    overrides: Partial<Record<keyof S1RuntimeConfig, string | undefined>>
): S1RuntimeConfig {
    const merged: S1RuntimeConfig = { ...base };
    for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined) {
            (merged as Record<string, unknown>)[key] = value;
        }
    }
    return merged;
}
