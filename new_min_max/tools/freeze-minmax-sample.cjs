#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const rp = require('request-promise')

const RUN_ID = 5
const COMPANY = 1000
const OUTPUT_PATH = path.resolve(__dirname, '..', 'analiza', `esantion_minmax_run${RUN_ID}.json`)
const CLASSES = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD']
const SIZES = ['MARE', 'MIC']
const CLASS_SIZE_LABELS = CLASSES.flatMap((clasa) => SIZES.map((size) => `clasa_${clasa}_${size}`))
const REQUIRED_LABELS = [
  ...CLASS_SIZE_LABELS,
  'winsorizare', 'ordin_furnizor', 'stoc_negativ',
  'vz26_zero', 'grupa_mica', 'discontinuat', 'lichidare', 'blocat', 'exclus',
  'plafon_hq', 'podea', 'impact_valoare', 'impact_cumparare'
]
const UNAVAILABLE_LABELS = {
  rotunjire_pack: 'N_PACK este 1 pentru toate randurile din RUNID=5; ramura de rotunjire nu poate fi exercitata.',
  marime_MEDIU: 'RUNID=5 nu contine niciun rand MARIME=MEDIU, in nicio clasa; axa relevanta este MARE/MIC.'
}
const CALCULATED_FIELDS = [
  'SAFETY', 'LT_STOCK', 'SLTS', 'BUF', 'CYCLE', 'MAX_RAW', 'MAX_INF', 'CAP6',
  'VZ26_CAP', 'ENG_MIN', 'ENG_MAX', 'BUY_RAW', 'BUY_QTY'
]
const DECIMAL_TOLERANCE = 0.00000001

loadDotEnvIfPresent()

