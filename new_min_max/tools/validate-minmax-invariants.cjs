#!/usr/bin/env node
'use strict'

// Faza 5, Pasul 8, nivel A: invariante SQL pe toata populatia unei rulari
// MIN/MAX (FAZA5_REMEDIERI_PLAN.md). Ruleaza direct impotriva CCCMINMAXDET /
// CCCMINMAXGRP / CCCMINMAXBRANCH / CCCMINMAXRUNPARAM prin canalul WSMCP
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

async function loadRunParams (runId) {
  const rows = await execSql(
    `SELECT PARAMKEY, PARAMVALUE FROM CCCMINMAXRUNPARAM WHERE RUNID = ${runId} AND BRANCH = 0 AND PREFIX = ''`
  )
  if (!rows.length) {
    throw new Error(`RUNID ${runId} nu are snapshot in CCCMINMAXRUNPARAM; rularea preceda migrarea si nu poate fi validata contra parametrilor live.`)
  }
  return Object.fromEntries(rows.map((row) => [row.PARAMKEY, row.PARAMVALUE]))
}

function effectivePositiveParam (runParams, key, fallback) {
  const value = Number(runParams[key])
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 10000) / 10000
}

function calibrationMode (runParams) {
  const mode = String(runParams.CALIBRARE_MOD || 'C').trim().toUpperCase()
  if (!new Set(['A', 'B', 'C']).has(mode)) {
    throw new Error(`CALIBRARE_MOD invalid in snapshot: ${runParams.CALIBRARE_MOD}`)
  }
  return mode
}

// Acelasi fallback tacit ca in Compute: o valoare necunoscuta cade pe 13_52,
// baza declarata in S 7, nu opreste validarea.
function trendBase (runParams) {
  const base = String(runParams.TREND_BAZA || '').trim().toUpperCase()
  return new Set(['13_26', '13_52']).has(base) ? base : '13_52'
}

// FERESTRE_VZ_ZILE trebuie sa fie exact 4 intregi pozitivi, separati prin virgula.
function parseFerestreZile (raw) {
  if (typeof raw !== 'string') return null
  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length !== 4) return null
  const values = parts.map(Number)
  if (values.some((value) => !Number.isFinite(value) || !Number.isInteger(value) || value <= 0)) return null
  return values
}

