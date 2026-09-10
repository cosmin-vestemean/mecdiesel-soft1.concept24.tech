// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html
//
// Read-only (except saveParams/runEngine/abandonRun/purgeRun) window onto the
// MIN/MAX v5 engine. Two transports, kept deliberately separate (FAZA6_CONTRACT.md
// §3): plain SELECT (and, for saveParams, whitelisted INSERT/UPDATE) statements
// go to /JS/WSMCP/execSql; the four state-changing operations instead call
// fixed-shape /JS/NewMinMax/<endpoint> AJS functions — never a generic EXEC
// gateway, never SQL text built here. authKey (execSql transport) lives only
// in server config (env-backed), never in the browser; the AJS transport
// needs no shared secret, only the caller's own S1 session token.
//
// ATENTIE: niciuna dintre operatiile de mai sus scrie in ERP. applyToErp (Faza 4,
// new_min_max/FAZA4_CONTRACT.md) NU e implementat aici, deliberat: A NU SE SALVA
// IN ERP DATELE MIN/MAX PANA NU AVEM APROBARE DE LA BENEFICIAR.

import { Forbidden } from '@feathersjs/errors'
import rp from 'request-promise'
import { classifySql } from './sql-guard.js'
import { logger } from '../../logger.js'
// Shared with public/components/branch-replenishment-container.js — lives
// under public/ (the only tree served to the browser) and is reached here
// via a plain relative filesystem import, not a bundler alias.
import { isSoftOneErrorRetryable, describeSoftOneError } from '../../../public/shared/softone-error-codes.js'

const DEFAULT_S1_BASE_URL = 'https://mecdiesel.oncloud.gr/s1services'
const DEFAULT_S1_APP_ID = '2002'
const COMPANY = 1000
const MAX_PARAMS = 20
const MAX_PAGE_SIZE = 500
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_HISTORY_LIMIT = 20
const MAX_HISTORY_LIMIT = 50
// Row-count cap per saveParams() collection, checked before any SQL is
// composed (FAZA5_CONTRACT.md §12.2). Generous relative to the real table
// sizes (33 COV rows, 18 branches) — this guards against a malformed/huge
// payload, not against legitimate use.
const MAX_BATCH_ROWS = 500

// API filter/sort field -> CCCMINMAXDET column. The ONLY source of SQL
// identifiers accepted for results(); never built from request input.
const DET_COLUMNS = {
  branch: 'd.BRANCH',
  mtrl: 'd.MTRL',
  code: 'd.CODE',
  esteHq: 'd.ESTE_HQ',
  mtrgroup: 'd.MTRGROUP',
  lifecycle: 'd.LIFECYCLE',
  abc: 'd.ABC',
  xyz: 'd.XYZ',
  clasa: 'd.CLASA',
  flagTxt: 'd.FLAG_TXT',
  statusTrend: 'd.STATUS_TREND',
  hqCapAplicat: 'd.HQ_CAP_APLICAT',
  podeaAplicata: 'd.PODEA_APLICATA',
  arePozitieErp: 'd.ARE_POZITIE_ERP',
  discFlag: 'd.DISC_FLAG',
  flagLichidare: 'd.FLAG_LICHIDARE',
  flagBlocat: 'd.FLAG_BLOCAT',
  flagExclus: 'd.FLAG_EXCLUS',
  warnVz26Zero: 'd.WARN_VZ26_ZERO',
  warnStocNeg: 'd.WARN_STOC_NEG',
  warnStocMort: 'd.WARN_STOC_MORT',
  warnGrupaMica: 'd.WARN_GRUPA_MICA',
  engMin: 'd.ENG_MIN',
  engMax: 'd.ENG_MAX',
  buyQty: 'd.BUY_QTY',
  stocQty: 'd.STOC_QTY',
  ordFurn: 'd.ORD_FURN',
  acopCur: 'd.ACOP_CUR',
  flagRatio: 'd.FLAG_RATIO',
  cv: 'd.CV',
  avg: 'd.[AVG]',
  vz52s: 'd.VZ_52S',
  vz26s: 'd.VZ_26S',
  val52s: 'd.VAL_52S'
}

// CCCMINMAXDET declares COV_TGT/SL/SSF as DECIMAL(10, 4), and WSMCP's dataset
// serializer rounds that declaration to whole numbers (2.7500 -> 3, 1.2800 -> 1)
// while DECIMAL(28, 8) columns round-trip intact. They are therefore re-read
// under an alias and merged back over the rounded originals. Verified live
// 08.09.2026 on RUNID=5; the stored values themselves are correct.
const EXACT_DECIMAL_COLUMNS = ['COV_TGT', 'SL', 'SSF']
const EXACT_DECIMAL_ALIAS_SUFFIX = '__EXACT'
const EXACT_DECIMAL_SELECT = EXACT_DECIMAL_COLUMNS
  .map((column) => `CONVERT(DECIMAL(28, 8), d.${column}) AS ${column}${EXACT_DECIMAL_ALIAS_SUFFIX}`)
  .join(', ')

// The persisted name is a snapshot from the calculation run. Read the current
// ERP group name for display, while keeping the snapshot as a fallback when a
// group was removed from MTRGROUP after the run.
const MTRGROUP_NAME_ALIAS = 'MTRGROUP_NAME__ERP'
const DET_MTRGROUP_NAME_SELECT = `COALESCE(mg.NAME, d.MTRGROUP_NAME, 'NEDEFINIT') AS ${MTRGROUP_NAME_ALIAS}`
const GRP_MTRGROUP_NAME_SELECT = `COALESCE(mg.NAME, g.MTRGROUP_NAME, 'NEDEFINIT') AS ${MTRGROUP_NAME_ALIAS}`

// Same idea for CCCMINMAXGRP (groupAbc) — a different table, different grain.
const GRP_COLUMNS = {
  branch: 'g.BRANCH',
  mtrgroup: 'g.MTRGROUP',
  esteHq: 'g.ESTE_HQ',
  lifecycle: 'g.LIFECYCLE',
  abc: 'g.ABC',
  xyz: 'g.XYZ',
  clasa: 'g.CLASA',
  cv: 'g.CV',
  val52s: 'g.VAL_52S'
}

const LIFECYCLE_VALUES = new Set(['STANDARD', 'NOU', 'OD'])
const ABC_VALUES = new Set(['A', 'B', 'C'])
const XYZ_VALUES = new Set(['X', 'Y', 'Z'])
// 11 classes: the 9 ABC x XYZ combinations plus NOU/OD (CLASA mirrors LIFECYCLE
// for non-STANDARD items, per CCCMINMAXCOV's 11x3 seed — §12.5).
const CLASA_VALUES = new Set(['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD'])
const FLAG_TXT_VALUES = new Set(['OK', 'UP', 'DOWN', 'MAJOR_UP', 'SUPRASTOC', 'FARA_REFERINTA'])
const FLEXIBLE_OVERRIDE_KEYS = new Set(['LT_ZILE', 'FRECVENTA_ZILE'])
const STATUS_TREND_VALUES = new Set(['ACTIVE', 'STABLE', 'TREND_DOWN', 'DECLINE'])
const BRANCH_ASSIGNMENT_MODES = new Set(['DOC', 'AGENT', 'CLIENT'])

