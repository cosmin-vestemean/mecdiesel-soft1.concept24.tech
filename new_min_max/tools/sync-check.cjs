// Verifies that the SQL embedded in S1-MEC/AJS/NewMinMax.js matches new_min_max/sql/*.sql
const fs = require('fs');
const path = require('path');
const { toSqlLines } = require('./sql-to-js.cjs');

const root = path.resolve(__dirname, '..', '..');
const js = fs.readFileSync(path.join(root, 'S1-MEC/AJS/NewMinMax.js'), 'utf8');

function extract(fn) {
    const i = js.indexOf('function ' + fn);
    if (i < 0) return null;
    const s = js.indexOf('return [', i);
    const e = js.indexOf('].join("\\n");', s);
    const body = js.slice(s + 'return ['.length, e).trim().replace(/,$/, '');
    return JSON.parse('[' + body + ']');
}

const pairs = [
    ['getParamTablesSql', 'new_min_max/sql/00_params.sql'],
    ['getPersistTablesSql', 'new_min_max/sql/00b_persist.sql'],
    ['getClassifyProcedureSql', 'new_min_max/sql/01_classify.sql'],
    ['getClassifyGroupProcedureSql', 'new_min_max/sql/02_classify_group.sql']
];

let failed = 0;
for (const [fn, rel] of pairs) {
    const fromJs = extract(fn);
    if (fromJs === null) {
        console.log(fn.padEnd(32), 'MISSING in NewMinMax.js');
        failed++;
        continue;
    }
    const expected = toSqlLines(fs.readFileSync(path.join(root, rel), 'utf8'));
    const firstDiff = fromJs.findIndex((l, i) => l !== expected[i]);
    const ok = fromJs.length === expected.length && firstDiff === -1;
    console.log(fn.padEnd(32), ok ? 'IN SYNC' : 'DRIFT', '(js ' + fromJs.length + ' / sql ' + expected.length + ' lines)');
    if (!ok) {
        failed++;
        const i = firstDiff === -1 ? Math.min(fromJs.length, expected.length) : firstDiff;
        console.log('  first diff at line ' + (i + 1));
        console.log('  js  : ' + JSON.stringify(fromJs[i]));
        console.log('  sql : ' + JSON.stringify(expected[i]));
    }
}

process.exit(failed === 0 ? 0 : 1);
