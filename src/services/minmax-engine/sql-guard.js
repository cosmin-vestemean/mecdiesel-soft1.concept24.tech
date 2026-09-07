// Classifies a SQL statement so the minmax-engine service can enforce a
// read vs write-gated boundary in CODE, not in a comment. Mirrors
// mcp-server/src/sql-guard.ts (see repo memory / FAZA5_CONTRACT.md §3-4),
// with one addition: writes must also target a whitelisted config table,
// because WSMCP_classifyStatement (server-side) restricts VERBS only, not
// tables — an ALLOW_WRITE=1 key could otherwise UPDATE any table in S1.

const READ_VERBS = new Set(['SELECT', 'WITH'])
const WRITE_VERBS = new Set(['INSERT', 'UPDATE', 'DELETE'])
const ALWAYS_BLOCKED_VERBS = new Set([
  'ALTER', 'BACKUP', 'CREATE', 'DBCC', 'DENY', 'DROP', 'EXEC', 'EXECUTE',
  'GRANT', 'MERGE', 'REVOKE', 'RESTORE', 'SHUTDOWN', 'TRUNCATE'
])

// The only tables this service is allowed to mutate (FAZA5_CONTRACT.md §7).
export const WRITABLE_TABLES = new Set([
  'CCCMINMAXPARAMS', 'CCCMINMAXCOV', 'CCCMINMAXBRANCH', 'CCCMINMAXTEMPLATE'
])

function stripCommentsAndLiterals (sql) {
  let out = ''
  let i = 0

  while (i < sql.length) {
    const two = sql.slice(i, i + 2)

    if (two === '--') {
      const newline = sql.indexOf('\n', i)
      i = newline === -1 ? sql.length : newline + 1
      out += ' '
      continue
    }

    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      out += ' '
      continue
    }

    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2
          continue
        }
        if (sql[j] === "'") {
          j += 1
          break
        }
        j += 1
      }
      i = j
      out += ' '
      continue
    }

    out += sql[i]
    i += 1
  }

  return out
}

function leadingVerb (strippedSql) {
  const match = strippedSql.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/)
  return match ? match[1].toUpperCase() : undefined
}

function hasMultipleStatements (strippedSql) {
  const withoutTrailingSemicolon = strippedSql.trim().replace(/;\s*$/, '')
  return withoutTrailingSemicolon.includes(';')
}

function referencedTable (strippedSql, verb) {
  let match
  if (verb === 'INSERT') {
    match = strippedSql.match(/INSERT\s+INTO\s+\[?([A-Za-z0-9_]+)\]?/i)
  } else if (verb === 'UPDATE') {
    match = strippedSql.match(/UPDATE\s+\[?([A-Za-z0-9_]+)\]?/i)
  } else if (verb === 'DELETE') {
    match = strippedSql.match(/DELETE\s+FROM\s+\[?([A-Za-z0-9_]+)\]?/i)
  }
  return match ? match[1].toUpperCase() : undefined
}

/**
 * @param {string} sql
 * @returns {{ok: boolean, reason?: string, verb?: string, table?: string}}
 */
export function classifySql (sql) {
  const stripped = stripCommentsAndLiterals(sql)
  const verb = leadingVerb(stripped)

  if (!verb) {
    return { ok: false, reason: 'Could not determine the leading SQL verb.' }
  }
  if (hasMultipleStatements(stripped)) {
    return { ok: false, reason: 'Multiple statements are not allowed (stacked queries).', verb }
  }
  if (ALWAYS_BLOCKED_VERBS.has(verb) || verb.startsWith('SP_') || verb.startsWith('XP_')) {
    return { ok: false, reason: `Verb ${verb} is always blocked, regardless of write mode.`, verb }
  }
  if (READ_VERBS.has(verb)) {
    return { ok: true, verb }
  }
  if (WRITE_VERBS.has(verb)) {
    const table = referencedTable(stripped, verb)
    if (!table || !WRITABLE_TABLES.has(table)) {
      return { ok: false, reason: `Table ${table || '(unknown)'} is not in the minmax-engine write whitelist.`, verb }
    }
    return { ok: true, verb, table }
  }

  return { ok: false, reason: `Verb ${verb} is not in the read or write whitelist.`, verb }
}
