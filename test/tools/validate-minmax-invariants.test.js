import assert from 'assert'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const {
  buildInvariants,
  calibrationMode,
  effectivePositiveParam
} = require('../../new_min_max/tools/validate-minmax-invariants.cjs')

function sqlSource (fileName) {
  return fs.readFileSync(path.join(root, 'new_min_max', 'sql', fileName), 'utf8')
}

describe('validate-minmax-invariants snapshot parameters', () => {
  it('marks only the calibration metric selected by CALIBRARE_MOD as primary', () => {
    const invariants = buildInvariants(42, {
      CALIBRARE_MOD: 'B',
      HQ_CAP_FACTOR: '2',
      PROCENT_PODEA_BUC: '0.4'
    })
    const calibration = invariants.filter((invariant) => invariant.id.startsWith('calibrare_'))

    assert.deepStrictEqual(
      calibration.map((invariant) => [invariant.id, invariant.primary]),
      [['calibrare_a', false], ['calibrare_b', true], ['calibrare_c', false]]
    )
  })

  it('normalizes the selected calibration mode and rejects invalid snapshot values', () => {
    assert.strictEqual(calibrationMode({ CALIBRARE_MOD: ' a ' }), 'A')
    assert.throws(() => calibrationMode({ CALIBRARE_MOD: 'OTHER' }), /CALIBRARE_MOD invalid/)
  })

  it('uses the frozen positive value or the same fallback as Compute', () => {
    assert.strictEqual(effectivePositiveParam({ HQ_CAP_FACTOR: '2' }, 'HQ_CAP_FACTOR', 1.5), 2)
    assert.strictEqual(effectivePositiveParam({ HQ_CAP_FACTOR: '1.55555' }, 'HQ_CAP_FACTOR', 1.5), 1.5556)
    assert.strictEqual(effectivePositiveParam({ HQ_CAP_FACTOR: 'invalid' }, 'HQ_CAP_FACTOR', 1.5), 1.5)
    assert.strictEqual(effectivePositiveParam({ HQ_CAP_FACTOR: '0' }, 'HQ_CAP_FACTOR', 1.5), 1.5)
  })
})