// Classify has no dedicated finish column: GROUP_STARTEDAT is its persisted
// upper bound. The DURATA_SEC fallback is valid for terminal pre-group runs;
// the normal runner always requires Group before FinishRun can overwrite it.
const RUN_HEADER_COLUMNS = [
  'RUNID', 'COMPANY', 'AZI', 'FAZA', 'STATUS', 'MTRL', 'NR_RANDURI', 'DURATA_SEC',
  "CASE WHEN GROUP_STARTEDAT IS NOT NULL THEN DATEDIFF(SECOND, STARTEDAT, GROUP_STARTEDAT) WHEN STATUS = 'RUNNING' THEN DATEDIFF(SECOND, STARTEDAT, GETDATE()) ELSE DURATA_SEC END AS CLASSIFY_DURATA_SEC",
  "CASE WHEN SESSION_STATUS = 'OPEN' THEN DATEDIFF(SECOND, STARTEDAT, GETDATE()) ELSE DATEDIFF(SECOND, STARTEDAT, FINISHEDAT) END AS SESSION_DURATA_SEC",
  'ERRORMSG', 'CONVERT(VARCHAR(19), STARTEDAT, 126) AS STARTEDAT',
  'CONVERT(VARCHAR(19), FINISHEDAT, 126) AS FINISHEDAT', 'CREATEDBY',
  'COMPUTE_STATUS', 'CONVERT(VARCHAR(19), COMPUTE_STARTEDAT, 126) AS COMPUTE_STARTEDAT',
  'CONVERT(VARCHAR(19), COMPUTE_FINISHEDAT, 126) AS COMPUTE_FINISHEDAT',
  'COMPUTE_DURATA_SEC', 'COMPUTE_ERRORMSG',
  'GROUP_STATUS', 'CONVERT(VARCHAR(19), GROUP_STARTEDAT, 126) AS GROUP_STARTEDAT',
  'CONVERT(VARCHAR(19), GROUP_FINISHEDAT, 126) AS GROUP_FINISHEDAT',
  'GROUP_DURATA_SEC', 'GROUP_NR_RANDURI', 'GROUP_ERRORMSG',
  'SESSION_STATUS', 'SCOPE', 'ESTE_CURENT'
]

