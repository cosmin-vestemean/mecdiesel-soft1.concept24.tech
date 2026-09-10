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
})