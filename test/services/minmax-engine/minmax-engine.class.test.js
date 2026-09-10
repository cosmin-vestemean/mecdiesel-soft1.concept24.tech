// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
//
// Unit tests for the service class in isolation (no Feathers app, no DB).
// The only external dependency is the outbound HTTP call to
// /JS/WSMCP/execSql, made via `request-promise`; that call is intercepted
// with nock so these tests never touch the real S1 server. See sql-guard
// tests for the read/write verb-and-table matrix; this file focuses on SQL
// composition, run resolution and the parameter/paging caps.
import assert from 'assert'
import nock from 'nock'
import { MinmaxEngineService, getOptions } from '../../../src/services/minmax-engine/minmax-engine.class.js'
import { classifySql } from '../../../src/services/minmax-engine/sql-guard.js'
import { logger } from '../../../src/logger.js'

const FAKE_BASE_URL = 'http://fake-s1.test'
const EXEC_SQL_PATH = '/JS/WSMCP/execSql'

function makeService (configOverrides) {
  const cfg = { s1AppId: '2002', s1AuthKey: 'unit-test-secret', s1BaseUrl: FAKE_BASE_URL, ...configOverrides }
  const app = { get: (key) => (key === 'minmaxEngine' ? cfg : undefined) }
  return new MinmaxEngineService(getOptions(app), app)
}

function reply (data) {
  return { data, success: true }
}

