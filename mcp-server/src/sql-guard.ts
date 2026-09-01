// Classifies a SQL statement so callers can enforce a read-only vs
// write-gated boundary in CODE, not in a tool description string.
// Design constraints this must satisfy (see repo memory / CKS report 5.7):
//  - comments and string literals must be stripped BEFORE verb detection,
//    otherwise `/*x*/UPDATE` or a payload hidden inside a string literal
//    can evade a naive `sql.trim().toUpperCase().startsWith(...)` check.
//  - multi-statement (stacked-query) calls are rejected outright.
//  - whitelist, not blacklist: an unrecognized leading verb is rejected.

const READ_VERBS = new Set(['SELECT', 'WITH']);
const WRITE_VERBS = new Set(['INSERT', 'UPDATE', 'DELETE']);
const ALWAYS_BLOCKED_VERBS = new Set([
    'ALTER', 'BACKUP', 'CREATE', 'DBCC', 'DENY', 'DROP', 'EXEC', 'EXECUTE',
    'GRANT', 'MERGE', 'REVOKE', 'RESTORE', 'SHUTDOWN', 'TRUNCATE'
]);

export type SqlClassification = {
    ok: boolean;
    reason?: string;
    verb?: string;
};

function stripCommentsAndLiterals(sql: string): string {
    let out = '';
    let i = 0;

    while (i < sql.length) {
        const two = sql.slice(i, i + 2);

        if (two === '--') {
            const newline = sql.indexOf('\n', i);
            i = newline === -1 ? sql.length : newline + 1;
            out += ' ';
            continue;
        }

        if (two === '/*') {
            const end = sql.indexOf('*/', i + 2);
            i = end === -1 ? sql.length : end + 2;
            out += ' ';
            continue;
        }

        if (sql[i] === "'") {
            let j = i + 1;
            while (j < sql.length) {
                if (sql[j] === "'" && sql[j + 1] === "'") {
                    j += 2;
                    continue;
                }
                if (sql[j] === "'") {
                    j += 1;
                    break;
                }
                j += 1;
            }
            i = j;
            out += ' ';
            continue;
        }

        out += sql[i];
        i += 1;
    }

    return out;
}

function leadingVerb(strippedSql: string): string | undefined {
    const match = strippedSql.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1].toUpperCase() : undefined;
}

function hasMultipleStatements(strippedSql: string): boolean {
    const withoutTrailingSemicolon = strippedSql.trim().replace(/;\s*$/, '');
    return withoutTrailingSemicolon.includes(';');
}

export function classifySql(sql: string): SqlClassification {
    const stripped = stripCommentsAndLiterals(sql);
    const verb = leadingVerb(stripped);

    if (!verb) {
        return { ok: false, reason: 'Could not determine the leading SQL verb.' };
    }
    if (hasMultipleStatements(stripped)) {
        return { ok: false, reason: 'Multiple statements are not allowed (stacked queries).', verb };
    }
    if (ALWAYS_BLOCKED_VERBS.has(verb) || verb.startsWith('SP_') || verb.startsWith('XP_')) {
        return { ok: false, reason: `Verb ${verb} is always blocked, regardless of write mode.`, verb };
    }
    if (READ_VERBS.has(verb) || WRITE_VERBS.has(verb)) {
        return { ok: true, verb };
    }

    return { ok: false, reason: `Verb ${verb} is not in the read or write whitelist.`, verb };
}

export function isReadVerb(verb: string | undefined): boolean {
    return !!verb && READ_VERBS.has(verb);
}

export function isWriteVerb(verb: string | undefined): boolean {
    return !!verb && WRITE_VERBS.has(verb);
}