function sqlInt (value, label) {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} must be an integer`)
  }
  return n
}

function sqlNumber (value, label) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`${label} must be a finite number`)
  }
  return n
}

function sqlBit (value) {
  return value ? 1 : 0
}

function requireString (value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

function normalizeParamValue (paramKey, value) {
  if (paramKey.toUpperCase() !== 'SIGMA_MIN') return requireString(value, 'paramValue')

  const normalized = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : requireString(value, 'paramValue')

  const sigmaMin = Number(normalized)
  if (!Number.isFinite(sigmaMin)) {
    throw new Error('SIGMA_MIN must be numeric')
  }
  if (sigmaMin < 0) {
    throw new Error('SIGMA_MIN must not be negative')
  }
  return normalized
}

function normalizeBranchOverride (override) {
  const paramKey = requireString(override.paramKey, 'paramKey').toUpperCase()
  if (!FLEXIBLE_OVERRIDE_KEYS.has(paramKey)) {
    throw new Error('Only LT_ZILE and FRECVENTA_ZILE accept branch overrides')
  }

  const branch = sqlInt(override.branch, 'branch')
  if (branch <= 0 || branch > 32767) {
    throw new Error('branch must be between 1 and 32767')
  }

  const prefix = override.prefix == null ? '' : String(override.prefix).trim()
  if (prefix !== '') {
    throw new Error('Prefix overrides are not available until the N5 prefix list is confirmed')
  }

  if (override.paramValue == null || (typeof override.paramValue === 'string' && override.paramValue.trim() === '')) {
    return { BRANCH: branch, PARAMKEY: paramKey, PARAMVALUE: null, PREFIX: '' }
  }

  const paramValue = sqlInt(override.paramValue, 'paramValue')
  if (paramValue <= 0) {
    throw new Error(`${paramKey} branch override must be a positive integer`)
  }
  return { BRANCH: branch, PARAMKEY: paramKey, PARAMVALUE: String(paramValue), PREFIX: '' }
}

function normalizeBranchAssignmentMode (value) {
  const mode = requireString(value, 'branchAssignmentMode').toUpperCase()
  if (!BRANCH_ASSIGNMENT_MODES.has(mode)) {
    throw new Error('branchAssignmentMode must be DOC, AGENT or CLIENT')
  }
  return mode
}

function normalizeCalibrareMod (value) {
  const mode = requireString(value, 'calibrareMod').toUpperCase()
  if (!new Set(['A', 'B', 'C']).has(mode)) {
    throw new Error('calibrareMod must be A, B or C')
  }
  return mode
}

function requireToken (data) {
  const token = data && data.token
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('Missing S1 session token (data.token).')
  }
  return token
}

function validateRowCount (rows, label) {
  if (rows.length > MAX_BATCH_ROWS) {
    throw new Error(`Too many ${label} rows in one save (${rows.length} > ${MAX_BATCH_ROWS}).`)
  }
}

// Binds a value as the next positional parameter and returns its `:N`
// placeholder. Enforces the WSMCP hard cap of 20 positional params per call.
function bind (params, value) {
  params.push(value)
  if (params.length > MAX_PARAMS) {
    throw new Error(`Too many active filters/parameters for one call (limit is ${MAX_PARAMS}).`)
  }
  return `:${params.length}`
}

function addIntListFilter (clauses, params, values, column, label) {
  if (!Array.isArray(values) || values.length === 0) return
  const csv = values.map((v) => sqlInt(v, label)).join(',')
  const p = bind(params, csv)
  clauses.push(`EXISTS (SELECT 1 FROM STRING_SPLIT(${p}, ',') s WHERE s.value = CONVERT(VARCHAR(20), ${column}))`)
}

function addEnumListFilter (clauses, params, values, column, allowedSet, label) {
  if (values === undefined || values === null) return
  const list = Array.isArray(values) ? values : [values]
  if (!list.length) return
  for (const v of list) {
    if (allowedSet && !allowedSet.has(v)) {
      throw new Error(`Invalid ${label}: ${v}`)
    }
  }
  const p = bind(params, list.join(','))
  clauses.push(`EXISTS (SELECT 1 FROM STRING_SPLIT(${p}, ',') s WHERE s.value = ${column})`)
}

function addTriState (clauses, params, value, column) {
  if (value !== true && value !== false) return
  clauses.push(`${column} = ${bind(params, sqlBit(value))}`)
}

function addInterval (clauses, params, range, column, label) {
  if (!range || typeof range !== 'object') return
  if (range.min !== undefined && range.min !== null) {
    clauses.push(`${column} >= ${bind(params, sqlNumber(range.min, `${label}.min`))}`)
  }
  if (range.max !== undefined && range.max !== null) {
    clauses.push(`${column} <= ${bind(params, sqlNumber(range.max, `${label}.max`))}`)
  }
}

// Escapes T-SQL LIKE wildcards (%, _, [) plus the escape char itself, so a
// user-typed CODE substring is matched literally (§12.5). Paired with
// `ESCAPE '\'` in the generated clause.
function escapeLikeValue (value) {
  return value.replace(/[\\%_[]/g, (ch) => `\\${ch}`)
}

function buildDetWhereClauses (filters, params) {
  const clauses = []
  const f = filters || {}

  addIntListFilter(clauses, params, f.branches, 'd.BRANCH', 'branches')
  addTriState(clauses, params, f.esteHq, 'd.ESTE_HQ')
  if (typeof f.codeLike === 'string' && f.codeLike.trim()) {
    const escaped = escapeLikeValue(f.codeLike.trim())
    clauses.push(`d.CODE LIKE ${bind(params, escaped + '%')} ESCAPE '\\'`)
  }
  addIntListFilter(clauses, params, f.mtrl, 'd.MTRL', 'mtrl')
  addIntListFilter(clauses, params, f.mtrgroup, 'd.MTRGROUP', 'mtrgroup')

  addEnumListFilter(clauses, params, f.lifecycle, 'd.LIFECYCLE', LIFECYCLE_VALUES, 'lifecycle')
  addEnumListFilter(clauses, params, f.abc, 'd.ABC', ABC_VALUES, 'abc')
  addEnumListFilter(clauses, params, f.xyz, 'd.XYZ', XYZ_VALUES, 'xyz')
  addEnumListFilter(clauses, params, f.clasa, 'd.CLASA', CLASA_VALUES, 'clasa')
  addEnumListFilter(clauses, params, f.flagTxt, 'd.FLAG_TXT', FLAG_TXT_VALUES, 'flagTxt')
  addEnumListFilter(clauses, params, f.statusTrend, 'd.STATUS_TREND', STATUS_TREND_VALUES, 'statusTrend')

  addTriState(clauses, params, f.hqCapAplicat, 'd.HQ_CAP_APLICAT')
  addTriState(clauses, params, f.podeaAplicata, 'd.PODEA_APLICATA')
  addTriState(clauses, params, f.arePozitieErp, 'd.ARE_POZITIE_ERP')
  addTriState(clauses, params, f.discFlag, 'd.DISC_FLAG')
  addTriState(clauses, params, f.flagLichidare, 'd.FLAG_LICHIDARE')
  addTriState(clauses, params, f.flagBlocat, 'd.FLAG_BLOCAT')
  addTriState(clauses, params, f.flagExclus, 'd.FLAG_EXCLUS')
  addTriState(clauses, params, f.warnVz26Zero, 'd.WARN_VZ26_ZERO')
  addTriState(clauses, params, f.warnStocNeg, 'd.WARN_STOC_NEG')
  addTriState(clauses, params, f.warnStocMort, 'd.WARN_STOC_MORT')
  addTriState(clauses, params, f.warnGrupaMica, 'd.WARN_GRUPA_MICA')

  addInterval(clauses, params, f.engMin, 'd.ENG_MIN', 'engMin')
  addInterval(clauses, params, f.engMax, 'd.ENG_MAX', 'engMax')
  addInterval(clauses, params, f.buyQty, 'd.BUY_QTY', 'buyQty')
  addInterval(clauses, params, f.stocQty, 'd.STOC_QTY', 'stocQty')
  addInterval(clauses, params, f.ordFurn, 'd.ORD_FURN', 'ordFurn')
  addInterval(clauses, params, f.acopCur, 'd.ACOP_CUR', 'acopCur')
  addInterval(clauses, params, f.flagRatio, 'd.FLAG_RATIO', 'flagRatio')
  addInterval(clauses, params, f.cv, 'd.CV', 'cv')
  addInterval(clauses, params, f.avg, 'd.[AVG]', 'avg')
  addInterval(clauses, params, f.vz52s, 'd.VZ_52S', 'vz52s')
  addInterval(clauses, params, f.vz26s, 'd.VZ_26S', 'vz26s')
  addInterval(clauses, params, f.val52s, 'd.VAL_52S', 'val52s')

  return clauses
}

// tieBreakFields is a list of field identifiers (keys into `columns`), never raw SQL —
// the column already used as the primary sort is dropped so it never repeats in ORDER BY (§12.3).
function buildOrderBy (sort, columns, tieBreakFields) {
  const tieBreakSql = tieBreakFields
    .filter((field) => !sort || !sort.field || field !== sort.field)
    .map((field) => {
      const column = columns[field]
      if (!column) throw new Error(`Unknown tie-break field: ${field}`)
      return `${column} ASC`
    })
    .join(', ')

  if (!sort || !sort.field) return tieBreakSql
  const column = columns[sort.field]
  if (!column) throw new Error(`Unknown sort field: ${sort.field}`)
  const dir = sort.dir === 'DESC' ? 'DESC' : 'ASC'
  const primary = `${column} ${dir}`
  return tieBreakSql ? `${primary}, ${tieBreakSql}` : primary
}

function buildPaging (page, pageSize) {
  const p = Math.max(1, sqlInt(page || 1, 'page'))
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, sqlInt(pageSize || DEFAULT_PAGE_SIZE, 'pageSize')))
  const offset = (p - 1) * size
  // OFFSET/FETCH row counts must be literals, not bound params: SQL Server
  // rejects a bound param there over this WSMCP execSql channel (confirmed
  // live 07.09.2026 — "row count parameter must be an integer"). Safe to
  // inline since offset/size are already validated integers above.
  return { page: p, pageSize: size, sql: `OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY` }
}

// Reads rows off an execSql 'dataset' response: {success, data: [...], total}.
// Confirmed live 07.09.2026 against /JS/WSMCP/execSql (SELECT and UPDATE).
function extractRows (response) {
  if (!response) return []
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.rows)) return response.rows
  if (Array.isArray(response.result)) return response.result
  if (Array.isArray(response)) return response
  return []
}

// Folds the exact-decimal aliases back onto their column names, so callers
// never see the transport-only suffix.
function mergeExactDecimals (rows) {
  for (const row of rows) {
    for (const column of EXACT_DECIMAL_COLUMNS) {
      const alias = `${column}${EXACT_DECIMAL_ALIAS_SUFFIX}`
      if (Object.prototype.hasOwnProperty.call(row, alias)) {
        row[column] = row[alias]
        delete row[alias]
      }
    }
  }
  return rows
}

function mergeMtrgroupNames (rows) {
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(row, MTRGROUP_NAME_ALIAS)) {
      row.MTRGROUP_NAME = row[MTRGROUP_NAME_ALIAS]
      delete row[MTRGROUP_NAME_ALIAS]
    }
  }
  return rows
}

// The AJS transport's own endpoint returns a JSON.stringify()'d string as its
// result; depending on how S1 relays it, `request-promise`'s `json: true` may
// already have parsed that outer layer, or the body may still be a JSON
// string one level in (confirmed pattern in zero-minmax.class.js). Handles
// both without assuming either shape.
function parseAjsResponse (raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return null
    }
  }
  return raw
}