// runId e deja un intreg validat mai sus -> se interpoleaza direct in SQL,
// nu ca parametru legat (acelasi motiv ca la OFFSET/FETCH in
// minmax-engine.class.js: WSMCP nu accepta parametri legati peste tot, si
// e sigur pentru ca nu e input brut de utilizator - vezi conventions.md §6).
function buildInvariants (runId, runParams) {
  const hqCapFactor = effectivePositiveParam(runParams, 'HQ_CAP_FACTOR', 1.5)
  const procentPodeaBuc = effectivePositiveParam(runParams, 'PROCENT_PODEA_BUC', 0.30)
  const nrSaptamani = Math.trunc(effectivePositiveParam(runParams, 'NRSAPT', 52))
  const selectedCalibrationMode = calibrationMode(runParams)
  const selectedTrendBase = trendBase(runParams)
  const trendExpr = selectedTrendBase === '13_26'
    ? '2.0 * VZ_13S / NULLIF(VZ_26S, 0) - 1'
    : '4.0 * VZ_13S / NULLIF(VZ_52S, 0) - 1'

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
      id: 'parametri_branch',
      label: 'T9: LT_ZILE/FRECVENTA_ZILE = override BRANCH din snapshot sau fallback GLOBAL',
      async run () {
        const [row] = await execSql(
          `WITH global_params AS (
             SELECT
               MAX(CASE WHEN PARAMKEY = 'LT_ZILE' THEN TRY_CONVERT(INT, PARAMVALUE) END) AS LT_ZILE,
               MAX(CASE WHEN PARAMKEY = 'FRECVENTA_ZILE' THEN TRY_CONVERT(INT, PARAMVALUE) END) AS FRECVENTA_ZILE
             FROM CCCMINMAXRUNPARAM
             WHERE RUNID = ${runId} AND BRANCH = 0 AND PREFIX = ''
           )
           SELECT COUNT(*) AS TOTAL_ROWS,
             COUNT(DISTINCT CASE WHEN lt.PARAMVALUE IS NOT NULL OR freq.PARAMVALUE IS NOT NULL THEN d.BRANCH END) AS OVERRIDE_BRANCHES,
             SUM(CASE WHEN COALESCE(d.LT_ZILE, -1) <>
               COALESCE(TRY_CONVERT(INT, lt.PARAMVALUE), CASE WHEN gp.LT_ZILE > 0 THEN gp.LT_ZILE ELSE 30 END) THEN 1 ELSE 0 END) AS ABATERI_LT,
             SUM(CASE WHEN COALESCE(d.FRECVENTA_ZILE, -1) <>
               COALESCE(TRY_CONVERT(INT, freq.PARAMVALUE), CASE WHEN gp.FRECVENTA_ZILE > 0 THEN gp.FRECVENTA_ZILE ELSE 14 END) THEN 1 ELSE 0 END) AS ABATERI_FRECVENTA
           FROM CCCMINMAXDET d
           CROSS JOIN global_params gp
           LEFT JOIN CCCMINMAXRUNPARAM lt ON lt.RUNID = d.RUNID AND lt.BRANCH = d.BRANCH
             AND lt.PREFIX = '' AND lt.PARAMKEY = 'LT_ZILE'
           LEFT JOIN CCCMINMAXRUNPARAM freq ON freq.RUNID = d.RUNID AND freq.BRANCH = d.BRANCH
             AND freq.PREFIX = '' AND freq.PARAMKEY = 'FRECVENTA_ZILE'
           WHERE d.RUNID = ${runId}`
        )
        const lt = n(row.ABATERI_LT) || 0
        const frecventa = n(row.ABATERI_FRECVENTA) || 0
        const problems = []
        if (lt !== 0) problems.push(`${lt} randuri cu LT_ZILE gresit`)
        if (frecventa !== 0) problems.push(`${frecventa} randuri cu FRECVENTA_ZILE gresita`)
        return {
          pass: problems.length === 0,
          detail: problems.join('; ') || `0 abateri din ${row.TOTAL_ROWS} randuri; ${row.OVERRIDE_BRANCHES || 0} filiale cu override`
        }
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
                AND d.ENG_MAX <> CEILING(d.SUM_BR_MAX * ${hqCapFactor}) THEN 1 ELSE 0 END) AS ABATERI_APLICAT,
                  SUM(CASE WHEN d.ESTE_HQ = 1 AND COALESCE(d.HQ_CAP_APLICAT, 0) = 0
                AND d.SUM_BR_MAX > 0 AND d.ENG_MAX > CEILING(d.SUM_BR_MAX * ${hqCapFactor}) THEN 1 ELSE 0 END) AS ABATERI_NEAPLICAT
           FROM CCCMINMAXDET d
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
                    AND d.ENG_MIN < CEILING(hq.ENG_MIN * ${procentPodeaBuc}) - 0.0001 THEN 1 ELSE 0 END) AS ABATERI_SUB_PODEA,
                  COUNT(DISTINCT CASE WHEN b.BRANCH IS NOT NULL AND b.ESTE_PODEA <> d.ESTE_PODEA THEN d.BRANCH END) AS BRANCHES_CONFIG_MISMATCH
           FROM CCCMINMAXDET d
           LEFT JOIN CCCMINMAXDET hq ON hq.RUNID = d.RUNID AND hq.MTRL = d.MTRL AND hq.ESTE_HQ = 1
           LEFT JOIN CCCMINMAXBRANCH b ON b.BRANCH = d.BRANCH
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
      id: 'od_buy',
      label: 'E1 + S 4.7: LIFECYCLE=OD => BUY_RAW = BUY_QTY = 0, inclusiv pe randurile ridicate de podea',
      async run () {
        const [row] = await execSql(
          `SELECT SUM(CASE WHEN LIFECYCLE = 'OD' THEN 1 ELSE 0 END) AS TOTAL_OD_ROWS,
                  SUM(CASE WHEN LIFECYCLE = 'OD' AND COALESCE(BUY_QTY, 0) <> 0 THEN 1 ELSE 0 END) AS ABATERI_BUY_QTY,
                  SUM(CASE WHEN LIFECYCLE = 'OD' AND COALESCE(BUY_RAW, 0) <> 0 THEN 1 ELSE 0 END) AS ABATERI_BUY_RAW,
                  SUM(CASE WHEN LIFECYCLE = 'OD' AND PODEA_APLICATA = 1 AND COALESCE(BUY_QTY, 0) <> 0 THEN 1 ELSE 0 END) AS ABATERI_PODEA
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const buyQty = n(row.ABATERI_BUY_QTY) || 0
        const buyRaw = n(row.ABATERI_BUY_RAW) || 0
        const podea = n(row.ABATERI_PODEA) || 0
        const problems = []
        if (buyQty !== 0) problems.push(`${buyQty} randuri OD cu BUY_QTY <> 0 (din care ${podea} pe podea)`)
        if (buyRaw !== 0) problems.push(`${buyRaw} randuri OD cu BUY_RAW <> 0`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_OD_ROWS || 0} randuri OD` }
      }
    },
    {
      id: 'recenta',
      label: `S 4.6: SAPT_FARA = round(zile de la ULT_VANZ / 7); fara vanzare => ${nrSaptamani}`,
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN ULT_VANZ IS NOT NULL
                    AND SAPT_FARA <> CONVERT(INT, ROUND(DATEDIFF(DAY, ULT_VANZ, AZI) / 7.0, 0)) THEN 1 ELSE 0 END) AS ABATERI_CU_VANZARE,
                  SUM(CASE WHEN ULT_VANZ IS NULL AND SAPT_FARA <> ${nrSaptamani} THEN 1 ELSE 0 END) AS ABATERI_FARA_VANZARE
           FROM CCCMINMAXDET WHERE RUNID = ${runId}`
        )
        const cuVanzare = n(row.ABATERI_CU_VANZARE) || 0
        const faraVanzare = n(row.ABATERI_FARA_VANZARE) || 0
        const problems = []
        if (cuVanzare !== 0) problems.push(`${cuVanzare} randuri cu SAPT_FARA diferit de round(zile/7)`)
        if (faraVanzare !== 0) problems.push(`${faraVanzare} randuri fara ULT_VANZ si SAPT_FARA <> ${nrSaptamani}`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 abateri din ${row.TOTAL_ROWS} randuri` }
      }
    },
    {
      id: 'ferestre_zile',
      label: 'N04a: snapshot NRZILE/FERESTRE_VZ/FERESTRE_VZ_ZILE/FERESTRE_CAPAT; pe FERESTRE_VZ=ZILE, VZ_4S se re-deriva din sursa VIE numai daca ancora vie (MAX(AZI)) mai coincide cu AZI inghetat al rularii, altfel comparatia se sare (nu esueaza), fiindca sursa a avansat de la rulare',
      async run () {
        const problems = []
        // Spre deosebire de trendBase: lipsa unei chei aici e ABATERE, nu fallback tacit -
        // rularile dinainte de N04a nu au aceste chei si trebuie sa pice, la fel ca `trend` pe RUNID <= 15.
        const missingKeys = ['NRZILE', 'FERESTRE_VZ', 'FERESTRE_VZ_ZILE', 'FERESTRE_CAPAT']
          .filter((key) => runParams[key] === undefined || runParams[key] === null)
        if (missingKeys.length) problems.push(`chei lipsa din snapshot: ${missingKeys.join(', ')}`)

        const ferestreVz = String(runParams.FERESTRE_VZ || '').trim().toUpperCase()
        const ferestreCapat = runParams.  FERESTRE_CAPAT
        const nrZile = Number(runParams.NRZILE)
        const ferestreZile = parseFerestreZile(runParams.FERESTRE_VZ_ZILE)

        if (!missingKeys.includes('FERESTRE_CAPAT') && ferestreCapat !== '[0,N)') {
          problems.push(`FERESTRE_CAPAT = ${ferestreCapat} (asteptat '[0,N)')`)
        }
        if (!missingKeys.includes('FERESTRE_VZ') && !['ZILE', 'SAPT'].includes(ferestreVz)) {
          problems.push(`FERESTRE_VZ = ${runParams.FERESTRE_VZ} (asteptat ZILE sau SAPT)`)
        }
        if (!missingKeys.includes('FERESTRE_VZ_ZILE') && !ferestreZile) {
          problems.push(`FERESTRE_VZ_ZILE = ${runParams.FERESTRE_VZ_ZILE} (asteptate exact 4 intregi pozitivi)`)
        }
        if (ferestreZile && !missingKeys.includes('NRZILE') && ferestreZile.some((value) => value > nrZile)) {
          problems.push(`FERESTRE_VZ_ZILE ${runParams.FERESTRE_VZ_ZILE} depaseste NRZILE ${nrZile}`)
        }

        if (problems.length) return { pass: false, detail: problems.join('; ') }

        if (ferestreVz !== 'ZILE') {
          return {
            pass: true,
            detail: `snapshot OK; verificarea pe date nu se aplica in modul ${ferestreVz} (numai FERESTRE_VZ=ZILE re-deriva din sursa)`
          }
        }

        const modAtribuireRaw = String(runParams.MOD_ATRIBUIRE_FILIALA || '').trim().toUpperCase()
        const modAtribuire = ['DOC', 'AGENT', 'CLIENT'].includes(modAtribuireRaw) ? modAtribuireRaw : 'CLIENT'
        const window1Days = ferestreZile[0]

        // Precondition: AZI e derivat din MAX(TRNDATE) pe date vii (00c_sales_lines.sql), deci
        // orice vanzare inregistrata dupa rularea inghetata muta ancora inainte si produce
        // abateri care nu sunt regresii. Comparam ancora vie (@AziOverride = NULL) cu AZI
        // inghetat al rularii inainte sa rulam comparatia exacta.
        const [anchorRow] = await execSql(
          `SELECT
             CONVERT(VARCHAR(10), (SELECT MAX(AZI) FROM dbo.ufn_MinMaxSalesLines(${COMPANY}, '${modAtribuire}', ${nrZile}, NULL)), 120) AS AZI_LIVE,
             CONVERT(VARCHAR(10), (SELECT AZI FROM CCCMINMAXRUN WHERE RUNID = ${runId}), 120) AS AZI_INGHETAT`
        )
        const aziLive = anchorRow && anchorRow.AZI_LIVE
        const aziInghetat = anchorRow && anchorRow.AZI_INGHETAT

        if (aziLive && aziInghetat && aziLive > aziInghetat) {
          return {
            pass: true,
            detail: `sursa vie a avansat de la rulare (AZI viu = ${aziLive}, AZI inghetat = ${aziInghetat}); comparatia exacta VZ_4S nu mai e posibila`
          }
        }

        const [row] = await execSql(
          `WITH ActiveBranches AS (
             SELECT b.BRANCH
             FROM CCCMINMAXBRANCH b
             WHERE b.INCLUS = 1 AND b.ESTE_HQ = 0
               AND EXISTS (
                 SELECT 1 FROM WHOUSE w
                 WHERE w.CCCBRANCH = b.BRANCH AND w.COMPANY = ${COMPANY} AND w.ISACTIVE = 1
               )
           ),
           SourceLines AS (
             SELECT sl.BRANCH, sl.TRDR, sl.MTRL, sl.QTY
             FROM dbo.ufn_MinMaxSalesLines(${COMPANY}, '${modAtribuire}', ${nrZile},
                 (SELECT AZI FROM CCCMINMAXRUN WHERE RUNID = ${runId})) sl
             INNER JOIN ActiveBranches ab ON ab.BRANCH = sl.BRANCH
             WHERE DATEDIFF(DAY, sl.TRNDATE, sl.AZI) < ${window1Days}
           ),
           WinsorizedLines AS (
             SELECT sl.BRANCH, sl.TRDR, sl.MTRL,
               CASE
                 WHEN sl.QTY <= 0 THEN sl.QTY
                 WHEN w.PRAG_APLICAT = 'P95' AND sl.QTY > w.P95_QTY THEN w.P95_QTY
                 WHEN w.PRAG_APLICAT = 'MEDIANA' AND sl.QTY > w.MEDIAN_QTY THEN w.MEDIAN_QTY
                 ELSE sl.QTY
               END AS WINSORIZED_QTY
             FROM SourceLines sl
             LEFT JOIN CCCMINMAXWINSOR w ON w.RUNID = ${runId} AND w.MTRL = sl.MTRL
           ),
           ClientNet AS (
             SELECT BRANCH, TRDR, MTRL,
               CASE WHEN SUM(WINSORIZED_QTY) < 0 THEN 0 ELSE SUM(WINSORIZED_QTY) END AS NET_QTY
             FROM WinsorizedLines
             GROUP BY BRANCH, TRDR, MTRL
           ),
           LiveTotals AS (
             SELECT BRANCH, MTRL, CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS VZ_4S_LIVE
             FROM ClientNet
             GROUP BY BRANCH, MTRL
           ),
           DetTotals AS (
             SELECT d.BRANCH, d.MTRL, d.VZ_4S
             FROM CCCMINMAXDET d
             INNER JOIN ActiveBranches ab ON ab.BRANCH = d.BRANCH
             WHERE d.RUNID = ${runId}
           )
           SELECT
             COUNT(*) AS TOTAL_COMPARAT,
             SUM(CASE WHEN ABS(COALESCE(live.VZ_4S_LIVE, 0) - COALESCE(det.VZ_4S, 0)) > 0.00000001 THEN 1 ELSE 0 END) AS ABATERI,
             SUM(CASE WHEN live.BRANCH IS NULL THEN 1 ELSE 0 END) AS LIPSA_IN_LIVE,
             SUM(CASE WHEN det.BRANCH IS NULL THEN 1 ELSE 0 END) AS LIPSA_IN_DET
           FROM LiveTotals live
           FULL OUTER JOIN DetTotals det ON det.BRANCH = live.BRANCH AND det.MTRL = live.MTRL`
        )

        const abateri = n(row.ABATERI) || 0
        const total = n(row.TOTAL_COMPARAT) || 0
        const lipsaLive = n(row.LIPSA_IN_LIVE) || 0
        const lipsaDet = n(row.LIPSA_IN_DET) || 0
        return {
          pass: abateri === 0,
          detail: `${abateri} abateri din ${total} perechi (BRANCH, MTRL) comparate ` +
            `(${lipsaLive} absente din re-derivare, ${lipsaDet} absente din CCCMINMAXDET)`
        }
      }
    },
    {
      id: 'grila_sapt',
      label: 'N04b: snapshot GRILA_SAPT/BAZA_SAPT_VZ; S 5.1 WEEK_INDEX persistat pe grila rolling de 7 zile, S 4.6 SAPT_VZ pe baza ISO',
      async run () {
        const problems = []
        // La fel ca ferestre_zile: lipsa cheilor aici e ABATERE (rularile dinainte de N04b
        // trebuie sa pice aceasta invarianta), nu un fallback tacit spre valorile implicite.
        const missingKeys = ['GRILA_SAPT', 'BAZA_SAPT_VZ']
          .filter((key) => runParams[key] === undefined || runParams[key] === null)
        if (missingKeys.length) problems.push(`chei lipsa din snapshot: ${missingKeys.join(', ')}`)

        const grilaSapt = String(runParams.GRILA_SAPT || '').trim().toUpperCase()
        const bazaSaptVz = String(runParams.BAZA_SAPT_VZ || '').trim().toUpperCase()

        if (!missingKeys.includes('GRILA_SAPT') && !['ROLLING', 'CALENDAR'].includes(grilaSapt)) {
          problems.push(`GRILA_SAPT = ${runParams.GRILA_SAPT} (asteptat ROLLING sau CALENDAR)`)
        }
        if (!missingKeys.includes('BAZA_SAPT_VZ') && !['ISO', 'GRILA'].includes(bazaSaptVz)) {
          problems.push(`BAZA_SAPT_VZ = ${runParams.BAZA_SAPT_VZ} (asteptat ISO sau GRILA)`)
        }

        if (problems.length) return { pass: false, detail: problems.join('; ') }

        const [boundsRow] = await execSql(
          `SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN WEEK_INDEX < 0 OR WEEK_INDEX >= ${nrSaptamani} THEN 1 ELSE 0 END) AS ABATERI_INTERVAL
           FROM CCCMINMAXWEEK WHERE RUNID = ${runId}`
        )
        const abateriInterval = n(boundsRow.ABATERI_INTERVAL) || 0
        if (abateriInterval !== 0) {
          problems.push(`${abateriInterval} randuri CCCMINMAXWEEK.WEEK_INDEX in afara [0, ${nrSaptamani})`)
        }

        if (bazaSaptVz === 'ISO') {
          const [saptRow] = await execSql(
            `SELECT COUNT(*) AS TOTAL_ROWS,
                    SUM(CASE WHEN SAPT_VZ > ${nrSaptamani} THEN 1 ELSE 0 END) AS ABATERI
             FROM CCCMINMAXDET WHERE RUNID = ${runId}`
          )
          const abateriSapt = n(saptRow.ABATERI) || 0
          if (abateriSapt !== 0) problems.push(`${abateriSapt} randuri DET.SAPT_VZ > ${nrSaptamani}`)
        }

        if (problems.length) return { pass: false, detail: problems.join('; ') }

        if (grilaSapt !== 'ROLLING') {
          return {
            pass: true,
            detail: `snapshot si praguri OK; re-derivarea bucket-urilor nu se aplica in modul ${grilaSapt} (numai GRILA_SAPT=ROLLING re-deriva din sursa)`
          }
        }

        const modAtribuireRaw = String(runParams.MOD_ATRIBUIRE_FILIALA || '').trim().toUpperCase()
        const modAtribuire = ['DOC', 'AGENT', 'CLIENT'].includes(modAtribuireRaw) ? modAtribuireRaw : 'CLIENT'
        const nrZileRun = Number(runParams.NRZILE) > 0 ? Number(runParams.NRZILE) : 365

        // Acelasi precondition ca la ferestre_zile: AZI e derivat din MAX(TRNDATE) pe date vii,
        // deci vanzarile inregistrate dupa rularea inghetata muta ancora inainte.
        const [anchorRow] = await execSql(
          `SELECT
             CONVERT(VARCHAR(10), (SELECT MAX(AZI) FROM dbo.ufn_MinMaxSalesLines(${COMPANY}, '${modAtribuire}', ${nrZileRun}, NULL)), 120) AS AZI_LIVE,
             CONVERT(VARCHAR(10), (SELECT AZI FROM CCCMINMAXRUN WHERE RUNID = ${runId}), 120) AS AZI_INGHETAT`
        )
        const aziLive = anchorRow && anchorRow.AZI_LIVE
        const aziInghetat = anchorRow && anchorRow.AZI_INGHETAT

        if (aziLive && aziInghetat && aziLive > aziInghetat) {
          return {
            pass: true,
            detail: `sursa vie a avansat de la rulare (AZI viu = ${aziLive}, AZI inghetat = ${aziInghetat}); comparatia exacta a bucket-urilor nu mai e posibila`
          }
        }

        const [row] = await execSql(
          `WITH ActiveBranches AS (
             SELECT b.BRANCH
             FROM CCCMINMAXBRANCH b
             WHERE b.INCLUS = 1 AND b.ESTE_HQ = 0
               AND EXISTS (
                 SELECT 1 FROM WHOUSE w
                 WHERE w.CCCBRANCH = b.BRANCH AND w.COMPANY = ${COMPANY} AND w.ISACTIVE = 1
               )
           ),
           SourceLines AS (
             SELECT sl.BRANCH, sl.TRDR, sl.MTRL, sl.QTY,
               DATEDIFF(DAY, sl.TRNDATE, sl.AZI) / 7 AS WEEK_BUCKET
             FROM dbo.ufn_MinMaxSalesLines(${COMPANY}, '${modAtribuire}', ${nrZileRun},
                 (SELECT AZI FROM CCCMINMAXRUN WHERE RUNID = ${runId})) sl
             INNER JOIN ActiveBranches ab ON ab.BRANCH = sl.BRANCH
             WHERE DATEDIFF(DAY, sl.TRNDATE, sl.AZI) >= 0 AND DATEDIFF(DAY, sl.TRNDATE, sl.AZI) < ${nrSaptamani} * 7
           ),
           WinsorizedLines AS (
             SELECT sl.BRANCH, sl.TRDR, sl.MTRL, sl.WEEK_BUCKET,
               CASE
                 WHEN sl.QTY <= 0 THEN sl.QTY
                 WHEN w.PRAG_APLICAT = 'P95' AND sl.QTY > w.P95_QTY THEN w.P95_QTY
                 WHEN w.PRAG_APLICAT = 'MEDIANA' AND sl.QTY > w.MEDIAN_QTY THEN w.MEDIAN_QTY
                 ELSE sl.QTY
               END AS WINSORIZED_QTY
             FROM SourceLines sl
             LEFT JOIN CCCMINMAXWINSOR w ON w.RUNID = ${runId} AND w.MTRL = sl.MTRL
           ),
           ClientNet AS (
             SELECT BRANCH, TRDR, MTRL, WEEK_BUCKET,
               CASE WHEN SUM(WINSORIZED_QTY) < 0 THEN 0 ELSE SUM(WINSORIZED_QTY) END AS NET_QTY
             FROM WinsorizedLines
             GROUP BY BRANCH, TRDR, MTRL, WEEK_BUCKET
           ),
           LiveTotals AS (
             SELECT BRANCH, MTRL, WEEK_BUCKET, CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS QTY_LIVE
             FROM ClientNet
             GROUP BY BRANCH, MTRL, WEEK_BUCKET
           ),
           DetTotals AS (
             SELECT w.BRANCH, w.MTRL, w.WEEK_INDEX AS WEEK_BUCKET, w.QTY
             FROM CCCMINMAXWEEK w
             INNER JOIN ActiveBranches ab ON ab.BRANCH = w.BRANCH
             WHERE w.RUNID = ${runId}
           )
           SELECT
             COUNT(*) AS TOTAL_COMPARAT,
             SUM(CASE WHEN ABS(COALESCE(live.QTY_LIVE, 0) - COALESCE(det.QTY, 0)) > 0.00000001 THEN 1 ELSE 0 END) AS ABATERI,
             SUM(CASE WHEN live.BRANCH IS NULL THEN 1 ELSE 0 END) AS LIPSA_IN_LIVE,
             SUM(CASE WHEN det.BRANCH IS NULL THEN 1 ELSE 0 END) AS LIPSA_IN_DET
           FROM LiveTotals live
           FULL OUTER JOIN DetTotals det
             ON det.BRANCH = live.BRANCH AND det.MTRL = live.MTRL AND det.WEEK_BUCKET = live.WEEK_BUCKET`
        )

        const abateri = n(row.ABATERI) || 0
        const total = n(row.TOTAL_COMPARAT) || 0
        const lipsaLive = n(row.LIPSA_IN_LIVE) || 0
        const lipsaDet = n(row.LIPSA_IN_DET) || 0
        return {
          pass: abateri === 0,
          detail: `${abateri} abateri din ${total} perechi (BRANCH, MTRL, WEEK_INDEX) comparate ` +
            `(${lipsaLive} absente din re-derivare, ${lipsaDet} absente din CCCMINMAXWEEK)`
        }
      }
    },
    {
      id: 'trend',
      label: `P11 + S 7: TREND_PCT pe baza ${selectedTrendBase}, ca fractie; STATUS_TREND din praguri, cu NOU/OD prioritare`,
      async run () {
        const [row] = await execSql(
          `WITH asteptat AS (
             SELECT TREND_PCT, STATUS_TREND, LIFECYCLE, VZ_13S,
                    CONVERT(DECIMAL(28, 8), ${trendExpr}) AS TREND_ASTEPTAT
             FROM CCCMINMAXDET WHERE RUNID = ${runId}
           )
           SELECT COUNT(*) AS TOTAL_ROWS,
                  SUM(CASE WHEN TREND_PCT IS NULL AND TREND_ASTEPTAT IS NULL THEN 0
                           WHEN TREND_PCT IS NULL OR TREND_ASTEPTAT IS NULL THEN 1
                           WHEN ABS(TREND_PCT - TREND_ASTEPTAT) > 0.00000001 THEN 1
                           ELSE 0 END) AS ABATERI_FORMULA,
                  SUM(CASE WHEN LIFECYCLE = 'NOU' AND STATUS_TREND <> 'NOU' THEN 1 ELSE 0 END) AS ABATERI_NOU,
                  SUM(CASE WHEN LIFECYCLE = 'OD' AND STATUS_TREND <> 'OK' THEN 1 ELSE 0 END) AS ABATERI_OD,
                  SUM(CASE WHEN LIFECYCLE NOT IN ('NOU', 'OD') AND STATUS_TREND <> (
                        CASE
                          WHEN TREND_PCT IS NULL THEN 'DECLINE'
                          WHEN TREND_PCT > 0.10 THEN 'ACTIVE'
                          WHEN TREND_PCT >= -0.10 THEN 'STABLE'
                          WHEN TREND_PCT >= -0.30 THEN 'TREND_DOWN'
                          ELSE 'DECLINE'
                        END) THEN 1 ELSE 0 END) AS ABATERI_PRAGURI,
                  SUM(CASE WHEN LIFECYCLE NOT IN ('NOU', 'OD') AND COALESCE(VZ_13S, 0) <= 0
                    AND STATUS_TREND <> 'DECLINE' THEN 1 ELSE 0 END) AS ABATERI_VZ13_ZERO
           FROM asteptat`
        )
        const formula = n(row.ABATERI_FORMULA) || 0
        const nou = n(row.ABATERI_NOU) || 0
        const od = n(row.ABATERI_OD) || 0
        const praguri = n(row.ABATERI_PRAGURI) || 0
        const vz13 = n(row.ABATERI_VZ13_ZERO) || 0
        const problems = []
        if (formula !== 0) problems.push(`${formula} randuri cu TREND_PCT diferit de baza ${selectedTrendBase}`)
        if (nou !== 0) problems.push(`${nou} randuri NOU fara STATUS_TREND='NOU'`)
        if (od !== 0) problems.push(`${od} randuri OD fara STATUS_TREND='OK'`)
        if (praguri !== 0) problems.push(`${praguri} randuri cu STATUS_TREND in afara pragurilor`)
        if (vz13 !== 0) problems.push(`${vz13} randuri cu VZ_13S = 0 si STATUS_TREND <> 'DECLINE'`)
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
      id: 'vz_grp_det',
      label: 'Reconciliere grupa <-> SKU: SUM(DET.VZ_*/VAL_52S) = GRP.VZ_*/VAL_52S',
      async run () {
        // Esueaza intentionat pe RUNID <= 25, rulari dinainte de 1c: 313/602 grupe nereconciliate.
        const [row] = await execSql(
          `WITH grp_rows AS (
             SELECT BRANCH, MTRGROUP, VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S
             FROM CCCMINMAXGRP WHERE RUNID = ${runId}
           ),
           det_agg AS (
             SELECT BRANCH, MTRGROUP,
                    SUM(COALESCE(VZ_4S, 0)) AS VZ_4S,
                    SUM(COALESCE(VZ_13S, 0)) AS VZ_13S,
                    SUM(COALESCE(VZ_26S, 0)) AS VZ_26S,
                    SUM(COALESCE(VZ_52S, 0)) AS VZ_52S,
                    SUM(COALESCE(VAL_52S, 0)) AS VAL_52S
             FROM CCCMINMAXDET WHERE RUNID = ${runId} AND MTRGROUP IS NOT NULL
             GROUP BY BRANCH, MTRGROUP
           )
           SELECT COUNT(*) AS TOTAL_GRUPE,
                  SUM(CASE WHEN ABS(COALESCE(g.VZ_4S, 0) - COALESCE(d.VZ_4S, 0)) > 0.00001 THEN 1 ELSE 0 END) AS ABATERI_VZ_4S,
                  SUM(CASE WHEN ABS(COALESCE(g.VZ_13S, 0) - COALESCE(d.VZ_13S, 0)) > 0.00001 THEN 1 ELSE 0 END) AS ABATERI_VZ_13S,
                  SUM(CASE WHEN ABS(COALESCE(g.VZ_26S, 0) - COALESCE(d.VZ_26S, 0)) > 0.00001 THEN 1 ELSE 0 END) AS ABATERI_VZ_26S,
                  SUM(CASE WHEN ABS(COALESCE(g.VZ_52S, 0) - COALESCE(d.VZ_52S, 0)) > 0.00001 THEN 1 ELSE 0 END) AS ABATERI_VZ_52S,
                  SUM(CASE WHEN ABS(COALESCE(g.VAL_52S, 0) - COALESCE(d.VAL_52S, 0)) > 0.00001 THEN 1 ELSE 0 END) AS ABATERI_VAL_52S
           FROM grp_rows g
           LEFT JOIN det_agg d ON d.BRANCH = g.BRANCH AND d.MTRGROUP = g.MTRGROUP`
        )
        const vz4s = n(row.ABATERI_VZ_4S) || 0
        const vz13s = n(row.ABATERI_VZ_13S) || 0
        const vz26s = n(row.ABATERI_VZ_26S) || 0
        const vz52s = n(row.ABATERI_VZ_52S) || 0
        const val52s = n(row.ABATERI_VAL_52S) || 0
        const total = n(row.TOTAL_GRUPE) || 0
        const problems = []
        if (vz4s !== 0) problems.push(`${vz4s} grupe cu VZ_4S nereconciliat`)
        if (vz13s !== 0) problems.push(`${vz13s} grupe cu VZ_13S nereconciliat`)
        if (vz26s !== 0) problems.push(`${vz26s} grupe cu VZ_26S nereconciliat`)
        if (vz52s !== 0) problems.push(`${vz52s} grupe cu VZ_52S nereconciliat`)
        if (val52s !== 0) problems.push(`${val52s} grupe cu VAL_52S nereconciliat`)
        return { pass: problems.length === 0, detail: problems.join('; ') || `0 grupe nereconciliate din ${total}` }
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
      id: 'calibrare_a',
      label: 'RAPORTARE A (nu pass/fail): FLAG_RATIO 0.50-2.00 pe populatia curata',
      primary: selectedCalibrationMode === 'A',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_POPULATIE_CURATA,
                  SUM(CASE WHEN FLAG_RATIO BETWEEN 0.50 AND 2.00 THEN 1 ELSE 0 END) AS IN_CRITERIU
           FROM CCCMINMAXDET
           WHERE RUNID = ${runId}
             AND LIFECYCLE IN ('STANDARD', 'NOU')
             AND COALESCE(FLAG_LICHIDARE, 0) = 0
             AND COALESCE(FLAG_BLOCAT, 0) = 0
             AND COALESCE(FLAG_EXCLUS, 0) = 0
             AND ERP_MAX IS NOT NULL AND ERP_MAX <> 0`
        )
        const total = n(row.TOTAL_POPULATIE_CURATA) || 0
        const inCriteriu = n(row.IN_CRITERIU) || 0
        const pct = total > 0 ? (100 * inCriteriu / total) : NaN
        return {
          pass: null,
          detail: total > 0
            ? `${inCriteriu}/${total} = ${pct.toFixed(1)}% in criteriu`
            : 'populatie curata goala - nimic de calibrat'
        }
      }
    },
    {
      id: 'calibrare_b',
      label: "RAPORTARE B (nu pass/fail): FLAG_TXT='OK' pe populatia curata",
      primary: selectedCalibrationMode === 'B',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_POPULATIE_CURATA,
                  SUM(CASE WHEN FLAG_TXT = 'OK' THEN 1 ELSE 0 END) AS IN_CRITERIU
           FROM CCCMINMAXDET
           WHERE RUNID = ${runId}
             AND LIFECYCLE IN ('STANDARD', 'NOU')
             AND COALESCE(FLAG_LICHIDARE, 0) = 0
             AND COALESCE(FLAG_BLOCAT, 0) = 0
             AND COALESCE(FLAG_EXCLUS, 0) = 0
             AND ERP_MAX IS NOT NULL AND ERP_MAX <> 0`
        )
        const total = n(row.TOTAL_POPULATIE_CURATA) || 0
        const inCriteriu = n(row.IN_CRITERIU) || 0
        const pct = total > 0 ? (100 * inCriteriu / total) : NaN
        return {
          pass: null,
          detail: total > 0
            ? `${inCriteriu}/${total} = ${pct.toFixed(1)}% in criteriu`
            : 'populatie curata goala - nimic de calibrat'
        }
      }
    },
    {
      id: 'calibrare_c',
      label: "RAPORTARE C (nu pass/fail): FLAG_TXT='OK' pe toate randurile cu ERP_MAX > 0",
      primary: selectedCalibrationMode === 'C',
      async run () {
        const [row] = await execSql(
          `SELECT COUNT(*) AS TOTAL_POPULATIE_S8,
                  SUM(CASE WHEN FLAG_TXT = 'OK' THEN 1 ELSE 0 END) AS IN_CRITERIU
           FROM CCCMINMAXDET
           WHERE RUNID = ${runId}
             AND ERP_MAX > 0`
        )
        const total = n(row.TOTAL_POPULATIE_S8) || 0
        const inCriteriu = n(row.IN_CRITERIU) || 0
        const pct = total > 0 ? (100 * inCriteriu / total) : NaN
        return {
          pass: null,
          detail: total > 0
            ? `${inCriteriu}/${total} = ${pct.toFixed(1)}% in criteriu S 8`
            : 'populatie S 8 goala - nimic de calibrat'
        }
      }
    }
  ]
}

async function main () {
  loadDotEnvIfPresent()
  const requested = process.argv[2] !== undefined ? process.argv[2] : undefined
  const runId = await resolveRunId(requested)
  const runParams = await loadRunParams(runId)
  const selectedCalibrationMode = calibrationMode(runParams)
  console.log(`RUNID = ${runId}`)
  console.log(`CALIBRARE_MOD = ${selectedCalibrationMode} (metrica ${selectedCalibrationMode} este PRINCIPALA)\n`)

  const invariants = buildInvariants(runId, runParams)
  let failed = 0
  for (const inv of invariants) {
    let result
    try {
      result = await inv.run()
    } catch (err) {
      result = { pass: false, detail: `EROARE: ${err.message}` }
    }
    const verdict = result.pass === null ? (inv.primary ? 'PRINCIPALA' : 'INFO') : (result.pass ? 'PASS' : 'FAIL')
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

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message || err)
    process.exitCode = 1
  })
}

module.exports = { buildInvariants, calibrationMode, effectivePositiveParam, trendBase }
