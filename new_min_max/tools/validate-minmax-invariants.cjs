#!/usr/bin/env node
'use strict'

// Faza 5, Pasul 8, nivel A: invariante SQL pe toata populatia unei rulari
// MIN/MAX (FAZA5_REMEDIERI_PLAN.md). Ruleaza direct impotriva CCCMINMAXDET /
// CCCMINMAXGRP / CCCMINMAXBRANCH / CCCMINMAXPARAMS prin canalul WSMCP
// execSql, acelasi canal folosit de src/services/minmax-engine. Read-only:
// fiecare SQL de mai jos e fix, scris aici, fara input de la utilizator -
// nu are nevoie de classifySql (garda din minmax-engine.class.js), care
// exista pentru a proteja un canal ce compune SQL din cereri HTTP externe.
//
// Regula de aur (obligatorie): invariante, niciodata numere fixe de randuri.
// AZI vine din MAX(TRNDATE) pe date vii, deci populatia poate creste in
// aceeasi zi - vezi thread-ul "criterii-numerice-nereproductibile".
//
// Utilizare:
//   node new_min_max/tools/validate-minmax-invariants.cjs           # RUNID curent (ESTE_CURENT=1)
//   node new_min_max/tools/validate-minmax-invariants.cjs 5         # RUNID explicit, trebuie DONE/Compute DONE
//
// Cere in mediu (sau in .env la radacina repo-ului): S1_APP_WS_SHARED_SECRET
// (cheia aplicatiei, ALLOW_WRITE=1 - nu se scrie nimic aici, dar e cheia
// deja configurata pentru acest serviciu). Optional: S1_BASE_URL, S1_APP_ID.

const fs = require('fs')
const path = require('path')
const rp = require('request-promise')

const COMPANY = 1000
const DEFAULT_S1_BASE_URL = 'https://mecdiesel.oncloud.gr/s1services'
const DEFAULT_S1_APP_ID = '2002'

loadDotEnvIfPresent()