// SQL error number (50039 etc.), when the AJS endpoint's catch block managed
// to recover one (see sqlErrorCode() in S1-MEC/AJS/NewMinMax.js) — best
// effort, not guaranteed present.
function ajsErrorCode (response) {
  const code = response && response.errorCode
  return (typeof code === 'number' && Number.isFinite(code)) ? code : null
}

// SoftOne WS platform-level error code (https://www.softone.gr/ws/#errorcodes,
// e.g. -1 "Please login first", -101/-100/-7 "session expired"), distinct
// from the SQL/AJS codes above. Field name varies by transport/response
// shape across this codebase (`code` in src/app.js's setData responses,
// `errorcode` in mcp-server/src/softone-client.ts) — tried in that order.
function softOneErrorCode (response) {
  if (!response) return null
  const candidate = response.code !== undefined ? response.code : response.errorcode
  const code = Number(candidate)
  return Number.isFinite(code) ? code : null
}

// Attaches the SoftOne platform error code (when present) plus its retryable
// classification (public/shared/softone-error-codes.js) to an Error, so a
// caller can distinguish "session expired, re-login and retry" from a
// permanent failure — same classification branch-replenishment-container.js
// uses, without duplicating the code/description table.
function annotateSoftOneError (err, response) {
  const code = softOneErrorCode(response)
  if (code === null) return err
  err.softOneErrorCode = code
  err.softOneRetryable = isSoftOneErrorRetryable(code)
  const details = describeSoftOneError(code)
  if (details) err.softOneDescription = details.description
  return err
}

export class MinmaxEngineService {
  constructor (options, app) {
    this.options = options || {}
    this.app = app || null
  }

  async setup (app) {
    this.app = app
  }

  _config () {
    const cfg = (this.app && this.app.get('minmaxEngine')) || {}
    const authKey = cfg.s1AuthKey || process.env.S1_APP_WS_SHARED_SECRET
    if (!authKey) {
      throw new Error('S1 auth key is not configured for minmax-engine. Set S1_APP_WS_SHARED_SECRET in the deploy environment.')
    }
    return {
      appId: cfg.s1AppId || process.env.S1_APP_ID || DEFAULT_S1_APP_ID,
      authKey,
      baseUrl: cfg.s1BaseUrl || process.env.S1_BASE_URL || DEFAULT_S1_BASE_URL
    }
  }

  // Variabila de mediu, cand e definita, are prioritate peste config/default.json:
  // altfel cheia din fisier ar face override-ul de deploy imposibil (vezi roles.js).
  //
  // MINMAX_ENGINE_WRITES_ENABLED gardeaza ASTAZI orice operatie care schimba
  // starea in S1: saveParams, runEngine, abandonRun si purgeRun deopotriva
  // (FAZA6_CONTRACT.md §8) — nu doar saveParams ca la introducerea flagului.
  _writesEnabled () {
    const cfg = (this.app && this.app.get('minmaxEngine')) || {}
    const fromEnv = process.env.MINMAX_ENGINE_WRITES_ENABLED
    const flagStr = fromEnv !== undefined ? fromEnv : cfg.writesEnabled
    return flagStr === true || flagStr === 'true'
  }

  // Fixed AJS endpoints require the same server-held application key with
  // ALLOW_WRITE=1. The key never reaches the browser; the S1 session token
  // still supplies company/session context.
  _ajsConfig () {
    return this._config()
  }

  // Dedicated transport to a fixed-shape /JS/NewMinMax/<endpoint> AJS function
  // — never a generic EXEC gateway (FAZA6_CONTRACT.md §3). Separate from
  // _execSql()/_execStatements(), which only ever compose SELECT/whitelisted
  // INSERT/UPDATE text for /JS/WSMCP/execSql.
  async _callAjs (endpoint, payload, token) {
    const { baseUrl, appId, authKey } = this._ajsConfig()
    const raw = await rp({
      body: { appId, authKey, clientID: token, JSONDATA: JSON.stringify(payload || {}) },
      gzip: true,
      json: true,
      method: 'POST',
      uri: `${baseUrl}/JS/NewMinMax/${endpoint}`
    })
    return parseAjsResponse(raw)
  }

  // Turns an AJS {success:false, error, errorCode} response into an Error the
  // caller can inspect programmatically. 50039 ("a session is already OPEN")
  // gets a stable `.code` — the UI is meant to show the running session, not
  // a red generic error (FAZA6_CONTRACT.md §5). 50045-50050 are the SQL Agent
  // runner codes (missing job/setup, Agent service down, no/ambiguous OPEN
  // session, runner already active or launch failure).
  _translateAjsError (response) {
    const message = (response && response.error) || 'S1 AJS call failed.'
    const code = ajsErrorCode(response)
    const err = new Error(message)
    if (code === 50039 || /already OPEN/i.test(message)) {
      err.code = 'SESSION_ALREADY_OPEN'
    } else if (code === 50045) {
      err.code = 'RUNNER_SETUP_MISSING'
    } else if (code === 50046) {
      err.code = 'AGENT_UNAVAILABLE'
    } else if (code === 50047) {
      err.code = 'NO_OPEN_SESSION'
    } else if (code === 50048) {
      err.code = 'RUNNER_ALREADY_ACTIVE'
    } else if (code === 50049) {
      err.code = 'RUNNER_LAUNCH_FAILED'
    } else if (code === 50050) {
      err.code = 'RUNNER_READINESS_FAILED'
    }
    if (code !== null) {
      err.sqlErrorCode = code
    }
    return err
  }

  // App-side structured audit (FAZA6_CONTRACT.md §8): logged by the process,
  // never by a CCC table a compromised write path could falsify itself.
  // Covers saveParams (restanta din Faza 5 Pasul 6) plus the three new
  // state-changing operations.
  _audit (operation, params, extra) {
    const payload = params && params.authentication && params.authentication.payload
    const refid = (payload && payload.sub) || null
    logger.info('minmax-engine audit: %s', JSON.stringify({
      operation,
      refid,
      timestamp: new Date().toISOString(),
      ...(extra || {})
    }))
  }

  async _execSql (sql, sqlParams, token) {
    const guard = classifySql(sql)
    if (!guard.ok) {
      throw new Error(`Blocked SQL: ${guard.reason}`)
    }
    if ((sqlParams || []).length > MAX_PARAMS) {
      throw new Error(`Too many SQL parameters (${sqlParams.length} > ${MAX_PARAMS}).`)
    }
    const { baseUrl, appId, authKey } = this._config()
    const response = await rp({
      body: {
        appId,
        authKey,
        clientID: token,
        returnMode: 'dataset',
        sqlParams: sqlParams || [],
        sqlQuery: sql
      },
      gzip: true,
      json: true,
      method: 'POST',
      uri: `${baseUrl}/JS/WSMCP/execSql`
    })
    if (response && response.success === false) {
      throw annotateSoftOneError(new Error(response.error || 'S1 execSql call failed.'), response)
    }
    return response
  }

