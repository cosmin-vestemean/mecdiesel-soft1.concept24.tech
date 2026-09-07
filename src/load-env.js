import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Loads project root .env into process.env before Feathers configuration runs.
// Does not overwrite already-set environment variables.
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = val
        }
      }
    }
  } catch (err) {
    console.warn('[load-env] Could not parse .env file:', err.message)
  }
}
