// Ported from Pet-Factory-ABC/soft1-mcp-server (deploy_ajs_script). Builds the
// Soft1 CSTINFO binary payload for an Advanced JavaScript script deployment:
// a small length-prefixed header followed by the UTF-8 source + a 2-byte
// terminator, reusing the existing row's metadata prefix up to the `Data\n`
// marker so only the payload itself is replaced.

export function sqlString(value: string, maxLength?: number): string {
    const text = maxLength && value.length > maxLength ? value.substring(0, maxLength) : value;
    return `N'${text.replace(/'/g, "''")}'`;
}

export function sqlVarBinaryMax(value: Buffer): string {
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += 8000) {
        chunks.push(`0x${value.subarray(index, index + 8000).toString('hex')}`);
    }
    return chunks.length
        ? `CONVERT(VARBINARY(MAX), ${chunks.join(') + CONVERT(VARBINARY(MAX), ')})`
        : 'CONVERT(VARBINARY(MAX), 0x)';
}

export function soft1DataHeader(payloadBytes: number): Buffer {
    const header = Buffer.alloc(12);
    header.writeUInt32LE(payloadBytes + 6, 0);
    header.writeUInt32LE(payloadBytes + 2, 4);
    header[8] = 0x00;
    header[9] = 0x00;
    header[10] = 0xe2;
    header[11] = 0x04;
    return header;
}

export function soft1ScriptPayload(sourceBytes: Buffer): Buffer {
    return Buffer.concat([sourceBytes, Buffer.from([0x00, 0x00])]);
}