  async _execStatements (statements, token) {
    let totalParams = 0
    for (const stmt of statements) {
      const guard = classifySql(stmt.sql)
      if (!guard.ok) {
        throw new Error(`Blocked SQL: ${guard.reason}`)
      }
      totalParams += (stmt.params || []).length
    }
    if (totalParams > MAX_PARAMS) {
      throw new Error(`Too many SQL parameters across statements (${totalParams} > ${MAX_PARAMS}).`)
    }
    const { baseUrl, appId, authKey } = this._config()
    const response = await rp({
      body: { appId, authKey, clientID: token, returnMode: 'dataset', statements },
      gzip: true,
      json: true,
      method: 'POST',
      uri: `${baseUrl}/JS/WSMCP/execSql`
    })
    return this._checkTransactionResult(response)
  }

  // WSMCP's own execSql reports a rollback as {success:false, ...} when it
  // matches the CATCH branch's status row with an EXACT lowercase `__ok`
  // column (see S1-MEC/AJS/WSMCP.js). That match can miss a driver that
  // normalizes the column to `__OK`, in which case WSMCP would return
  // {success:true} with the rollback row disguised as ordinary data. This
  // re-checks defensively, tolerant of case, and refuses to treat a missing
  // result as success either (FAZA5_CONTRACT.md §12.1).
  _checkTransactionResult (response) {
    if (response && response.success === false) {
      const err = annotateSoftOneError(new Error(response.error || 'S1 execSql transaction failed.'), response)
      err.failedStep = response.failedStep
      err.errNum = response.errorNumber
      throw err
    }

    const rows = extractRows(response)
    if (!rows.length) {
      throw new Error('S1 execSql returned no result for the transaction.')
    }

    const statusRow = rows[0]
    const okKey = Object.prototype.hasOwnProperty.call(statusRow, '__ok')
      ? '__ok'
      : (Object.prototype.hasOwnProperty.call(statusRow, '__OK') ? '__OK' : undefined)

    if (okKey && Number(statusRow[okKey]) === 0) {
      const err = new Error(statusRow.errMsg || statusRow.ERRMSG || 'S1 execSql transaction failed.')
      err.failedStep = statusRow.failedStep !== undefined ? statusRow.failedStep : statusRow.FAILEDSTEP
      err.errNum = statusRow.errNum !== undefined ? statusRow.errNum : statusRow.ERRNUM
      throw err
    }

    return response
  }


  // "Current run" is ESTE_CURENT=1 on a FULL, DONE, COMPUTE_STATUS=DONE
  // session — never MAX(RUNID). See FAZA5_CONTRACT.md §5 / §11.
  async _resolveCurrentRunId (token) {
    const sql = "SELECT TOP 1 RUNID FROM CCCMINMAXRUN " +
      'WHERE COMPANY = :1 AND SCOPE = \'FULL\' AND SESSION_STATUS = \'DONE\' ' +
      "AND ESTE_CURENT = 1 AND COMPUTE_STATUS = 'DONE'"
    const response = await this._execSql(sql, [COMPANY], token)
    const rows = extractRows(response)
    return rows.length ? rows[0].RUNID : undefined
  }

  async _resolveRunId (runId, token) {
    if (runId === undefined || runId === null) {
      const current = await this._resolveCurrentRunId(token)
      if (current === undefined) {
        const err = new Error('Nu exista inca o sesiune curenta (RUNID cu ESTE_CURENT=1, SCOPE=FULL, SESSION_STATUS=DONE, COMPUTE_STATUS=DONE).')
        err.code = 'NO_CURRENT_RUN'
        throw err
      }
      return current
    }
    const id = sqlInt(runId, 'runId')
    const sql = 'SELECT RUNID FROM CCCMINMAXRUN ' +
      "WHERE RUNID = :1 AND COMPANY = :2 AND SCOPE = 'FULL' " +
      "AND SESSION_STATUS = 'DONE' AND COMPUTE_STATUS = 'DONE'"
    const response = await this._execSql(sql, [id, COMPANY], token)
    const rows = extractRows(response)
    if (!rows.length) {
      const err = new Error(`RUNID ${id} nu este o sesiune FULL incheiata cu Compute DONE.`)
      err.code = 'RUN_NOT_READY'
      throw err
    }
    return id
  }

  /** POST /minmax-engine (custom method) results — CCCMINMAXDET, contract §5. */
  async results (data) {
    const token = requireToken(data)
    const runId = await this._resolveRunId(data.runId, token)

    const filterParams = [runId]
    const whereClauses = ['d.RUNID = :1', ...buildDetWhereClauses(data.filters, filterParams)]
    const whereSql = whereClauses.join(' AND ')
    const orderBy = buildOrderBy(data.sort, DET_COLUMNS, ['branch', 'mtrl'])

    const pageParams = filterParams.slice()
    const paging = buildPaging(data.page, data.pageSize)

    const sql = `SELECT d.*, ${EXACT_DECIMAL_SELECT}, ${DET_MTRGROUP_NAME_SELECT} FROM CCCMINMAXDET d ` +
      `LEFT JOIN MTRGROUP mg ON mg.MTRGROUP = d.MTRGROUP AND mg.COMPANY = ${COMPANY} ` +
      `WHERE ${whereSql} ORDER BY ${orderBy} ${paging.sql}`
    const response = await this._execSql(sql, pageParams, token)

    let total
    if (data.withTotal) {
      const countSql = `SELECT COUNT(*) AS TOTAL FROM CCCMINMAXDET d WHERE ${whereSql}`
      const countResponse = await this._execSql(countSql, filterParams, token)
      const countRows = extractRows(countResponse)
      total = countRows.length ? Number(countRows[0].TOTAL) : 0
    }

    return { page: paging.page, pageSize: paging.pageSize, rows: mergeMtrgroupNames(extractRows(response)), runId, total }
  }

  /** CCCMINMAXRUN — session history, most recent first. */
  async history (data) {
    const token = requireToken(data)
    const limit = Math.min(MAX_HISTORY_LIMIT, Math.max(1, sqlInt(data.limit || DEFAULT_HISTORY_LIMIT, 'limit')))
    const params = [COMPANY]
    // TOP (N) also rejects a bound param here (same OFFSET/FETCH restriction); limit is already a validated integer.
    const sql = `SELECT TOP (${limit}) ${RUN_HEADER_COLUMNS.join(', ')} FROM CCCMINMAXRUN ` +
      'WHERE COMPANY = :1 ORDER BY RUNID DESC'
    const response = await this._execSql(sql, params, token)
    return { rows: extractRows(response) }
  }

