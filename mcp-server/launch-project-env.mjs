import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const envPath = resolve(projectDir, '.env');

if (!existsSync(envPath)) {
    console.error(`[s1-api] Project environment file not found: ${envPath}`);
    process.exit(1);
}

const result = loadDotEnv({ path: envPath });
if (result.error) {
    console.error(`[s1-api] Could not load project environment: ${result.error.message}`);
    process.exit(1);
}

await import('./dist/index.js');