function loadDotEnvIfPresent () {
  const envPath = path.resolve(__dirname, '..', '..', '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function s1Config () {
  const authKey = process.env.S1_APP_WS_SHARED_SECRET
  if (!authKey) {
    throw new Error('S1_APP_WS_SHARED_SECRET nu este setat (env sau .env).')
  }
  return {
    appId: process.env.S1_APP_ID || DEFAULT_S1_APP_ID,
    authKey,
    baseUrl: process.env.S1_BASE_URL || DEFAULT_S1_BASE_URL
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
  if (response && response.success === false) {
    throw new Error(response.error || 'S1 execSql call failed.')
  }
  return Array.isArray(response && response.data) ? response.data : []
}

function n (value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : NaN
}

function sqlIntLiteral (value, label) {
  const num = Number(value)
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${label} must be an integer`)
  }
  return num
}

// "Sesiune curenta" = ESTE_CURENT=1 AND SCOPE=FULL AND SESSION_STATUS=DONE
// AND COMPUTE_STATUS=DONE, niciodata MAX(RUNID) - vezi minmax-engine.class.js
// _resolveRunId(), acelasi contract reprodus aici pentru un tool standalone.
async function resolveRunId (requested) {
  if (requested !== undefined) {
    const id = sqlIntLiteral(requested, 'runId')
    const rows = await execSql(
      `SELECT RUNID FROM CCCMINMAXRUN WHERE RUNID = ${id} AND COMPANY = ${COMPANY} ` +
      "AND SCOPE = 'FULL' AND SESSION_STATUS = 'DONE' AND COMPUTE_STATUS = 'DONE'"
    )
    if (!rows.length) {
      throw new Error(`RUNID ${id} nu este o sesiune FULL incheiata cu Compute DONE.`)
    }
    return id
  }
  const rows = await execSql(
    `SELECT TOP 1 RUNID FROM CCCMINMAXRUN WHERE COMPANY = ${COMPANY} AND SCOPE = 'FULL' ` +
    "AND SESSION_STATUS = 'DONE' AND ESTE_CURENT = 1 AND COMPUTE_STATUS = 'DONE'"
  )
  if (!rows.length) {
    throw new Error('Nu exista o sesiune curenta (ESTE_CURENT=1, SCOPE=FULL, SESSION_STATUS=DONE, COMPUTE_STATUS=DONE).')
  }
  return sqlIntLiteral(rows[0].RUNID, 'RUNID rezolvat')
}

// runId e deja un intreg validat mai sus -> se interpoleaza direct in SQL,
// nu ca parametru legat (acelasi motiv ca la OFFSET/FETCH in
// minmax-engine.class.js: WSMCP nu accepta parametri legati peste tot, si
// e sigur pentru ca nu e input brut de utilizator - vezi conventions.md §6).
function buildInvariants (runId) {
  return [
    {
      id: 'structural',
      label: 'Structurale: TOTAL_ROWS = ITEMS x BRANCHES, BRANCHES = 14, HQ_ROWS = ITEMS',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS, COUNT(DISTINCT MTRL) AS DISTINCT_ITEMS,
                  COUNT(DISTINCT BRANCH) AS DISTINCT_BRANCHES,
                  SUM(CASE WHEN ESTE_HQ = 1 THEN 1 ELSE 0 END) AS HQ_ROWS
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const total = n(row.TOTAL_ROWS)
        const items = n(row.DISTINCT_ITEMS)
        const branches = n(row.DISTINCT_BRANCHES)
        const hqRows = n(row.HQ_ROWS)
        const problems = []
        if (total !== items * branches) problems.push(`TOTAL_ROWS ${total} != ${items}x${branches}`)
        if (branches !== 14) problems.push(`DISTINCT_BRANCHES ${branches} != 14`)
        if (hqRows !== items) problems.push(`HQ_ROWS ${hqRows} != DISTINCT_ITEMS ${items}`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `${total} randuri, ${items} itemi, ${branches} filiale` }
      }
    },
    {
      id: 'ordine_domeniu',
      label: 'MIN_GT_MAX = 0, ENG_MIN >= 0, BUY_QTY >= 0',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN ENG_MIN > ENG_MAX THEN 1 ELSE 0 END) AS MIN_GT_MAX,
                  SUM(CASE WHEN ENG_MIN < 0 THEN 1 ELSE 0 END) AS ENG_MIN_NEG,
                  SUM(CASE WHEN BUY_QTY < 0 THEN 1 ELSE 0 END) AS BUY_QTY_NEG
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const problems = []
        if (n(row.MIN_GT_MAX) !== 0) problems.push(`MIN_GT_MAX = ${row.MIN_GT_MAX}`)
        if (n(row.ENG_MIN_NEG) !== 0) problems.push(`ENG_MIN < 0 pe ${row.ENG_MIN_NEG} randuri`)
        if (n(row.BUY_QTY_NEG) !== 0) problems.push(`BUY_QTY < 0 pe ${row.BUY_QTY_NEG} randuri`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_ROWS} randuri` }
      }
    },
    {
      id: 'rotunjire_pack',
      label: 'N_PACK > 1 => BUY_QTY - FLOOR(BUY_QTY/N_PACK)*N_PACK = 0',
      async run () {
        const [row] = await execSql(
          `SELECT SUM(CASE WHEN N_PACK > 1 THEN 1 ELSE 0 END) AS TOTAL_N_PACK,
                  SUM(CASE WHEN N_PACK > 1 AND (BUY_QTY - FLOOR(BUY_QTY / N_PACK) * N_PACK) <> 0 THEN 1 ELSE 0 END) AS ABATERI
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const abateri = n(row.ABATERI) || 0
        return { pass: abateri === 0, detail: `${abateri} abateri din ${row.TOTAL_N_PACK || 0} randuri cu N_PACK > 1` }
      }
    },
    {
      id: 'plafon_hq',
      label: 'HQ_CAP_APLICAT=1 => ENG_MAX = plafon exact; =0 => ENG_MAX <= plafon',
      async run () {
        const [row] = await execSql(
          `SELECT SUM(CASE WHEN d.ESTE_HQ = 1 THEN 1 ELSE 0 END) AS TOTAL_HQ_ROWS,
                  SUM(CASE WHEN d.ESTE_HQ = 1 AND d.HQ_CAP_APLICAT = 1
                        AND d.ENG_MAX <> CEILING(d.SUM_BR_MAX * p.V) THEN 1 ELSE 0 END) AS ABATERI_APLICAT,
                  SUM(CASE WHEN d.ESTE_HQ = 1 AND COALESCE(d.HQ_CAP_APLICAT, 0) = 0
                        AND d.SUM_BR_MAX > 0 AND d.ENG_MAX > CEILING(d.SUM_BR_MAX * p.V) THEN 1 ELSE 0 END) AS ABATERI_NEAPLICAT
           FROM CCCMINMAXDET d
           CROSS JOIN (SELECT TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) AS V FROM CCCMINMAXPARAMS
                       WHERE PARAMKEY = 'HQ_CAP_FACTOR' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '') p
           WHERE d.RUNID = ${runId}`
        )
        const aplicat = n(row.ABATERI_APLICAT) || 0
        const neaplicat = n(row.ABATERI_NEAPLICAT) || 0
        const problems = []
        if (aplicat !== 0) problems.push(`${aplicat} randuri HQ_CAP_APLICAT=1 cu ENG_MAX != plafon`)
        if (neaplicat !== 0) problems.push(`${neaplicat} randuri HQ_CAP_APLICAT=0 cu ENG_MAX > plafon`)
        return { pass: aplicat === 0 && neaplicat === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_HQ_ROWS || 0} randuri HQ` }
      }
    },
    {
      id: 'podea',
      label: 'PODEA_APLICATA=1 numai pe ESTE_PODEA=1; valoarea respecta podeaua',
      async run () {
        const [row] = await execSql(
          `SELECT SUM(CASE WHEN d.ESTE_PODEA = 1 THEN 1 ELSE 0 END) AS TOTAL_PODEA_ROWS,
                  SUM(CASE WHEN d.PODEA_APLICATA = 1 AND d.ESTE_PODEA = 0 THEN 1 ELSE 0 END) AS ABATERI_FLAG_FARA_PODEA,
                  SUM(CASE WHEN d.ESTE_PODEA = 1 AND hq.ENG_MIN > 0
                        AND d.ENG_MIN < CEILING(hq.ENG_MIN * pp.V) - 0.0001 THEN 1 ELSE 0 END) AS ABATERI_SUB_PODEA,
                  COUNT(DISTINCT CASE WHEN b.BRANCH IS NOT NULL AND b.ESTE_PODEA <> d.ESTE_PODEA THEN d.BRANCH END) AS BRANCHES_CONFIG_MISMATCH
           FROM CCCMINMAXDET d
           LEFT JOIN CCCMINMAXDET hq ON hq.RUNID = d.RUNID AND hq.MTRL = d.MTRL AND hq.ESTE_HQ = 1
           LEFT JOIN CCCMINMAXBRANCH b ON b.BRANCH = d.BRANCH
           CROSS JOIN (SELECT TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) AS V FROM CCCMINMAXPARAMS
                       WHERE PARAMKEY = 'PROCENT_PODEA_BUC' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '') pp
           WHERE d.RUNID = ${runId}`
        )
        const flagFaraPodea = n(row.ABATERI_FLAG_FARA_PODEA) || 0
        const subPodea = n(row.ABATERI_SUB_PODEA) || 0
        const mismatch = n(row.BRANCHES_CONFIG_MISMATCH) || 0
        const problems = []
        if (flagFaraPodea !== 0) problems.push(`${flagFaraPodea} randuri PODEA_APLICATA=1 fara ESTE_PODEA`)
        if (subPodea !== 0) problems.push(`${subPodea} randuri sub podeaua asteptata`)
        if (mismatch !== 0) problems.push(`${mismatch} filiale cu ESTE_PODEA diferit intre DET si CCCMINMAXBRANCH`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_PODEA_ROWS || 0} randuri podea` }
      }
    },
    {
      id: 'clasificare',
      label: 'STANDARD => CLASA=ABC||XYZ; CLASA in {NOU,OD} <=> LIFECYCLE in {NOU,OD}',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN LIFECYCLE = 'STANDARD' AND CLASA <> CONCAT(ABC, XYZ) THEN 1 ELSE 0 END) AS ABATERI_STANDARD,
                  SUM(CASE WHEN LIFECYCLE IN ('NOU', 'OD') AND CLASA <> LIFECYCLE THEN 1 ELSE 0 END) AS ABATERI_LIFECYCLE_FARA_CLASA,
                  SUM(CASE WHEN LIFECYCLE NOT IN ('NOU', 'OD') AND CLASA IN ('NOU', 'OD') THEN 1 ELSE 0 END) AS ABATERI_CLASA_FARA_LIFECYCLE
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const a = n(row.ABATERI_STANDARD) || 0
        const b = n(row.ABATERI_LIFECYCLE_FARA_CLASA) || 0
        const c = n(row.ABATERI_CLASA_FARA_LIFECYCLE) || 0
        const problems = []
        if (a !== 0) problems.push(`${a} STANDARD cu CLASA != ABC||XYZ`)
        if (b !== 0) problems.push(`${b} NOU/OD fara CLASA corespunzatoare`)
        if (c !== 0) problems.push(`${c} CLASA NOU/OD fara LIFECYCLE corespunzator`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_ROWS} randuri` }
      }
    },
    {
      id: 'warnings',
      label: 'WARN_STOC_MORT / WARN_STOC_NEG / WARN_VZ26_ZERO ca echivalente exacte',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN COALESCE(WARN_STOC_MORT, -1) <> (CASE WHEN ENG_MAX = 0 AND STOC_QTY > 0 THEN 1 ELSE 0 END) THEN 1 ELSE 0 END) AS ABATERI_STOC_MORT,
                  SUM(CASE WHEN COALESCE(WARN_STOC_NEG, -1) <> (CASE WHEN STOC_QTY < 0 THEN 1 ELSE 0 END) THEN 1 ELSE 0 END) AS ABATERI_STOC_NEG,
                  SUM(CASE WHEN COALESCE(WARN_VZ26_ZERO, -1) <> (CASE WHEN COALESCE(VZ_26S, 0) <= 0 THEN 1 ELSE 0 END) THEN 1 ELSE 0 END) AS ABATERI_VZ26_ZERO
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const a = n(row.ABATERI_STOC_MORT) || 0
        const b = n(row.ABATERI_STOC_NEG) || 0
        const c = n(row.ABATERI_VZ26_ZERO) || 0
        const problems = []
        if (a !== 0) problems.push(`${a} WARN_STOC_MORT gresit`)
        if (b !== 0) problems.push(`${b} WARN_STOC_NEG gresit`)
        if (c !== 0) problems.push(`${c} WARN_VZ26_ZERO gresit`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_ROWS} randuri` }
      }
    },
    {
      id: 'det_grp',
      label: 'Fiecare (BRANCH, MTRGROUP) din DET exista in GRP; NR_SKU_GRP corect',
      async run () {
        const [missing] = await execSql(
          `SELECT COUNT(*) AS ABATERI FROM (
             SELECT DISTINCT BRANCH, MTRGROUP FROM CCCMINMAXDET WHERE RUNID = ${runId} AND MTRGROUP IS NOT NULL
           ) dd
           WHERE NOT EXISTS (
             SELECT 1 FROM CCCMINMAXGRP g WHERE g.RUNID = ${runId} AND g.BRANCH = dd.BRANCH AND g.MTRGROUP = dd.MTRGROUP
           )`
        )
        const [mismatch] = await execSql(
          `SELECT COUNT(*) AS ABATERI
           FROM CCCMINMAXGRP g
           WHERE g.RUNID = ${runId}
             AND g.NR_SKU_GRP <> (
               SELECT COUNT(DISTINCT d.MTRL) FROM CCCMINMAXDET d
               WHERE d.RUNID = ${runId} AND d.BRANCH = g.BRANCH AND d.MTRGROUP = g.MTRGROUP
             )`
        )
        const missingCount = n(missing.ABATERI) || 0
        const mismatchCount = n(mismatch.ABATERI) || 0
        const problems = []
        if (missingCount !== 0) problems.push(`${missingCount} perechi (BRANCH,MTRGROUP) lipsa din GRP`)
        if (mismatchCount !== 0) problems.push(`${mismatchCount} grupe cu NR_SKU_GRP gresit`)
        return { pass: problems.length === 0, detail: problems.join('; ') || '0 abateri' }
      }
    },
    {
      id: 'filiale_excluse',
      label: 'Filialele cu INCLUS=0 nu produc BUY_QTY > 0 (de confirmat ca invariant)',
      async run () {
        const rows = await execSql(
          `SELECT b.BRANCH, COUNT(*) AS ROWS_CU_BUY, SUM(d.BUY_QTY) AS TOTAL_BUY_QTY
           FROM CCCMINMAXDET d
           INNER JOIN CCCMINMAXBRANCH b ON b.BRANCH = d.BRANCH
           WHERE d.RUNID = ${runId} AND b.INCLUS = 0 AND COALESCE(d.BUY_QTY, 0) > 0
           GROUP BY b.BRANCH`
        )
        if (!rows.length) return { pass: true, detail: '0 filiale excluse cu BUY_QTY > 0' }
        const detail = rows.map((r) => `BRANCH ${r.BRANCH}: ${r.ROWS_CU_BUY} randuri, ${r.TOTAL_BUY_QTY} buc`).join('; ')
        return { pass: false, detail }
      }
    },
    {
      id: 'calibrare_flag',
      label: 'RAPORTARE (nu pass/fail): % populatie curata in banda FLAG_RATIO 0.50-2.00 (prag client: >80%)',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_POPULATIE_CURATA,
                  SUM(CASE WHEN FLAG_RATIO BETWEEN 0.50 AND 2.00 THEN 1 ELSE 0 END) AS IN_BANDA
           FROM CCCMINMAXDET
           WHERE RUNID = ${runId}
             AND LIFECYCLE IN ('STANDARD', 'NOU')
             AND COALESCE(FLAG_LICHIDARE, 0) = 0
             AND COALESCE(FLAG_BLOCAT, 0) = 0
             AND COALESCE(FLAG_EXCLUS, 0) = 0
             AND ERP_MAX IS NOT NULL AND ERP_MAX <> 0`
        )
        const total = n(row.TOTAL_POPULATIE_CURATA) || 0
        const inBanda = n(row.IN_BANDA) || 0
        const pct = total > 0 ? (100 * inBanda / total) : NaN
        return {
          pass: null,
          detail: total > 0
            ? `${inBanda}/${total} = ${pct.toFixed(1)}% in banda (prag client: >80%)`
            : 'populatie curata goala - nimic de calibrat'
        }
      }
    }
  ]
}

async function main () {
  const requested = process.argv[2] !== undefined ? process.argv[2] : undefined
  const runId = await resolveRunId(requested)
  console.log(`RUNID = ${runId}\n`)

  const invariants = buildInvariants(runId)
  let failed = 0
  for (const inv of invariants) {
    let result
    try {
      result = await inv.run()
    } catch (err) {
      result = { pass: false, detail: `EROARE: ${err.message}` }
    }
    const verdict = result.pass === null ? 'INFO' : (result.pass ? 'PASS' : 'FAIL')
    if (result.pass === false) failed++
    console.log(`[${verdict}] ${inv.id.padEnd(18)} ${inv.label}`)
    console.log(`         ${result.detail}\n`)
  }

  if (failed > 0) {
    console.log(`${failed} invariant(e) cu abateri - vezi FAZA5_REMEDIERI_PLAN.md Pasul 8, nivel A.`)
    process.exitCode = 1
  } else {
    console.log('Toate invariantele PASS (calibrarea FLAG e informativa, nu pass/fail).')
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err)
  process.exitCode = 1
})