  /** CCCMINMAXGRP — ABC/XYZ per MTRGROUP x BRANCH. */
  async groupAbc (data) {
    const token = requireToken(data)
    const runId = await this._resolveRunId(data.runId, token)

    const params = [runId]
    const clauses = ['g.RUNID = :1']
    const f = data.filters || {}
    addIntListFilter(clauses, params, f.branches, 'g.BRANCH', 'branches')
    addIntListFilter(clauses, params, f.mtrgroup, 'g.MTRGROUP', 'mtrgroup')
    addTriState(clauses, params, f.esteHq, 'g.ESTE_HQ')
    addEnumListFilter(clauses, params, f.lifecycle, 'g.LIFECYCLE', LIFECYCLE_VALUES, 'lifecycle')
    addEnumListFilter(clauses, params, f.abc, 'g.ABC', ABC_VALUES, 'abc')
    addEnumListFilter(clauses, params, f.xyz, 'g.XYZ', XYZ_VALUES, 'xyz')
    addEnumListFilter(clauses, params, f.clasa, 'g.CLASA', CLASA_VALUES, 'clasa')

    const whereSql = clauses.join(' AND ')
    const orderBy = buildOrderBy(data.sort, GRP_COLUMNS, ['branch', 'mtrgroup'])
    const paging = buildPaging(data.page, data.pageSize)

    const sql = `SELECT g.*, ${GRP_MTRGROUP_NAME_SELECT} FROM CCCMINMAXGRP g ` +
      `LEFT JOIN MTRGROUP mg ON mg.MTRGROUP = g.MTRGROUP AND mg.COMPANY = ${COMPANY} ` +
      `WHERE ${whereSql} ORDER BY ${orderBy} ${paging.sql}`
    const response = await this._execSql(sql, params, token)

    let total
    if (data.withTotal) {
      const countSql = `SELECT COUNT(*) AS TOTAL FROM CCCMINMAXGRP g WHERE ${whereSql}`
      const countResponse = await this._execSql(countSql, params, token)
      const countRows = extractRows(countResponse)
      total = countRows.length ? Number(countRows[0].TOTAL) : 0
    }

    return { page: paging.page, pageSize: paging.pageSize, rows: mergeMtrgroupNames(mergeExactDecimals(extractRows(response))), runId, total }
  }

  /** CCCMINMAXPARAMS + COV + BRANCH + branch-only operational overrides. */
  async params (data) {
    const token = requireToken(data)
    const [paramsRes, covRes, branchRes, overrideRes] = await Promise.all([
      this._execSql('SELECT PARAMKEY, PARAMVALUE, PARAMTYPE, SCOPE, SCOPEKEY, DESCRIERE, UPDATEDAT FROM CCCMINMAXPARAMS ORDER BY PARAMKEY, SCOPE, SCOPEKEY', [], token),
      this._execSql('SELECT CLASA, MARIME, COV, UPDATEDAT FROM CCCMINMAXCOV ORDER BY CLASA, MARIME', [], token),
      this._execSql('SELECT BRANCH, MARIME, INCLUS, ESTE_HQ, ESTE_PODEA, UPDATEDAT FROM CCCMINMAXBRANCH ORDER BY BRANCH', [], token),
      this._execSql("SELECT PARAMKEY, BRANCH, PREFIX, PARAMVALUE, UPDATEDAT FROM CCCMINMAXPARAMOVERRIDE WHERE PREFIX = '' ORDER BY BRANCH, PARAMKEY", [], token)
    ])
    return {
      branches: extractRows(branchRes),
      cov: extractRows(covRes),
      overrides: extractRows(overrideRes),
      params: extractRows(paramsRes),
      writesEnabled: this._writesEnabled()
    }
  }

  /**
   * Drill-down for one (RUNID, BRANCH, MTRL): reads ONLY persisted state
   * (CCCMINMAXDET/RUN/WINSOR/WEEK), never MTRTRN/FINDOC/MTRL. Does not
   * recompute anything. See FAZA5_CONTRACT.md §6.
   * runId goes through the same _resolveRunId() as results() (§12.13): an
   * omitted runId falls back to the current run, and an explicit one must
   * be a finished FULL/Compute-DONE session (RUN_NOT_READY otherwise) — you
   * cannot drill down into an unfinished session.
   */
  async explain (data) {
    const token = requireToken(data)
    const runId = await this._resolveRunId(data.runId, token)
    const branch = sqlInt(data.branch, 'branch')
    const mtrl = sqlInt(data.mtrl, 'mtrl')

    const [headerRes, runParamsRes, rowRes, winsorRes, weekRes] = await Promise.all([
      this._execSql(
        'SELECT RUNID, COMPANY, AZI, SESSION_STATUS, DURATA_SEC, COMPUTE_DURATA_SEC, GROUP_DURATA_SEC, ' +
        "CASE WHEN GROUP_STARTEDAT IS NOT NULL THEN DATEDIFF(SECOND, STARTEDAT, GROUP_STARTEDAT) WHEN STATUS = 'RUNNING' THEN DATEDIFF(SECOND, STARTEDAT, GETDATE()) ELSE DURATA_SEC END AS CLASSIFY_DURATA_SEC, " +
        "CASE WHEN SESSION_STATUS = 'OPEN' THEN DATEDIFF(SECOND, STARTEDAT, GETDATE()) ELSE DATEDIFF(SECOND, STARTEDAT, FINISHEDAT) END AS SESSION_DURATA_SEC, " +
        'CONVERT(VARCHAR(19), STARTEDAT, 126) AS STARTEDAT, ' +
        'CONVERT(VARCHAR(19), FINISHEDAT, 126) AS FINISHEDAT, ' +
        'CONVERT(VARCHAR(19), GROUP_STARTEDAT, 126) AS GROUP_STARTEDAT, ' +
        'CONVERT(VARCHAR(19), GROUP_FINISHEDAT, 126) AS GROUP_FINISHEDAT, ' +
        'CONVERT(VARCHAR(19), COMPUTE_STARTEDAT, 126) AS COMPUTE_STARTEDAT, ' +
        'CONVERT(VARCHAR(19), COMPUTE_FINISHEDAT, 126) AS COMPUTE_FINISHEDAT ' +
        'FROM CCCMINMAXRUN WHERE RUNID = :1',
        [runId], token
      ),
      this._execSql(
        "SELECT PARAMKEY, PARAMVALUE, BRANCH, PREFIX FROM CCCMINMAXRUNPARAM WHERE RUNID = :1 AND PREFIX = '' AND BRANCH IN (0, :2) ORDER BY PARAMKEY, BRANCH",
        [runId, branch], token
      ),
      this._execSql(
        `SELECT d.*, ${EXACT_DECIMAL_SELECT} FROM CCCMINMAXDET d ` +
        'WHERE d.RUNID = :1 AND d.BRANCH = :2 AND d.MTRL = :3',
        [runId, branch, mtrl], token
      ),
      this._execSql(
        'SELECT * FROM CCCMINMAXWINSOR WHERE RUNID = :1 AND MTRL = :2',
        [runId, mtrl], token
      ),
      this._execSql(
        // WEEK_INDEX 0 is the week of AZI, so the dense series spans 0..51 to
        // line up with what Classify persists in CCCMINMAXWEEK.
        'WITH weeks (WEEK_INDEX) AS (' +
        'SELECT 0 UNION ALL SELECT WEEK_INDEX + 1 FROM weeks WHERE WEEK_INDEX < 51' +
        ') ' +
        'SELECT w.WEEK_INDEX, ISNULL(k.QTY, 0) AS QTY, ISNULL(k.SALES_VALUE, 0) AS SALES_VALUE, k.LAST_POSITIVE_SALE ' +
        'FROM weeks w ' +
        'LEFT JOIN CCCMINMAXWEEK k ON k.RUNID = :1 AND k.BRANCH = :2 AND k.MTRL = :3 AND k.WEEK_INDEX = w.WEEK_INDEX ' +
        'ORDER BY w.WEEK_INDEX ' +
        'OPTION (MAXRECURSION 100)',
        [runId, branch, mtrl], token
      )
    ])

    const rows = mergeExactDecimals(extractRows(rowRes))
    if (!rows.length) {
      throw new Error(`No CCCMINMAXDET row for RUNID=${runId}, BRANCH=${branch}, MTRL=${mtrl}.`)
    }

    return {
      det: rows[0],
      run: extractRows(headerRes)[0],
      runParams: extractRows(runParamsRes),
      weeklySeries: extractRows(weekRes),
      winsor: extractRows(winsorRes)[0]
    }
  }

