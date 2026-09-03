// Converts new_min_max/sql/*.sql into the string-array form embedded in S1-MEC/AJS/NewMinMax.js.
// Convention: comment-only lines are stripped, and runs of blank lines collapse to one.
const fs = require('fs');

function toSqlLines(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const kept = [];
    for (const line of lines) {
        if (line.trim().startsWith('--')) continue;
        if (line.trim() === '' && (kept.length === 0 || kept[kept.length - 1].trim() === '')) continue;
        kept.push(line.replace(/\s+$/, ''));
    }
    while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
    return kept;
}

module.exports = { toSqlLines };

if (require.main === module) {
    const lines = toSqlLines(fs.readFileSync(process.argv[2], 'utf8'));
    const body = lines.map((l, i) => '        ' + JSON.stringify(l) + (i === lines.length - 1 ? '' : ',')).join('\n');
    process.stdout.write('    return [\n' + body + '\n    ].join("\\n");\n');
}
