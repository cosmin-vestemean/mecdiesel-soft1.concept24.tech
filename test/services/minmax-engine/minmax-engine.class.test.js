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
  before(() => {
    nock.disableNetConnect()
  })

  after(() => {
    nock.enableNetConnect()
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
  })

  describe('explain()', () => {
    it('rejects when there is no persisted CCCMINMAXDET row for the given key', async () => {
      nock(FAKE_BASE_URL)
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUN WHERE RUNID'))
        .reply(200, reply([{ RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT * FROM CCCMINMAXDET'))
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
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXRUN WHERE RUNID'))
        .reply(200, reply([{ PARAMSJSON: '{}', RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.startsWith('SELECT * FROM CCCMINMAXDET'))
        .reply(200, reply([{ BRANCH: 1000, ENG_MAX: 10, MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('FROM CCCMINMAXWINSOR'))
        .reply(200, reply([{ MTRL: 42, RUNID: 5 }]))
        .post(EXEC_SQL_PATH, (body) => body.sqlQuery.includes('CCCMINMAXWEEK'))
        .reply(200, reply([{ QTY: 3, WEEK_INDEX: 1 }]))

      const service = makeService()
      const result = await service.explain({ branch: 1000, mtrl: 42, runId: 5, token: 'tok' })

      assert.strictEqual(result.det.ENG_MAX, 10)
      assert.strictEqual(result.run.RUNID, 5)
      assert.strictEqual(result.winsor.MTRL, 42)
      assert.deepStrictEqual(result.weeklySeries, [{ QTY: 3, WEEK_INDEX: 1 }])
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
})