  /**
   * Only write path in this service. Atomic (all-or-nothing) via
   * `statements`. Table scope enforced by classifySql's write whitelist.
   * Each collection is serialized into a single OPENJSON parameter, so the
   * positional-parameter cost stays constant (<= 4) regardless of how many
   * rows are edited. See FAZA5_CONTRACT.md §7, §12.2.
   */
  async saveParams (data, params) {
    if (!this._writesEnabled()) {
      throw new Forbidden('Scrierea parametrilor MIN/MAX este dezactivata (MINMAX_ENGINE_WRITES_ENABLED).')
    }
    const token = requireToken(data)
    const statements = []
    // Logical keys touched per collection, captured for _audit() below —
    // composite PK fields only, never PARAMVALUE/COV/MARIME/INCLUS/ESTE_PODEA
    // (FAZA5_CONTRACT.md §12.8: audit logs what changed, not the new values).
    let paramsKeys = []
    let covKeys = []
    let branchKeys = []
    let overrideKeys = []

    const paramsUpdates = data.paramsUpdates || []
    validateRowCount(paramsUpdates, 'paramsUpdates')
    if (paramsUpdates.length) {
      const rows = paramsUpdates.map((p) => {
        const paramKey = requireString(p.paramKey, 'paramKey')
        return {
          PARAMKEY: paramKey,
          PARAMTYPE: p.paramType ? requireString(p.paramType, 'paramType') : 'STR',
          PARAMVALUE: normalizeParamValue(paramKey, p.paramValue),
          SCOPE: p.scope ? requireString(p.scope, 'scope') : 'GLOBAL',
          SCOPEKEY: typeof p.scopeKey === 'string' ? p.scopeKey.trim() : ''
        }
      })
      paramsKeys = rows.map((r) => ({ paramKey: r.PARAMKEY, scope: r.SCOPE, scopeKey: r.SCOPEKEY }))
      const json = JSON.stringify(rows)
      // Table immediately after UPDATE (no alias), per §12.2: referencedTable()
      // in sql-guard.js extracts the alias otherwise and blocks the statement.
      statements.push({
        params: [json],
        sql: 'UPDATE CCCMINMAXPARAMS SET PARAMVALUE = j.PARAMVALUE, UPDATEDAT = GETDATE() ' +
          'FROM CCCMINMAXPARAMS INNER JOIN OPENJSON(:1) ' +
          'WITH (PARAMKEY VARCHAR(50), SCOPE VARCHAR(20), SCOPEKEY VARCHAR(50), PARAMVALUE VARCHAR(255)) j ' +
          'ON j.PARAMKEY = CCCMINMAXPARAMS.PARAMKEY AND j.SCOPE = CCCMINMAXPARAMS.SCOPE ' +
          'AND j.SCOPEKEY = CCCMINMAXPARAMS.SCOPEKEY'
      })
      statements.push({
        params: [json],
        sql: 'INSERT INTO CCCMINMAXPARAMS (PARAMKEY, PARAMVALUE, PARAMTYPE, SCOPE, SCOPEKEY) ' +
          'SELECT j.PARAMKEY, j.PARAMVALUE, j.PARAMTYPE, j.SCOPE, j.SCOPEKEY FROM OPENJSON(:1) ' +
          'WITH (PARAMKEY VARCHAR(50), SCOPE VARCHAR(20), SCOPEKEY VARCHAR(50), PARAMVALUE VARCHAR(255), PARAMTYPE VARCHAR(10)) j ' +
          'WHERE NOT EXISTS (SELECT 1 FROM CCCMINMAXPARAMS ' +
          'WHERE PARAMKEY = j.PARAMKEY AND SCOPE = j.SCOPE AND SCOPEKEY = j.SCOPEKEY)'
      })
    }

    const covUpdates = data.covUpdates || []
    validateRowCount(covUpdates, 'covUpdates')
    if (covUpdates.length) {
      const rows = covUpdates.map((c) => ({
        CLASA: requireString(c.clasa, 'clasa'),
        COV: sqlNumber(c.cov, 'cov'),
        MARIME: requireString(c.marime, 'marime')
      }))
      covKeys = rows.map((r) => ({ clasa: r.CLASA, marime: r.MARIME }))
      statements.push({
        params: [JSON.stringify(rows)],
        sql: 'UPDATE CCCMINMAXCOV SET COV = j.COV, UPDATEDAT = GETDATE() ' +
          'FROM CCCMINMAXCOV INNER JOIN OPENJSON(:1) WITH (CLASA VARCHAR(3), MARIME VARCHAR(6), COV FLOAT) j ' +
          'ON j.CLASA = CCCMINMAXCOV.CLASA AND j.MARIME = CCCMINMAXCOV.MARIME'
      })
    }

    const branchUpdates = data.branchUpdates || []
    validateRowCount(branchUpdates, 'branchUpdates')
    if (branchUpdates.length) {
      const rows = branchUpdates.map((b) => ({
        BRANCH: sqlInt(b.branch, 'branch'),
        ESTE_PODEA: sqlBit(b.estePodea),
        INCLUS: sqlBit(b.inclus),
        MARIME: requireString(b.marime, 'marime')
      }))
      branchKeys = rows.map((r) => ({ branch: r.BRANCH }))
      statements.push({
        params: [JSON.stringify(rows)],
        sql: 'UPDATE CCCMINMAXBRANCH SET MARIME = j.MARIME, INCLUS = j.INCLUS, ESTE_PODEA = j.ESTE_PODEA, UPDATEDAT = GETDATE() ' +
          'FROM CCCMINMAXBRANCH INNER JOIN OPENJSON(:1) WITH (BRANCH SMALLINT, MARIME VARCHAR(6), INCLUS BIT, ESTE_PODEA BIT) j ' +
          'ON j.BRANCH = CCCMINMAXBRANCH.BRANCH'
      })
    }

    const overrideUpdates = data.overrideUpdates || []
    validateRowCount(overrideUpdates, 'overrideUpdates')
    if (overrideUpdates.length) {
      const rows = overrideUpdates.map(normalizeBranchOverride)
      overrideKeys = rows.map((r) => ({ branch: r.BRANCH, paramKey: r.PARAMKEY, prefix: '' }))
      const upserts = rows.filter((r) => r.PARAMVALUE !== null)
      const deletes = rows.filter((r) => r.PARAMVALUE === null)

      if (upserts.length) {
        const json = JSON.stringify(upserts)
        statements.push({
          params: [json],
          sql: 'UPDATE CCCMINMAXPARAMOVERRIDE SET PARAMVALUE = j.PARAMVALUE, UPDATEDAT = GETDATE() ' +
            'FROM CCCMINMAXPARAMOVERRIDE INNER JOIN OPENJSON(:1) ' +
            'WITH (PARAMKEY VARCHAR(50), BRANCH SMALLINT, PREFIX VARCHAR(50), PARAMVALUE VARCHAR(255)) j ' +
            'ON j.PARAMKEY = CCCMINMAXPARAMOVERRIDE.PARAMKEY AND j.BRANCH = CCCMINMAXPARAMOVERRIDE.BRANCH ' +
            'AND j.PREFIX = CCCMINMAXPARAMOVERRIDE.PREFIX'
        })
        statements.push({
          params: [json],
          sql: 'INSERT INTO CCCMINMAXPARAMOVERRIDE (PARAMKEY, BRANCH, PREFIX, PARAMVALUE) ' +
            'SELECT j.PARAMKEY, j.BRANCH, j.PREFIX, j.PARAMVALUE FROM OPENJSON(:1) ' +
            'WITH (PARAMKEY VARCHAR(50), BRANCH SMALLINT, PREFIX VARCHAR(50), PARAMVALUE VARCHAR(255)) j ' +
            'WHERE NOT EXISTS (SELECT 1 FROM CCCMINMAXPARAMOVERRIDE WHERE PARAMKEY = j.PARAMKEY ' +
            'AND BRANCH = j.BRANCH AND PREFIX = j.PREFIX)'
        })
      }

      if (deletes.length) {
        statements.push({
          params: [JSON.stringify(deletes)],
          sql: 'DELETE FROM CCCMINMAXPARAMOVERRIDE WHERE EXISTS (' +
            'SELECT 1 FROM OPENJSON(:1) WITH (PARAMKEY VARCHAR(50), BRANCH SMALLINT, PREFIX VARCHAR(50)) j ' +
            'WHERE j.PARAMKEY = CCCMINMAXPARAMOVERRIDE.PARAMKEY AND j.BRANCH = CCCMINMAXPARAMOVERRIDE.BRANCH ' +
            'AND j.PREFIX = CCCMINMAXPARAMOVERRIDE.PREFIX)'
        })
      }
    }

    if (!statements.length) {
      throw new Error('saveParams called with no updates.')
    }

    await this._execStatements(statements, token)
    this._audit('saveParams', params, {
      changedKeys: {
        branchUpdates: branchKeys,
        covUpdates: covKeys,
        overrideUpdates: overrideKeys,
        paramsUpdates: paramsKeys
      },
      counts: {
        branchUpdates: branchUpdates.length,
        covUpdates: covUpdates.length,
        overrideUpdates: overrideUpdates.length,
        paramsUpdates: paramsUpdates.length
      }
    })
    return { success: true }
  }