describe('minmax-engine service (unit, HTTP mocked)', () => {
  // Flagul de mediu bate configuratia, deci trebuie scos ca testele pe config sa fie deterministe.
  let savedWritesEnv

  before(() => {
    nock.disableNetConnect()
    savedWritesEnv = process.env.MINMAX_ENGINE_WRITES_ENABLED
    delete process.env.MINMAX_ENGINE_WRITES_ENABLED
  })

  after(() => {
    nock.enableNetConnect()
    if (savedWritesEnv === undefined) delete process.env.MINMAX_ENGINE_WRITES_ENABLED
    else process.env.MINMAX_ENGINE_WRITES_ENABLED = savedWritesEnv
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('token and config guards', () => {
    it('rejects a call with no S1 session token', async () => {
      const service = makeService()
      await assert.rejects(service.results({}), /Missing S1 session token/)
    })

    it('rejects when no S1 auth key is configured anywhere', async () => {
      const savedEnv = process.env.S1_APP_WS_SHARED_SECRET
      delete process.env.S1_APP_WS_SHARED_SECRET
      try {
        const service = makeService({ s1AuthKey: undefined })
        await assert.rejects(service.results({ token: 'tok' }), /S1 auth key is not configured/)
      } finally {
        if (savedEnv !== undefined) process.env.S1_APP_WS_SHARED_SECRET = savedEnv
      }
    })

    it('never sends a blocked statement over the wire (defense in depth)', async () => {
      const service = makeService()
      // No nock interceptor registered: if the guard were bypassed, the
      // disabled net connect would make the real request fail loudly too.
      await assert.rejects(service._execSql('DROP TABLE CCCMINMAXPARAMS', [], 'tok'), /Blocked SQL/)
    })
  })

  describe('results()', () => {
    it('resolves the current run (ESTE_CURENT=1) when runId is omitted', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('ESTE_CURENT = 1'))
        .reply(200, reply([{ RUNID: 42 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, reply([{ BRANCH: 1000, MTRL: 1, RUNID: 42 }]))

      const service = makeService()
      const result = await service.results({ token: 'tok' })

      assert.strictEqual(result.runId, 42)
      assert.strictEqual(result.page, 1)
      assert.strictEqual(result.pageSize, 100)
      assert.strictEqual(result.rows.length, 1)
    })

    it('joins MTRGROUP and prefers the current ERP name', async () => {
      let capturedSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedSql = body.sqlQuery
          return reply([{ MTRL: 1, MTRGROUP: 1, MTRGROUP_CODE: 'G1', MTRGROUP_NAME: 'Snapshot', MTRGROUP_NAME__ERP: 'ERP name' }])
        })

      const service = makeService()
      const result = await service.results({ runId: 5, token: 'tok' })

      assert.ok(capturedSql.includes('LEFT JOIN MTRGROUP mg ON mg.MTRGROUP = d.MTRGROUP'))
      assert.ok(capturedSql.includes('mg.COMPANY = 1000'))
      assert.deepStrictEqual(result.rows, [{ MTRL: 1, MTRGROUP: 1, MTRGROUP_CODE: 'G1', MTRGROUP_NAME: 'ERP name' }])
    })

    it('rejects when there is no current run and none was requested', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('ESTE_CURENT = 1'))
        .reply(200, reply([]))

      const service = makeService()
      await assert.rejects(service.results({ token: 'tok' }), (err) => err.code === 'NO_CURRENT_RUN')
    })

    it('rejects an explicit runId that is not a finished FULL/Compute-DONE session', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([]))

      const service = makeService()
      await assert.rejects(service.results({ runId: 7, token: 'tok' }), (err) => err.code === 'RUN_NOT_READY')
    })

    it('rejects an invalid enum filter value before issuing the results query', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))

      const service = makeService()
      await assert.rejects(
        service.results({ filters: { abc: 'Q' }, runId: 5, token: 'tok' }),
        /Invalid abc: Q/
      )
    })

    it('rejects an unknown sort field', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))

      const service = makeService()
      await assert.rejects(
        service.results({ runId: 5, sort: { field: 'password' }, token: 'tok' }),
        /Unknown sort field: password/
      )
    })

    it('encodes an array filter as one bound CSV parameter via STRING_SPLIT', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([])
        })

      const service = makeService()
      await service.results({ filters: { branches: [1000, 1200, 2200] }, runId: 5, token: 'tok' })

      assert.ok(capturedBody.sqlQuery.includes("STRING_SPLIT(:2, ',')"))
      assert.strictEqual(capturedBody.sqlParams[1], '1000,1200,2200')
    })

    it('accepts NOU and OD as clasa filter values and returns the matching rows (§12.5)', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([{ BRANCH: 1000, CLASA: 'NOU', MTRL: 1, RUNID: 5 }, { BRANCH: 1000, CLASA: 'OD', MTRL: 2, RUNID: 5 }])
        })

      const service = makeService()
      const result = await service.results({ filters: { clasa: ['NOU', 'OD'] }, runId: 5, token: 'tok' })

      assert.ok(capturedBody.sqlQuery.includes("STRING_SPLIT(:2, ',')"))
      assert.strictEqual(capturedBody.sqlParams[1], 'NOU,OD')
      assert.strictEqual(result.rows.length, 2)
      assert.deepStrictEqual(result.rows.map((r) => r.CLASA), ['NOU', 'OD'])
    })

    it('escapes LIKE wildcards in codeLike and returns only the literally-matched row (§12.5)', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([{ BRANCH: 1000, CODE: '50%OFF', MTRL: 1, RUNID: 5 }])
        })

      const service = makeService()
      const result = await service.results({ filters: { codeLike: '50%OFF_1' }, runId: 5, token: 'tok' })

      assert.ok(capturedBody.sqlQuery.includes("d.CODE LIKE :2 ESCAPE '\\'"))
      assert.strictEqual(capturedBody.sqlParams[1], '50\\%OFF\\_1%')
      assert.strictEqual(result.rows.length, 1)
      assert.strictEqual(result.rows[0].CODE, '50%OFF')
    })

    it('rejects filter combinations that exceed the 20 positional parameter cap', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))

      const service = makeService()
      const intervalFields = [
        'engMin', 'engMax', 'buyQty', 'stocQty', 'ordFurn',
        'acopCur', 'flagRatio', 'cv', 'avg', 'vz52s', 'val52s'
      ]
      const filters = {}
      for (const field of intervalFields) filters[field] = { max: 2, min: 1 }

      await assert.rejects(
        service.results({ filters, runId: 5, token: 'tok' }),
        /Too many active filters\/parameters/
      )
    })

    it('clamps page number to at least 1 and page size to the hard cap of 500', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([])
        })

      const service = makeService()
      const result = await service.results({ page: 0, pageSize: 5000, runId: 5, token: 'tok' })

      assert.strictEqual(result.page, 1)
      assert.strictEqual(result.pageSize, 500)
      assert.ok(capturedBody.sqlQuery.includes('FETCH NEXT'))
    })

    it('omits total when withTotal is falsy (§12.6)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, reply([]))

      const service = makeService()
      const result = await service.results({ runId: 5, token: 'tok' })

      assert.strictEqual(result.total, undefined)
    })

    it('returns a count query result when withTotal is true (§12.6)', async () => {
      let countSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET') && !body.sqlQuery.startsWith('SELECT COUNT'))
        .reply(200, reply([{ BRANCH: 1000, MTRL: 1, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT COUNT(*)'))
        .reply(200, (uri, body) => {
          countSql = body.sqlQuery
          return reply([{ TOTAL: 137 }])
        })

      const service = makeService()
      const result = await service.results({ runId: 5, token: 'tok', withTotal: true })

      assert.strictEqual(result.total, 137)
      assert.ok(countSql.includes('SELECT COUNT(*) AS TOTAL FROM CCCMINMAXDET d WHERE'))
    })
  })

  describe('sorting tie-break dedup (§12.3)', () => {
    async function capturedResultsOrderBy (sort) {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([])
        })

      const service = makeService()
      await service.results({ runId: 5, sort, token: 'tok' })
      return capturedBody.sqlQuery
    }

    async function capturedGroupAbcOrderBy (sort) {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXGRP'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([])
        })

      const service = makeService()
      await service.groupAbc({ runId: 5, sort, token: 'tok' })
      return capturedBody.sqlQuery
    }

    it('drops BRANCH from the DET tie-break when sorting by branch (no duplicate expression)', async () => {
      const sql = await capturedResultsOrderBy({ field: 'branch', dir: 'DESC' })
      assert.ok(sql.includes('ORDER BY d.BRANCH DESC, d.MTRL ASC'))
      assert.strictEqual(sql.match(/d\.BRANCH/g).length, 1)
    })

    it('drops MTRL from the DET tie-break when sorting by mtrl', async () => {
      const sql = await capturedResultsOrderBy({ field: 'mtrl', dir: 'ASC' })
      assert.ok(sql.includes('ORDER BY d.MTRL ASC, d.BRANCH ASC'))
      assert.strictEqual(sql.match(/d\.MTRL/g).length, 1)
    })

    it('keeps the full DET tie-break when sorting by a column outside it', async () => {
      const sql = await capturedResultsOrderBy({ field: 'engMax', dir: 'DESC' })
      assert.ok(sql.includes('ORDER BY d.ENG_MAX DESC, d.BRANCH ASC, d.MTRL ASC'))
    })

    it('drops BRANCH from the GRP tie-break when sorting by branch', async () => {
      const sql = await capturedGroupAbcOrderBy({ field: 'branch', dir: 'ASC' })
      assert.ok(sql.includes('ORDER BY g.BRANCH ASC, g.MTRGROUP ASC'))
      assert.strictEqual(sql.match(/g\.BRANCH/g).length, 1)
    })

    it('drops MTRGROUP from the GRP tie-break when sorting by mtrgroup', async () => {
      const sql = await capturedGroupAbcOrderBy({ field: 'mtrgroup', dir: 'DESC' })
      assert.ok(sql.includes('ORDER BY g.MTRGROUP DESC, g.BRANCH ASC'))
      assert.strictEqual(sql.match(/ORDER BY .*$/)[0].match(/g\.MTRGROUP/g).length, 1)
    })
  })

  describe('history()', () => {
    it('clamps the limit to the hard cap of 50', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUN'))
        .reply(200, (uri, body) => {
          capturedBody = body
          return reply([])
        })

      const service = makeService()
      const result = await service.history({ limit: 999, token: 'tok' })

      assert.deepStrictEqual(result, { rows: [] })
      assert.ok(capturedBody.sqlQuery.includes('ORDER BY RUNID DESC'))
      assert.ok(capturedBody.sqlQuery.includes('TOP (50)'))
      assert.strictEqual(capturedBody.sqlParams.length, 1)
    })
  })

  describe('groupAbc()', () => {
    it('resolves the run and reads CCCMINMAXGRP', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXGRP'))
        .reply(200, reply([{ ABC: 'A', MTRGROUP: 1 }]))

      const service = makeService()
      const result = await service.groupAbc({ runId: 5, token: 'tok' })

      assert.strictEqual(result.runId, 5)
      assert.deepStrictEqual(result.rows, [{ ABC: 'A', MTRGROUP: 1 }])
    })

    it('joins MTRGROUP and prefers the current ERP name', async () => {
      let capturedSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXGRP'))
        .reply(200, (uri, body) => {
          capturedSql = body.sqlQuery
          return reply([{ MTRGROUP: 1, MTRGROUP_CODE: 'G1', MTRGROUP_NAME: 'Snapshot', MTRGROUP_NAME__ERP: 'ERP name' }])
        })

      const service = makeService()
      const result = await service.groupAbc({ runId: 5, token: 'tok' })

      assert.ok(capturedSql.includes('LEFT JOIN MTRGROUP mg ON mg.MTRGROUP = g.MTRGROUP'))
      assert.ok(capturedSql.includes('mg.COMPANY = 1000'))
      assert.deepStrictEqual(result.rows, [{ MTRGROUP: 1, MTRGROUP_CODE: 'G1', MTRGROUP_NAME: 'ERP name' }])
    })

    it('omits total when withTotal is falsy (§12.11)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXGRP'))
        .reply(200, reply([]))

      const service = makeService()
      const result = await service.groupAbc({ runId: 5, token: 'tok' })

      assert.strictEqual(result.total, undefined)
    })

    it('returns a count query result when withTotal is true (§12.11)', async () => {
      let countSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXGRP') && !body.sqlQuery.startsWith('SELECT COUNT'))
        .reply(200, reply([{ ABC: 'A', MTRGROUP: 1 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT COUNT(*)'))
        .reply(200, (uri, body) => {
          countSql = body.sqlQuery
          return reply([{ TOTAL: 42 }])
        })

      const service = makeService()
      const result = await service.groupAbc({ runId: 5, token: 'tok', withTotal: true })

      assert.strictEqual(result.total, 42)
      assert.ok(countSql.includes('SELECT COUNT(*) AS TOTAL FROM CCCMINMAXGRP g WHERE'))
    })
  })

  describe('params()', () => {
    it('aggregates params, cov and branch config in one response', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXPARAMS'))
        .reply(200, reply([{ PARAMKEY: 'X' }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXCOV'))
        .reply(200, reply([{ CLASA: 'AX' }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXBRANCH'))
        .reply(200, reply([{ BRANCH: 1000 }]))

      const service = makeService()
      const result = await service.params({ token: 'tok' })

      assert.deepStrictEqual(result, {
        branches: [{ BRANCH: 1000 }],
        cov: [{ CLASA: 'AX' }],
        params: [{ PARAMKEY: 'X' }],
        writesEnabled: false
      })
    })

    it('returns writesEnabled: true when flag is enabled', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXPARAMS'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXCOV'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXBRANCH'))
        .reply(200, reply([]))

      const service = makeService({ writesEnabled: true })
      const result = await service.params({ token: 'tok' })

      assert.strictEqual(result.writesEnabled, true)
    })

    it('lasa variabila de mediu sa suprascrie configuratia, in ambele sensuri', async () => {
      const enabledByConfig = makeService({ writesEnabled: true })
      const disabledByConfig = makeService({ writesEnabled: false })

      process.env.MINMAX_ENGINE_WRITES_ENABLED = 'false'
      assert.strictEqual(enabledByConfig._writesEnabled(), false)

      process.env.MINMAX_ENGINE_WRITES_ENABLED = 'true'
      assert.strictEqual(disabledByConfig._writesEnabled(), true)

      process.env.MINMAX_ENGINE_WRITES_ENABLED = ''
      assert.strictEqual(enabledByConfig._writesEnabled(), false)

      delete process.env.MINMAX_ENGINE_WRITES_ENABLED
      assert.strictEqual(enabledByConfig._writesEnabled(), true)
    })
  })

  describe('explain()', () => {
    it('rejects an explicit runId that is not a finished FULL/Compute-DONE session (§12.13, like results())', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([]))

      const service = makeService()
      await assert.rejects(
        service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' }),
        (err) => err.code === 'RUN_NOT_READY'
      )
    })

    it('resolves the current run (ESTE_CURENT=1) when runId is omitted, like results()', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('ESTE_CURENT = 1'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('COMPUTE_STARTEDAT FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUNPARAM'))
        .reply(200, reply([{ PARAMKEY: 'CALIBRARE_MOD', PARAMVALUE: 'C' }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET d'))
        .reply(200, reply([{ BRANCH: 1000, ENG_MAX: 10, MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([{ MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('CCCMINMAXWEEK'))
        .reply(200, reply([]))

      const service = makeService()
      const result = await service.explain({ branch: 1000, mtrl: 42, token: 'tok' })

      assert.strictEqual(result.det.RUNID, 5)
      assert.strictEqual(result.run.RUNID, 5)
      assert.deepStrictEqual(result.runParams, [{ PARAMKEY: 'CALIBRARE_MOD', PARAMVALUE: 'C' }])
    })

    it('rejects when there is no persisted CCCMINMAXDET row for the given key', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('COMPUTE_STARTEDAT FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUNPARAM'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET d'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('CCCMINMAXWEEK'))
        .reply(200, reply([]))

      const service = makeService()
      await assert.rejects(
        service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' }),
        /No CCCMINMAXDET row for RUNID=5, BRANCH=1000, MTRL=42/
      )
    })

    it('returns the det row, run header, winsor stats and dense weekly series', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('COMPUTE_STARTEDAT FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUNPARAM'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET d'))
        .reply(200, reply([{ BRANCH: 1000, ENG_MAX: 10, MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([{ MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('CCCMINMAXWEEK'))
        .reply(200, reply([{ QTY: 3, WEEK_INDEX: 0 }]))

      const service = makeService()
      const result = await service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' })

      assert.strictEqual(result.det.ENG_MAX, 10)
      assert.strictEqual(result.run.RUNID, 5)
      assert.strictEqual(result.winsor.MTRL, 42)
      assert.deepStrictEqual(result.weeklySeries, [{ QTY: 3, WEEK_INDEX: 0 }])
    })

    it('re-reads COV_TGT/SL/SSF exactly and merges them onto the column names', async () => {
      let detSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('COMPUTE_STARTEDAT FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUNPARAM'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => {
          const isDet = body.sqlQuery.includes('FROM CCCMINMAXDET d')
          if (isDet) detSql = body.sqlQuery
          return isDet
        })
        // What WSMCP actually returns: the raw columns rounded, the aliases exact.
        .reply(200, reply([{
          BRANCH: 1000,
          COV_TGT: 3,
          COV_TGT__EXACT: 2.75,
          MTRL: 42,
          RUNID: 5,
          SL: 95,
          SL__EXACT: 95,
          SSF: 1,
          SSF__EXACT: 1.28
        }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('CCCMINMAXWEEK'))
        .reply(200, reply([]))

      const service = makeService()
      const result = await service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' })

      assert.ok(detSql.includes('CONVERT(DECIMAL(28, 8), d.COV_TGT) AS COV_TGT__EXACT'))
      assert.strictEqual(result.det.COV_TGT, 2.75)
      assert.strictEqual(result.det.SSF, 1.28)
      assert.strictEqual(result.det.SL, 95)
      assert.ok(!('COV_TGT__EXACT' in result.det))
      assert.ok(!('SSF__EXACT' in result.det))
      assert.ok(!('SL__EXACT' in result.det))
    })

    it('builds the dense weekly series over 0..51, matching CCCMINMAXWEEK', async () => {
      let weekSql
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT RUNID FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('COMPUTE_STARTEDAT FROM CCCMINMAXRUN'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUNPARAM'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXDET d'))
        .reply(200, reply([{ BRANCH: 1000, MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([]))
        .post(EXEC_SQL_PATH, (body) => {
          const isWeek = body.sqlQuery.includes('CCCMINMAXWEEK')
          if (isWeek) weekSql = body.sqlQuery
          return isWeek
        })
        .reply(200, reply([]))

      const service = makeService()
      await service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' })

      assert.ok(weekSql.includes('SELECT 0 UNION ALL'))
      assert.ok(weekSql.includes('WEEK_INDEX < 51'))
    })
  })

  describe('saveParams()', () => {
    it('rejects a call with no updates at all', async () => {
      const service = makeService({ writesEnabled: true })
      await assert.rejects(service.saveParams({ token: 'tok' }), /saveParams called with no updates\./)
    })

    it('rejects with Forbidden when writes are disabled (flag OFF), even with valid payload', async () => {
      const service = makeService({ writesEnabled: false })
      const payload = {
        branchUpdates: [{ branch: 1000, estePodea: true, inclus: true, marime: 'M' }],
        covUpdates: [{ clasa: 'AX', cov: 1.5, marime: 'M' }],
        paramsUpdates: [{ paramKey: 'K', paramValue: 'V' }],
        token: 'tok'
      }
      await assert.rejects(service.saveParams(payload), (err) => {
        return err.code === 403 && err.message.includes('MINMAX_ENGINE_WRITES_ENABLED')
      })
    })

    it('allows saveParams when writes are enabled (flag ON) and calls the transport layer', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, (uri, body) => {
          capturedBody = body
          return { data: [{ affected: 1 }], success: true }
        })

      const service = makeService({ writesEnabled: true })
      const payload = {
        branchUpdates: [{ branch: 1000, estePodea: true, inclus: true, marime: 'M' }],
        covUpdates: [{ clasa: 'AX', cov: 1.5, marime: 'M' }],
        paramsUpdates: [{ paramKey: 'K', paramValue: 'V' }],
        token: 'tok'
      }
      const result = await service.saveParams(payload)

      assert.strictEqual(result.success, true)
      assert.ok(capturedBody, 'transport layer was called')
    })

    it('sends one atomic statements batch with exactly one OPENJSON parameter per statement', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, (uri, body) => {
          capturedBody = body
          return { data: [{ affected: 1 }], success: true }
        })

      const service = makeService({ writesEnabled: true })
      const result = await service.saveParams({
        branchUpdates: [{ branch: 1000, estePodea: true, inclus: true, marime: 'M' }],
        covUpdates: [{ clasa: 'AX', cov: 1.5, marime: 'M' }],
        paramsUpdates: [{ paramKey: 'K', paramValue: 'V' }],
        token: 'tok'
      })

      assert.strictEqual(result.success, true)
      // paramsUpdates emits an UPDATE + a guarded INSERT (both reuse the same
      // JSON payload); cov and branch emit one UPDATE each: 4 statements.
      assert.strictEqual(capturedBody.statements.length, 4)
      const totalParams = capturedBody.statements.reduce((sum, stmt) => sum + (stmt.params || []).length, 0)
      assert.strictEqual(totalParams, 4, 'exactly one bound OPENJSON parameter per statement')
      for (const stmt of capturedBody.statements) {
        assert.strictEqual(stmt.params.length, 1)
        assert.ok(stmt.sql.includes('OPENJSON(:1)'), `statement should bind OPENJSON at :1: ${stmt.sql}`)
        const guard = classifySql(stmt.sql)
        assert.ok(guard.ok, `statement should pass classifySql: ${stmt.sql} (${guard.reason})`)
      }
    })

    it('stays at 4 positional parameters even with 24 params + 33 COV + 18 branch updates in one save', async () => {
      let capturedBody
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, (uri, body) => {
          capturedBody = body
          return { data: [{ affected: 1 }], success: true }
        })

      const paramsUpdates = Array.from({ length: 24 }, (_, i) => ({ paramKey: `K${i}`, paramValue: `V${i}` }))
      const covUpdates = []
      for (const clasa of ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD']) {
        for (const marime of ['MARE', 'MEDIU', 'MIC']) {
          covUpdates.push({ clasa, cov: 1, marime })
        }
      }
      const branchUpdates = Array.from({ length: 18 }, (_, i) => ({ branch: 1000 + i, estePodea: false, inclus: true, marime: 'MIC' }))
      assert.strictEqual(covUpdates.length, 33)

      const service = makeService({ writesEnabled: true })
      const result = await service.saveParams({ branchUpdates, covUpdates, paramsUpdates, token: 'tok' })

      assert.strictEqual(result.success, true)
      assert.strictEqual(capturedBody.statements.length, 4)
      const totalParams = capturedBody.statements.reduce((sum, stmt) => sum + (stmt.params || []).length, 0)
      assert.strictEqual(totalParams, 4)
    })

    it('rejects a single collection larger than the row-count cap before composing SQL', async () => {
      const service = makeService({ writesEnabled: true })
      const covUpdates = Array.from({ length: 501 }, () => ({ clasa: 'AX', cov: 1, marime: 'MARE' }))
      await assert.rejects(
        service.saveParams({ covUpdates, token: 'tok' }),
        /Too many covUpdates rows in one save \(501 > 500\)/
      )
    })

    it('audits changed logical keys without leaking the new values (FAZA5_CONTRACT §12.8)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, () => reply([{ affected: 1 }]))

      const logged = []
      const originalInfo = logger.info
      logger.info = (message, ...args) => { logged.push(args[0] || message) }
      try {
        const service = makeService({ writesEnabled: true })
        await service.saveParams({
          branchUpdates: [{ branch: 1000, estePodea: true, inclus: true, marime: 'MARE' }],
          covUpdates: [{ clasa: 'AX', cov: 1.75, marime: 'MIC' }],
          paramsUpdates: [{ paramKey: 'SSF', paramValue: 'top-secret-value', scope: 'GLOBAL' }],
          token: 'tok'
        }, { authentication: { payload: { sub: 42 } } })
      } finally {
        logger.info = originalInfo
      }

      const auditLine = logged.find((line) => typeof line === 'string' && line.includes('"operation":"saveParams"'))
      assert.ok(auditLine, 'saveParams audit entry was logged')
      const entry = JSON.parse(auditLine)
      assert.strictEqual(entry.refid, 42)
      assert.ok(entry.timestamp, 'timestamp is present')
      assert.deepStrictEqual(entry.changedKeys.branchUpdates, [{ branch: 1000 }])
      assert.deepStrictEqual(entry.changedKeys.covUpdates, [{ clasa: 'AX', marime: 'MIC' }])
      assert.deepStrictEqual(entry.changedKeys.paramsUpdates, [{ paramKey: 'SSF', scope: 'GLOBAL', scopeKey: '' }])
      assert.ok(!auditLine.includes('top-secret-value'), 'audit must not log the new PARAMVALUE')
      assert.ok(!auditLine.includes('1.75'), 'audit must not log the new COV value')
    })
  })

  describe('_execStatements() transaction result interpretation (§12.1)', () => {
    it('rejects when WSMCP reports success:false for the transaction', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { error: 'Transaction failed', errorNumber: 547, failedStep: 2, success: false })

      const service = makeService()
      await assert.rejects(
        service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok'),
        (err) => err.message === 'Transaction failed' && err.failedStep === 2 && err.errNum === 547
      )
    })

    it('rejects when success:true but the status row reports __ok = 0 (lowercase)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { data: [{ __ok: 0, errMsg: 'FK violation', errNum: 547, failedStep: 3 }], success: true })

      const service = makeService()
      await assert.rejects(
        service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok'),
        (err) => err.message === 'FK violation' && err.failedStep === 3 && err.errNum === 547
      )
    })

    it('rejects when success:true but the status row is cased __OK (driver normalization)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { data: [{ __OK: 0, ERRMSG: 'FK violation', ERRNUM: 547, FAILEDSTEP: 3 }], success: true })

      const service = makeService()
      await assert.rejects(
        service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok'),
        (err) => err.message === 'FK violation' && err.failedStep === 3 && err.errNum === 547
      )
    })

    it('accepts a status row that explicitly reports __ok = 1', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { data: [{ __ok: 1 }], success: true })

      const service = makeService()
      const response = await service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok')
      assert.strictEqual(response.data[0].__ok, 1)
    })

    it('rejects when the transaction call returns no result rows at all', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { data: [], success: true })

      const service = makeService()
      await assert.rejects(
        service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok'),
        /S1 execSql returned no result for the transaction\./
      )
    })
  })

  describe('SoftOne platform error classification (shared with branch-replenishment-container.js)', () => {
    it('annotates a session-expired execSql response (code -1) as retryable', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery === 'SELECT 1')
        .reply(200, { code: -1, error: 'Invalid request. Please login first', success: false })

      const service = makeService()
      await assert.rejects(
        service._execSql('SELECT 1', [], 'tok'),
        (err) => err.softOneErrorCode === -1 && err.softOneRetryable === true &&
          err.softOneDescription === 'Invalid request. Please login first'
      )
    })

    it('annotates a non-retryable execSql response (code -8) accordingly', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery === 'SELECT 1')
        .reply(200, { code: -8, error: 'Invalid request. User account is not active!', success: false })

      const service = makeService()
      await assert.rejects(
        service._execSql('SELECT 1', [], 'tok'),
        (err) => err.softOneErrorCode === -8 && err.softOneRetryable === false
      )
    })

    it('leaves softOneErrorCode unset when the response carries no recognizable code', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery === 'SELECT 1')
        .reply(200, { error: 'Blocked SQL: some guard reason', success: false })

      const service = makeService()
      await assert.rejects(
        service._execSql('SELECT 1', [], 'tok'),
        (err) => err.softOneErrorCode === undefined
      )
    })

    it('annotates a rolled-back transaction reported via top-level success:false (e.g. session expired mid-batch)', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => Array.isArray(body.statements))
        .reply(200, { code: -101, error: 'Invalid Request, session has expired!', success: false })

      const service = makeService()
      await assert.rejects(
        service._execStatements([{ params: ['x'], sql: 'UPDATE CCCMINMAXCOV SET COV = :1' }], 'tok'),
        (err) => err.softOneErrorCode === -101 && err.softOneRetryable === true
      )
    })
  })

  // AJS transport dedicated to /JS/NewMinMax/<endpoint> (FAZA6_CONTRACT.md §3-5):
  // a separate HTTP surface from /JS/WSMCP/execSql, never a generic EXEC gateway.
  describe('AJS transport — runEngine/abandonRun/purgeRun (FAZA6_CONTRACT.md §3-5)', () => {
    function ajsReply (data) {
      return JSON.stringify(data)
    }

    describe('kill-switch (writesEnabled=false) checked before token/network', () => {
      it('rejects runEngine with Forbidden, no network call registered', async () => {
        const service = makeService({ writesEnabled: false })
        await assert.rejects(service.runEngine({ token: 'tok' }), (err) => err.name === 'Forbidden')
      })

      it('rejects abandonRun with Forbidden, no network call registered', async () => {
        const service = makeService({ writesEnabled: false })
        await assert.rejects(service.abandonRun({ runId: 6, token: 'tok' }), (err) => err.name === 'Forbidden')
      })

      it('rejects purgeRun with Forbidden, no network call registered', async () => {
        const service = makeService({ writesEnabled: false })
        await assert.rejects(service.purgeRun({ runId: 6, token: 'tok' }), (err) => err.name === 'Forbidden')
      })
    })

    describe('runEngine()', () => {
      it('starts a run, awaits the runPhases job-launch call, and returns {runId}', async () => {
        let startBody
        let phasesBody
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun', (body) => {
            startBody = body
            return true
          })
          .reply(200, ajsReply({ runId: 6, success: true }))
          .post('/JS/NewMinMax/runPhases', (body) => {
            phasesBody = body
            return true
          })
          .reply(200, ajsReply({ jobStarted: true, runId: 6, success: true }))

        const service = makeService({ writesEnabled: true })
        const result = await service.runEngine(
          { branchAssignmentMode: 'agent', createdBy: 999, token: 'tok' },
          { authentication: { payload: { sub: '104' } } }
        )

        // runEngine() now awaits runPhases (a fast Agent-job launch, not the
        // ~2 minute pipeline) before resolving, so a launch failure would
        // reach the caller instead of being logged silently.
        assert.deepStrictEqual(result, { runId: 6 })
        assert.strictEqual(startBody.authKey, 'unit-test-secret')
        assert.strictEqual(JSON.parse(startBody.JSONDATA).branchAssignmentMode, 'AGENT')
        assert.strictEqual(JSON.parse(startBody.JSONDATA).calibrareMod, 'C')
        assert.strictEqual(JSON.parse(startBody.JSONDATA).createdBy, 104, 'CREATEDBY must come from the signed JWT, not request data')
        assert.strictEqual(JSON.parse(phasesBody.JSONDATA).runId, 6)
      })

      it('rejects an unknown branch assignment mode before calling AJS', async () => {
        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ branchAssignmentMode: 'OTHER', token: 'tok' }),
          /branchAssignmentMode must be DOC, AGENT or CLIENT/
        )
      })

      it('rejects an unknown calibration metric before calling AJS', async () => {
        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ calibrareMod: 'OTHER', token: 'tok' }),
          /calibrareMod must be A, B or C/
        )
      })

      it('translates 50039 (session already OPEN) into a stable code instead of a generic error', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({
            error: 'sp_MinMaxEngine_StartRun: a session is already OPEN for this company.',
            errorCode: 50039,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'SESSION_ALREADY_OPEN' && err.sqlErrorCode === 50039
        )
      })

      it('rejects when startRun succeeds but returns no runId', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({ success: true }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(service.runEngine({ token: 'tok' }), /did not return a runId/)
      })

      it('propagates a runPhases launch failure instead of swallowing it — the OPEN session stays recoverable via abandonRun', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({ runId: 7, success: true }))
          .post('/JS/NewMinMax/runPhases')
          .replyWithError('network blip')

        const service = makeService({ writesEnabled: true })
        await assert.rejects(service.runEngine({ token: 'tok' }), /network blip/)
      })

      it('translates 50045 (runner setup missing) into a stable code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({
            error: "Agent job 'MEC_MinMaxEngine_RunPhases_1000' does not exist; run NewMinMax/setup.",
            errorCode: 50045,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'RUNNER_SETUP_MISSING' && err.sqlErrorCode === 50045
        )
      })

      it('translates 50046 (SQL Server Agent unavailable) into a stable code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({
            error: 'SQL Server Agent is not running.',
            errorCode: 50046,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'AGENT_UNAVAILABLE' && err.sqlErrorCode === 50046
        )
      })

      it('translates 50047 (no/ambiguous OPEN session) from runPhases into a stable code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({ runId: 8, success: true }))
          .post('/JS/NewMinMax/runPhases')
          .reply(200, ajsReply({
            error: 'runId does not match the sole OPEN session for this company.',
            errorCode: 50047,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'NO_OPEN_SESSION' && err.sqlErrorCode === 50047
        )
      })

      it('translates 50048 (runner already active) from runPhases into a stable code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({ runId: 9, success: true }))
          .post('/JS/NewMinMax/runPhases')
          .reply(200, ajsReply({
            error: 'The MIN/MAX runner job is already active for this company.',
            errorCode: 50048,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'RUNNER_ALREADY_ACTIVE' && err.sqlErrorCode === 50048
        )
      })

      it('translates 50049 (runner launch failed) from runPhases into a stable code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({ runId: 10, success: true }))
          .post('/JS/NewMinMax/runPhases')
          .reply(200, ajsReply({
            error: 'Failed to launch MIN/MAX phases job.',
            errorCode: 50049,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'RUNNER_LAUNCH_FAILED' && err.sqlErrorCode === 50049
        )
      })

      it('translates 50050 (runner readiness check failed) without calling runPhases', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/startRun')
          .reply(200, ajsReply({
            error: 'Failed to check MIN/MAX runner readiness.',
            errorCode: 50050,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.runEngine({ token: 'tok' }),
          (err) => err.code === 'RUNNER_READINESS_FAILED' && err.sqlErrorCode === 50050
        )
      })
    })

    describe('abandonRun()', () => {
      it('marks the session ABANDONED and returns its RUNID', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/abandonRun')
          .reply(200, ajsReply({ data: { finishedAt: '2026-09-08', sessionStatus: 'ABANDONED', status: 'ERROR' }, success: true }))

        const service = makeService({ writesEnabled: true })
        const result = await service.abandonRun({ runId: 6, token: 'tok' })
        assert.strictEqual(result.runId, 6)
        assert.strictEqual(result.sessionStatus, 'ABANDONED')
      })

      it('surfaces a 50040 failure with its recovered error code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/abandonRun')
          .reply(200, ajsReply({
            error: 'sp_MinMaxEngine_AbandonRun: RUNID does not exist for this company or is not OPEN.',
            errorCode: 50040,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.abandonRun({ runId: 999, token: 'tok' }),
          (err) => err.sqlErrorCode === 50040
        )
      })
    })

    describe('purgeRun()', () => {
      it('purges DET/WEEK/WINSOR and returns the deleted counts', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/purgeRun')
          .reply(200, ajsReply({
            data: { deletedDet: 706734, deletedWeek: 12345, deletedWinsor: 100 },
            success: true
          }))

        const service = makeService({ writesEnabled: true })
        const result = await service.purgeRun({ runId: 3, token: 'tok' })
        assert.strictEqual(result.runId, 3)
        assert.strictEqual(result.deletedDet, 706734)
      })

      it('surfaces a 50042 refusal (ESTE_CURENT=1) with its recovered error code', async () => {
        nock(FAKE_BASE_URL)
          .post('/JS/NewMinMax/purgeRun')
          .reply(200, ajsReply({
            error: 'sp_MinMaxEngine_PurgeRun: the current session cannot be purged.',
            errorCode: 50042,
            success: false
          }))

        const service = makeService({ writesEnabled: true })
        await assert.rejects(
          service.purgeRun({ runId: 5, token: 'tok' }),
          (err) => err.sqlErrorCode === 50042
        )
      })
    })
  })
})

