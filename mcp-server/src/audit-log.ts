// Every write attempt (allowed or blocked) is logged to stderr — captured by
// VS Code's MCP server output panel — so gated writes leave a trail even
// though the gate itself lives in an env var, not in this log.
export function logWriteAudit(entry: Record<string, unknown>): void {
    console.error(`[s1-write-audit] ${JSON.stringify({ ts: new Date().toISOString(), ...entry })}`);
}