  /**
   * Orchestrates startRun + runPhases (FAZA6_CONTRACT.md §4, §11): opens a
   * session synchronously and returns its RUNID, then AWAITS runPhases —
   * which, under the SQL Server Agent architecture, only validates the OPEN
   * session and launches the company-specific Agent job via
   * msdb.dbo.sp_start_job, returning in well under a second. The actual
   * Classify/ClassifyGroup/Compute/FinishRun pipeline runs inside that Agent
   * job, outside of any AJS ADO CommandTimeout. Awaiting the launch means a
   * launch failure (missing job/setup, Agent down, already active) reaches
   * the caller instead of being logged silently; the session stays OPEN
   * either way, recoverable only through an explicit abandonRun() call, never
   * a silent auto-abandon. The kill-switch is checked first, before token/role
   * work. The UI is expected to poll history() for phase progress.
   */
  async runEngine (data, params) {
    if (!this._writesEnabled()) {
      throw new Forbidden('Lansarea unei sesiuni MIN/MAX este dezactivata (MINMAX_ENGINE_WRITES_ENABLED).')
    }
    const token = requireToken(data)
    const branchAssignmentMode = normalizeBranchAssignmentMode(data.branchAssignmentMode || 'CLIENT')
    const calibrareMod = normalizeCalibrareMod(data.calibrareMod || 'C')
    const authPayload = params && params.authentication && params.authentication.payload
    const createdBy = authPayload && authPayload.sub !== undefined
      ? sqlInt(authPayload.sub, 'authenticated REFID')
      : null

    const startResponse = await this._callAjs('startRun', {
      branchAssignmentMode,
      calibrareMod,
      createdBy,
      mtrl: data.mtrl,
      scope: data.scope || 'FULL'
    }, token)

    if (!startResponse || startResponse.success === false) {
      throw this._translateAjsError(startResponse)
    }

    const runId = startResponse.runId !== undefined
      ? startResponse.runId
      : (startResponse.data && startResponse.data.runId)
    if (runId === undefined || runId === null) {
      throw new Error('startRun did not return a runId.')
    }

    this._audit('runEngine', params, { branchAssignmentMode, calibrareMod, runId, stage: 'session-opened' })

    const phasesResponse = await this._callAjs('runPhases', { runId }, token)
    if (!phasesResponse || phasesResponse.success === false) {
      throw this._translateAjsError(phasesResponse)
    }

    return { runId }
  }

  /** Marks an OPEN session ABANDONED (FAZA6_CONTRACT.md §5). Zero DELETE. */
  async abandonRun (data, params) {
    if (!this._writesEnabled()) {
      throw new Forbidden('Operatiile de ciclu de viata MIN/MAX sunt dezactivate (MINMAX_ENGINE_WRITES_ENABLED).')
    }
    const token = requireToken(data)
    const runId = sqlInt(data.runId, 'runId')

    const response = await this._callAjs('abandonRun', { runId }, token)
    if (!response || response.success === false) {
      throw this._translateAjsError(response)
    }

    this._audit('abandonRun', params, { runId })
    return { runId, ...(response.data || {}) }
  }

  /** Purges CCCMINMAXDET/WEEK/WINSOR for a finished, non-current session (FAZA6_CONTRACT.md §6). */
  async purgeRun (data, params) {
    if (!this._writesEnabled()) {
      throw new Forbidden('Operatiile de ciclu de viata MIN/MAX sunt dezactivate (MINMAX_ENGINE_WRITES_ENABLED).')
    }
    const token = requireToken(data)
    const runId = sqlInt(data.runId, 'runId')

    const response = await this._callAjs('purgeRun', { batchSize: data.batchSize, runId }, token)
    if (!response || response.success === false) {
      throw this._translateAjsError(response)
    }

    this._audit('purgeRun', params, { runId })
    return { runId, ...(response.data || {}) }
  }
}

export const getOptions = (app) => {
  return { app }
}