describe('MIN/MAX SQL snapshot contract', () => {
  it('fails closed when a persisted phase has no run parameter snapshot', () => {
    const classify = sqlSource('01_classify.sql')
    const classifyGroup = sqlSource('02_classify_group.sql')
    const compute = sqlSource('03_compute.sql')

    const guard = (code) => new RegExp(
      "IF NOT EXISTS \\(\\s*SELECT 1 FROM CCCMINMAXRUNPARAM\\s*" +
      "WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = ''\\s*\\)\\s*THROW " + code
    )
    assert.match(classify, guard(50074))
    assert.match(classifyGroup, guard(50075))
    assert.match(compute, guard(50076))
  })

  it('keeps SIGMA_MIN zero valid while rejecting negative and non-numeric values', () => {
    for (const fileName of ['01_classify.sql', '02_classify_group.sql']) {
      const sql = sqlSource(fileName)
      assert.match(sql, /IF @SigmaMinRaw IS NULL\s+SET @SigmaMin = 1\.3/)
      assert.match(sql, /SET @SigmaMin = TRY_CONVERT\(DECIMAL\(28, 8\), @SigmaMinRaw\)/)
      assert.match(sql, /IF @SigmaMin < 0/)
      assert.doesNotMatch(sql, /IF @SigmaMin <= 0/)
    }
  })

  it('freezes CALIBRARE_MOD in StartRun together with the global parameters', () => {
    const startRun = sqlSource('00e_start_run.sql')
    assert.match(startRun, /@CalibrareMod NOT IN \('A', 'B', 'C'\)/)
    assert.match(startRun, /'CALIBRARE_MOD', @CalibrareMod/)
  })

  it('implements P6 branch-only snapshot and resolution without enabling prefixes', () => {
    const params = sqlSource('00_params.sql')
    const startRun = sqlSource('00e_start_run.sql')
    const classify = sqlSource('01_classify.sql')
    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')

    assert.match(params, /CREATE TABLE CCCMINMAXPARAMOVERRIDE/)
    assert.match(params, /PARAMKEY IN \('LT_ZILE', 'FRECVENTA_ZILE'\)/)
    assert.match(params, /BRANCH <> 0 OR PREFIX <> ''/)
    assert.match(params, /TRY_CONVERT\(INT, PARAMVALUE\) IS NOT NULL AND TRY_CONVERT\(INT, PARAMVALUE\) > 0/)
    assert.match(startRun, /FROM CCCMINMAXPARAMOVERRIDE o\s+WHERE o\.BRANCH > 0\s+AND o\.PREFIX = ''/)
    assert.match(startRun, /THROW 50056/)
    assert.match(classify, /IF @Persist = 1\s+INSERT INTO #ResolvedOverrides[\s\S]*FROM CCCMINMAXRUNPARAM/)
    assert.match(classify, /ELSE\s+INSERT INTO #ResolvedOverrides[\s\S]*FROM CCCMINMAXPARAMOVERRIDE/)
    assert.match(classify, /THROW 50077/)
    assert.match(classify, /COALESCE\(TRY_CONVERT\(INT, ltBranch\.PARAMVALUE\), @LtZileGlobal\) AS LT_ZILE/)
    assert.match(classify, /COALESCE\(TRY_CONVERT\(INT, freqBranch\.PARAMVALUE\), @FrecventaZileGlobal\) AS FRECVENTA_ZILE/)
    assert.match(classify, /LEFT JOIN #ResolvedOverrides ltBranch/)
    assert.match(validator, /id: 'parametri_branch'/)
    assert.match(validator, /lt\.RUNID = d\.RUNID AND lt\.BRANCH = d\.BRANCH/)
  })
})

describe('MIN/MAX P1 window netting contract', () => {
  it('nets a client across the whole window while preserving weekly demand buckets', () => {
    const lines = [
      { weekIndex: 0, quantity: 7 },
      { weekIndex: 0, quantity: 3 },
      { weekIndex: 1, quantity: -5 },
      { weekIndex: 1, quantity: -3 }
    ]
    const netWindow = (weekCount) => Math.max(
      0,
      lines
        .filter(({ weekIndex }) => weekIndex < weekCount)
        .reduce((total, { quantity }) => total + quantity, 0)
    )
    const weeklyTotals = new Map()
    for (const { weekIndex, quantity } of lines) {
      weeklyTotals.set(weekIndex, (weeklyTotals.get(weekIndex) || 0) + quantity)
    }
    const weeklySeries = [...weeklyTotals]
      .map(([weekIndex, quantity]) => ({ weekIndex, quantity: Math.max(0, quantity) }))
      .sort((left, right) => left.weekIndex - right.weekIndex)

    assert.strictEqual(netWindow(4), 2)
    assert.deepStrictEqual(weeklySeries, [
      { weekIndex: 0, quantity: 10 },
      { weekIndex: 1, quantity: 0 }
    ])

    const classify = sqlSource('01_classify.sql')
    assert.match(classify, /INTO #ClientWeekly[\s\S]*?GROUP BY BRANCH, TRDR, MTRL, WEEK_INDEX;/)
    assert.match(classify, /SUM\(WINSORIZED_QTY\) AS RAW_NET_QTY[\s\S]*?INTO #ClientWeekly/)
    assert.match(classify, /WHEN SUM\(CASE WHEN WEEK_INDEX < 4 THEN RAW_NET_QTY ELSE 0 END\) < 0 THEN 0[\s\S]*?INTO #ClientWindowTotals[\s\S]*?FROM #ClientWeekly[\s\S]*?GROUP BY BRANCH, TRDR, MTRL;/)
    assert.match(classify, /INTO #BranchWindowTotals[\s\S]*?GROUP BY BRANCH, MTRL;/)
    assert.match(classify, /COALESCE\(windowTotals\.VZ_4S, 0\)/)
    assert.match(classify, /COALESCE\(weeklyStats\.VAL_52S, 0\)/)
    assert.match(classify, /POWER\(COALESCE\(CONVERT\(FLOAT, weeklyStats\.WEEK_QTY_SUM\), 0\.0\), 2\)/)
    assert.match(classify, /MAX_LUNA_QTY > @ForceZLunaDominanta \* ac\.WEEK_QTY_SUM/)
    assert.match(classify, /FROM #BranchWindowTotals totals[\s\S]*?sourceBranch\.ESTE_HQ = 0/)
  })
})