function loadDotEnvIfPresent () {
  const envPath = path.resolve(__dirname, '..', '..', '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function s1Config () {
  const authKey = process.env.S1_APP_WS_SHARED_SECRET
  if (!authKey) throw new Error('S1_APP_WS_SHARED_SECRET nu este setat.')
  return {
    appId: process.env.S1_APP_ID || '2002',
    authKey,
    baseUrl: process.env.S1_BASE_URL || 'https://mecdiesel.oncloud.gr/s1services'
  }
}

async function execSql (sql) {
  const { baseUrl, appId, authKey } = s1Config()
  const response = await rp({
    body: { appId, authKey, returnMode: 'dataset', sqlParams: [], sqlQuery: sql },
    gzip: true,
    json: true,
    method: 'POST',
    uri: `${baseUrl}/JS/WSMCP/execSql`
  })
  if (response && response.success === false) throw new Error(response.error || 'S1 execSql call failed.')
  return Array.isArray(response && response.data) ? response.data : []
}

function numeric (column) {
  return `CONVERT(VARCHAR(40), d.${column}) AS ${column}`
}

function candidateSql () {
  const classSelections = CLASSES.flatMap((clasa) => SIZES.map((size) =>
    `SELECT TOP 1 'clasa_${clasa}_${size}' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.CLASA = '${clasa}' AND d.MARIME = '${size}' ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`
  ))
  const selections = [
    ...classSelections,
    `SELECT TOP 1 'winsorizare' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d INNER JOIN CCCMINMAXWINSOR w ON w.RUNID = d.RUNID AND w.MTRL = d.MTRL WHERE d.RUNID = ${RUN_ID} AND w.NR_LINII_PLAFONATE > 0 ORDER BY w.NR_LINII_PLAFONATE DESC, d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'rotunjire_pack' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.N_PACK > 1 AND d.BUY_QTY > 0 ORDER BY d.BUY_QTY DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'ordin_furnizor' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.ORD_FURN > 0 ORDER BY d.ORD_FURN DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'stoc_negativ' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.STOC_QTY < 0 ORDER BY d.STOC_QTY, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'vz26_zero' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.WARN_VZ26_ZERO = 1 ORDER BY d.VZ_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'grupa_mica' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.WARN_GRUPA_MICA = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'discontinuat' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.DISC_FLAG = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'lichidare' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.FLAG_LICHIDARE = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'blocat' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.FLAG_BLOCAT = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'exclus' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.FLAG_EXCLUS = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'plafon_hq' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.HQ_CAP_APLICAT = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'podea' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} AND d.PODEA_APLICATA = 1 ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'impact_valoare' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} ORDER BY d.VAL_52S DESC, d.BRANCH, d.MTRL`,
    `SELECT TOP 1 'impact_cumparare' AS SAMPLE_LABEL, d.BRANCH, d.MTRL FROM CCCMINMAXDET d WHERE d.RUNID = ${RUN_ID} ORDER BY d.BUY_QTY DESC, d.BRANCH, d.MTRL`
  ]
  return selections.map((selection) => `SELECT * FROM (${selection}) AS candidate`).join('\nUNION ALL\n')
}

function referenceSql (pairs) {
  const where = pairs.map(({ BRANCH, MTRL }) => `(d.BRANCH = ${Number(BRANCH)} AND d.MTRL = ${Number(MTRL)})`).join(' OR ')
  const fields = [
    'VZ_4S', 'VZ_13S', 'VZ_26S', 'VZ_52S', 'VAL_52S', 'MIN_DOC', 'SIGMA_WK',
    'COV_TGT', 'SL', 'SSF', 'AVG', 'ad', 'STOC_QTY', 'ORD_FURN', 'N_PACK',
    'ERP_MIN', 'ERP_MAX', 'SAFETY', 'LT_STOCK', 'SLTS', 'BUF', 'CYCLE', 'MAX_RAW',
    'MAX_INF', 'CAP6', 'VZ26_CAP', 'SUM_BR_MAX', 'ENG_MIN', 'ENG_MAX', 'BUY_RAW',
    'BUY_QTY', 'ACOP_CUR', 'FLAG_RATIO', 'TREND_PCT'
  ].map(numeric).join(',\n       ')
  return `SELECT d.BRANCH, d.MTRL, d.CODE, d.MTRL_NAME, d.MTRGROUP, d.MARIME,
       d.ESTE_HQ, d.ESTE_PODEA, d.LIFECYCLE, d.ABC, d.XYZ, d.CLASA,
       d.SAPT_VZ, d.SAPT_8S, d.SAPT_FARA, d.LT_ZILE, d.FRECVENTA_ZILE,
       d.GRP_ITEM_COUNT, d.WARN_GRUPA_MICA, d.FLAG_LICHIDARE, d.FLAG_BLOCAT,
       d.FLAG_EXCLUS, d.HQ_CAP_APLICAT, d.PODEA_APLICATA, d.WARN_VZ26_ZERO,
       d.WARN_STOC_NEG, d.WARN_STOC_MORT, d.DISC_FLAG, d.FLAG_TXT, d.STATUS_TREND,
      ${fields},
      CONVERT(VARCHAR(40), hq.ENG_MIN) AS HQ_ENG_MIN
FROM CCCMINMAXDET d
    LEFT JOIN CCCMINMAXDET hq
        ON hq.RUNID = d.RUNID AND hq.MTRL = d.MTRL AND hq.ESTE_HQ = 1
WHERE d.RUNID = ${RUN_ID} AND (${where})
ORDER BY d.BRANCH, d.MTRL`
}

function groupRowsByKey (rows) {
  return new Map(rows.map((row) => [`${row.BRANCH}|${row.MTRL}`, row]))
}

function decimal (value) {
  return Number(Number(value).toFixed(8))
}

function calculateExpected (reference, params) {
  const value = (field) => Number(reference[field])
  const safety = decimal(value('SIGMA_WK') * value('SSF') * Math.sqrt(value('LT_ZILE') / 7))
  const ltStock = decimal(value('ad') * value('LT_ZILE'))
  const cycle = decimal(value('COV_TGT') === 0 && params.CZ_CYCLE_ZERO === 1
    ? 0
    : Math.max(decimal(value('AVG') * value('COV_TGT')), decimal(value('ad') * value('FRECVENTA_ZILE'))))
  const sl = value('SL') || 100
  const slts = decimal(ltStock * (100 / sl - 1))
  const buf = decimal(safety + slts + ltStock)
  const maxRaw = decimal(Math.ceil(buf + cycle))
  const cap6 = decimal(Math.ceil(value('AVG') * params.CAP_LUNI))
  const vz26Cap = decimal(value('VZ_26S') > 0 ? value('VZ_26S') : params.VZ26_CAP_SENTINEL)
  const maxInf = decimal(Number(reference.ESTE_HQ) === 1 ? Math.ceil(maxRaw * params.INFLATIE_HQ) : maxRaw)
  const minBase = decimal(Math.max(decimal(Math.ceil(buf)), value('MIN_DOC')))
  let engMax = reference.LIFECYCLE === 'OD' ? 0 : decimal(Math.min(maxInf, cap6, vz26Cap))
  let engMin = reference.LIFECYCLE === 'OD' ? 0 : decimal(Math.min(minBase, engMax))

  const sumBranchMax = value('SUM_BR_MAX')
  if (Number(reference.ESTE_HQ) === 1 && sumBranchMax > 0 && engMax > sumBranchMax * params.HQ_CAP_FACTOR) {
    engMax = decimal(Math.ceil(sumBranchMax * params.HQ_CAP_FACTOR))
  }
  if (Number(reference.ESTE_HQ) === 1 && engMin > engMax) engMin = engMax

  const hqEngMin = Number(reference.HQ_ENG_MIN)
  if (Number(reference.ESTE_PODEA) === 1 && hqEngMin > 0 && engMin < Math.ceil(hqEngMin * params.PROCENT_PODEA_BUC)) {
    engMin = decimal(Math.ceil(hqEngMin * params.PROCENT_PODEA_BUC))
  }
  if (Number(reference.ESTE_PODEA) === 1 && engMin > engMax) engMax = engMin

  const buyRaw = decimal(Math.max(engMax - Math.max(value('STOC_QTY'), 0) - value('ORD_FURN'), 0))
  const buyQty = decimal(Math.ceil(buyRaw / value('N_PACK')) * value('N_PACK'))
  return {
    SAFETY: safety,
    LT_STOCK: ltStock,
    SLTS: slts,
    BUF: buf,
    CYCLE: cycle,
    MAX_RAW: maxRaw,
    MAX_INF: maxInf,
    CAP6: cap6,
    VZ26_CAP: vz26Cap,
    ENG_MIN: engMin,
    ENG_MAX: engMax,
    BUY_RAW: buyRaw,
    BUY_QTY: buyQty
  }
}

function verifyReference (triplet, reference, params) {
  const expected = calculateExpected(reference, params)
  const persisted = Object.fromEntries(CALCULATED_FIELDS.map((field) => [field, Number(reference[field])]))
  const difference = Object.fromEntries(CALCULATED_FIELDS.map((field) => [field, decimal(expected[field] - persisted[field])]))
  const mismatches = CALCULATED_FIELDS.filter((field) => Math.abs(difference[field]) > DECIMAL_TOLERANCE)
  return {
    ...triplet,
    expected,
    persisted,
    difference,
    verdict: mismatches.length ? 'FAIL' : 'PASS',
    mismatches
  }
}

function denseWeeklySeries (sample, sparseWeeks) {
  const sparseByKey = new Map(sparseWeeks.map((week) => [`${week.BRANCH}|${week.MTRL}|${week.WEEK_INDEX}`, week]))
  return sample.flatMap(({ triplet }) => Array.from({ length: 52 }, (_, weekIndex) => {
    const persisted = sparseByKey.get(`${triplet.branch}|${triplet.mtrl}|${weekIndex}`)
    return persisted || {
      BRANCH: triplet.branch,
      MTRL: triplet.mtrl,
      WEEK_INDEX: weekIndex,
      QTY: '0.00000000',
      SALES_VALUE: '0.00000000',
      LAST_POSITIVE_SALE: null
    }
  }))
}

async function main () {
  const labels = await execSql(candidateSql())
  const found = new Set(labels.map((row) => row.SAMPLE_LABEL))
  const missing = REQUIRED_LABELS.filter((label) => !found.has(label))
  if (missing.length) throw new Error(`RUNID ${RUN_ID} nu acopera criteriile obligatorii: ${missing.join(', ')}`)

  const labelsByKey = new Map()
  for (const row of labels) {
    const key = `${row.BRANCH}|${row.MTRL}`
    labelsByKey.set(key, [...(labelsByKey.get(key) || []), row.SAMPLE_LABEL])
  }
  const pairs = [...labelsByKey.keys()].map((key) => {
    const [BRANCH, MTRL] = key.split('|')
    return { BRANCH, MTRL }
  })
  const references = await execSql(referenceSql(pairs))
  if (references.length !== pairs.length) throw new Error('Un triplet selectat nu mai exista exact o data in CCCMINMAXDET.')

  const keys = new Set(pairs.map(({ BRANCH, MTRL }) => `${BRANCH}|${MTRL}`))
  const [run, winsor, weeks] = await Promise.all([
    execSql(`SELECT RUNID, COMPANY, AZI, PARAMSJSON, COMPUTE_PARAMSJSON FROM CCCMINMAXRUN WHERE RUNID = ${RUN_ID} AND COMPANY = ${COMPANY}`),
    execSql(`SELECT MTRL, POSITIVE_LINE_COUNT, CONVERT(VARCHAR(40), P95_QTY) AS P95_QTY, CONVERT(VARCHAR(40), MEDIAN_QTY) AS MEDIAN_QTY, PRAG_APLICAT, NR_LINII_PLAFONATE, CONVERT(VARCHAR(40), QTY_BRUT) AS QTY_BRUT, CONVERT(VARCHAR(40), QTY_WINSORIZAT) AS QTY_WINSORIZAT FROM CCCMINMAXWINSOR WHERE RUNID = ${RUN_ID} AND MTRL IN (${pairs.map(({ MTRL }) => Number(MTRL)).join(',')}) ORDER BY MTRL`),
    execSql(`SELECT BRANCH, MTRL, WEEK_INDEX, CONVERT(VARCHAR(40), QTY) AS QTY, CONVERT(VARCHAR(40), SALES_VALUE) AS SALES_VALUE, LAST_POSITIVE_SALE FROM CCCMINMAXWEEK WHERE RUNID = ${RUN_ID} AND (${pairs.map(({ BRANCH, MTRL }) => `(BRANCH = ${Number(BRANCH)} AND MTRL = ${Number(MTRL)})`).join(' OR ')}) ORDER BY BRANCH, MTRL, WEEK_INDEX`)
  ])
  if (run.length !== 1) throw new Error(`RUNID ${RUN_ID} nu este disponibil pentru snapshot.`)

  const byKey = groupRowsByKey(references)
  const sample = [...labelsByKey.entries()].map(([key, sampleLabels]) => ({
    triplet: { runId: RUN_ID, branch: Number(key.split('|')[0]), mtrl: Number(key.split('|')[1]) },
    labels: sampleLabels.sort(),
    reference: byKey.get(key)
  })).sort((left, right) => left.triplet.branch - right.triplet.branch || left.triplet.mtrl - right.triplet.mtrl)
  const computeParams = JSON.parse(run[0].COMPUTE_PARAMSJSON)
  const verification = sample.map(({ triplet, reference }) => verifyReference(triplet, reference, computeParams))
  const failures = verification.filter(({ verdict }) => verdict === 'FAIL')
  if (failures.length) {
    const details = failures.map(({ branch, mtrl, mismatches }) => `${branch}/${mtrl}: ${mismatches.join(', ')}`).join('; ')
    throw new Error(`Recalcularea independenta difera de RUNID ${RUN_ID}: ${details}`)
  }

  const snapshot = {
    schemaVersion: 1,
    frozenAt: new Date().toISOString(),
    purpose: 'Pasul 8 nivel B: baseline persistent pentru comparatii dupa rulari viitoare.',
    calculationMethod: 'Recalcul independent al formulelor din 03_compute.sql, cu rotunjire DECIMAL(28,8) dupa fiecare etapa. SUM_BR_MAX si HQ_ENG_MIN sunt dependente persistate ale formulelor HQ/podea.',
    decimalTolerance: DECIMAL_TOLERANCE,
    run: run[0],
    requiredLabels: REQUIRED_LABELS,
    unavailableLabels: UNAVAILABLE_LABELS,
    coverage: Object.fromEntries(REQUIRED_LABELS.map((label) => [label, labels.filter((row) => row.SAMPLE_LABEL === label).map((row) => ({ branch: Number(row.BRANCH), mtrl: Number(row.MTRL) }))])),
    axisCoverage: {
      classSizeCells: CLASS_SIZE_LABELS,
      lifecycle: [...new Set(sample.map(({ reference }) => reference.LIFECYCLE))].sort(),
      hq: sample.filter(({ reference }) => Number(reference.ESTE_HQ) === 1).length,
      nonHq: sample.filter(({ reference }) => Number(reference.ESTE_HQ) !== 1).length
    },
    sample,
    winsor,
    weeklySeries: denseWeeklySeries(sample, weeks),
    verification
  }
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Frozen ${sample.length} triplete (${REQUIRED_LABELS.length} criterii) in ${path.relative(process.cwd(), OUTPUT_PATH)}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})