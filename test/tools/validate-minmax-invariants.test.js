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
  effectivePositiveParam,
  trendBase
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

  it('limits stock and pending supplier orders to active warehouses in active branches', () => {
    const compute = sqlSource('03_compute.sql')

    assert.match(compute, /WHERE w\.COMPANY = @Company\s+AND w\.ISACTIVE = 1\s+AND w\.CCCBRANCH IS NOT NULL/)
    assert.match(compute, /INSERT INTO #PendingSup[\s\S]*FROM #PendingSrc ps\s+INNER JOIN #RunBranches rb\s+ON rb\.BRANCH = ps\.BRANCH AND rb\.ESTE_HQ = 0\s+CROSS JOIN/)
  })

  it('adds open transfers to destination stock before aggregating HQ stock', () => {
    const compute = sqlSource('03_compute.sql')

    assert.match(compute, /md\.BRANCHSEC\) AS BRANCH[\s\S]*INTO #InTransit[\s\S]*f\.SOSOURCE = 1151[\s\S]*f\.FPRMS = 3153[\s\S]*f\.FULLYTRANSF = 0[\s\S]*md\.WHOUSESEC = 9999/)
    assert.match(compute, /FROM #StockBranch sb[\s\S]*UNION ALL[\s\S]*FROM #InTransit transit/)
    assert.match(compute, /INSERT INTO #Stock[\s\S]*FROM #Stock branchStock\s+CROSS JOIN/)
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

describe('MIN/MAX P1/P2 window netting contract', () => {
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
    assert.match(classify, /CASE WHEN SUM\(WINSORIZED_QTY\) < 0 THEN 0 ELSE SUM\(WINSORIZED_QTY\) END\s*\) AS NET_QTY[\s\S]*?INTO #ClientWeekly/)
    assert.doesNotMatch(classify, /RAW_NET_QTY/)
    assert.match(classify, /WHEN SUM\(CASE WHEN IN_W1 = 1 THEN WINSORIZED_QTY ELSE 0 END\) < 0 THEN 0[\s\S]*?INTO #ClientWindowTotals[\s\S]*?FROM #WinsorizedLines[\s\S]*?GROUP BY BRANCH, TRDR, MTRL;/)
    assert.match(classify, /INTO #BranchWindowTotals[\s\S]*?GROUP BY BRANCH, MTRL;/)
    assert.match(classify, /COALESCE\(windowTotals\.VZ_4S, 0\)/)
    assert.match(classify, /COALESCE\(windowTotals\.VAL_52S, 0\)/)
    assert.match(classify, /POWER\(COALESCE\(CONVERT\(FLOAT, weeklyStats\.WEEK_QTY_SUM\), 0\.0\), 2\)/)
    assert.match(classify, /MAX_LUNA_QTY > @ForceZLunaDominanta \* ac\.WEEK_QTY_SUM/)
  })

  it('nets HQ independently across branches for the same ERP client', () => {
    const clientLines = [
      { branch: 2100, quantity: 10 },
      { branch: 2200, quantity: -6 }
    ]
    const branchDemand = clientLines.reduce(
      (total, { quantity }) => total + Math.max(0, quantity),
      0
    )
    const hqDemand = Math.max(
      0,
      clientLines.reduce((total, { quantity }) => total + quantity, 0)
    )

    assert.strictEqual(branchDemand, 10)
    assert.strictEqual(hqDemand, 4)

    const classify = sqlSource('01_classify.sql')
    const hqWindowBlock = classify.match(/IF @HqDinAgregatCompanie = 1\s+BEGIN\s+INSERT INTO #ClientWindowTotals \([\s\S]*?GROUP BY hq\.BRANCH, cw\.TRDR, cw\.MTRL;\s+END;/)
    const hqWeeklyBlock = classify.match(/IF @HqDinAgregatCompanie = 1\s+BEGIN\s+INSERT INTO #BranchWeekly \([\s\S]*?GROUP BY hq\.BRANCH, bw\.MTRL, bw\.WEEK_INDEX;\s+END;/)

    assert.ok(hqWindowBlock, 'HQ window totals must be built at client level')
    assert.match(hqWindowBlock[0], /FROM #WinsorizedLines cw/)
    assert.match(hqWindowBlock[0], /sourceBranch\.ESTE_HQ = 0/)
    assert.match(hqWindowBlock[0], /WHEN SUM\(CASE WHEN cw\.IN_W1 = 1 THEN cw\.WINSORIZED_QTY ELSE 0 END\) < 0 THEN 0/)
    assert.match(hqWindowBlock[0], /WHEN SUM\(CASE WHEN cw\.IN_W4 = 1 THEN cw\.WINSORIZED_QTY ELSE 0 END\) < 0 THEN 0/)
    assert.ok(hqWeeklyBlock, 'HQ weekly totals must remain a separate series')
    assert.match(hqWeeklyBlock[0], /SUM\(bw\.QTY\)/)
    assert.doesNotMatch(hqWeeklyBlock[0], /RAW_NET_QTY/)
    assert.doesNotMatch(classify, /FROM #BranchWindowTotals totals[\s\S]*?sourceBranch\.ESTE_HQ = 0/)
  })
})

describe('MIN/MAX ON DEMAND purchasing guard', () => {
  it('keeps BUY at zero for ON DEMAND even when the floor lifted MIN/MAX', () => {
    const row = { lifecycle: 'OD', engMax: 2, stoc: 0, ordFurn: 0 }
    const buyRaw = row.lifecycle === 'OD'
      ? 0
      : Math.max(0, row.engMax - Math.max(0, row.stoc) - row.ordFurn)

    assert.strictEqual(buyRaw, 0)

    const compute = sqlSource('03_compute.sql')
    const buyUpdate = compute.match(/UPDATE #Calc\s+SET BUY_RAW = CONVERT\(DECIMAL\(28, 8\),[\s\S]*?END\);/)

    assert.ok(buyUpdate, 'BUY_RAW must still be assigned in a single update')
    assert.match(buyUpdate[0], /WHEN LIFECYCLE = 'OD' THEN 0/)
    // Podeaua ramane prag de prezentare: MIN/MAX raman ridicate, numai BUY este anulat.
    assert.match(compute, /UPDATE #Calc\s+SET ENG_MAX = ENG_MIN\s+WHERE ESTE_PODEA = 1 AND ENG_MIN > ENG_MAX;/)

    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'od_buy'/)
  })
})

describe('MIN/MAX demand recency contract', () => {
  it('measures SAPT_FARA in rounded weeks since the last sale, not in bucket indexes', () => {
    const saptFara = (zile) => Math.round(zile / 7)

    assert.strictEqual(saptFara(0), 0)
    assert.strictEqual(saptFara(3), 0)
    assert.strictEqual(saptFara(10), 1)
    assert.strictEqual(saptFara(273), 39)

    const classify = sqlSource('01_classify.sql')
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classify, /ROUND\(DATEDIFF\(DAY, weeklyStats\.ULT_VANZ, @Azi\) \/ 7\.0, 0\)[\s\S]*?\) AS SAPT_FARA/)
    assert.match(classifyGroup, /ROUND\(DATEDIFF\(DAY, MAX\(CASE WHEN QTY > 0 THEN LAST_POSITIVE_SALE END\), @Azi\) \/ 7\.0, 0\)[\s\S]*?\) AS SAPT_FARA/)
    for (const sql of [classify, classifyGroup]) {
      assert.doesNotMatch(sql, /MIN\(CASE WHEN QTY > 0 THEN WEEK_INDEX END\)/)
      assert.match(sql, /@NrSaptamani\s*\) AS SAPT_FARA/)
    }

    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'recenta'/)
  })
})

describe('MIN/MAX trend base contract', () => {
  it('compares the last 13 weeks against the 52-week average by default', () => {
    const trend = (base, vz13, vz26, vz52) => base === '13_26'
      ? (vz26 === 0 ? null : 2 * vz13 / vz26 - 1)
      : (vz52 === 0 ? null : 4 * vz13 / vz52 - 1)

    // T5 din matricea executabila: aceeasi serie, verdicte opuse pe cele doua baze.
    assert.strictEqual(trend('13_26', 30, 60, 240), 0)
    assert.strictEqual(trend('13_52', 30, 60, 240), -0.5)
    assert.strictEqual(trend('13_52', 0, 60, 240), -1)
    assert.strictEqual(trend('13_52', 0, 0, 0), null)

    assert.strictEqual(trendBase({}), '13_52')
    assert.strictEqual(trendBase({ TREND_BAZA: ' 13_26 ' }), '13_26')
    assert.strictEqual(trendBase({ TREND_BAZA: 'ALTCEVA' }), '13_52')

    const params = sqlSource('00_params.sql')
    const compute = sqlSource('03_compute.sql')

    assert.match(params, /\('TREND_BAZA',\s*'13_52',\s*'STR',\s*'GLOBAL'/)
    assert.match(compute, /PARAMKEY = 'TREND_BAZA'/)
    assert.match(compute, /IF @TrendBaza NOT IN \('13_26', '13_52'\) SET @TrendBaza = '13_52';/)

    const trendUpdate = compute.match(/TREND_PCT = CONVERT\(DECIMAL\(28, 8\),[\s\S]*?END\),/)
    assert.ok(trendUpdate, 'TREND_PCT must branch on the snapshot base')
    assert.match(trendUpdate[0], /WHEN @TrendBaza = '13_26' THEN 2\.0 \* VZ_13S \/ NULLIF\(VZ_26S, 0\) - 1/)
    assert.match(trendUpdate[0], /ELSE 4\.0 \* VZ_13S \/ NULLIF\(VZ_52S, 0\) - 1/)
  })

  it('gives NOU and OD their own status ahead of the trend thresholds', () => {
    const statusTrend = (lifecycle, trendPct) => {
      if (lifecycle === 'NOU') return 'NOU'
      if (lifecycle === 'OD') return 'OK'
      if (trendPct === null) return 'DECLINE'
      if (trendPct > 0.1) return 'ACTIVE'
      if (trendPct >= -0.1) return 'STABLE'
      if (trendPct >= -0.3) return 'TREND_DOWN'
      return 'DECLINE'
    }

    assert.strictEqual(statusTrend('NOU', -1), 'NOU')
    assert.strictEqual(statusTrend('OD', -1), 'OK')
    assert.strictEqual(statusTrend('STANDARD', -1), 'DECLINE')
    assert.strictEqual(statusTrend('STANDARD', null), 'DECLINE')

    const compute = sqlSource('03_compute.sql')
    const statusUpdate = compute.match(/STATUS_TREND =\s+CASE[\s\S]*?END;/)

    assert.ok(statusUpdate, 'STATUS_TREND must still be assigned in a single CASE')
    assert.match(statusUpdate[0], /WHEN LIFECYCLE = 'NOU' THEN 'NOU'\s+WHEN LIFECYCLE = 'OD' THEN 'OK'\s+WHEN TREND_PCT IS NULL THEN 'DECLINE'/)

    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'trend'/)

    // Statusurile de lifecycle trebuie sa fie si filtrabile, altfel randurile dispar din UI.
    const service = fs.readFileSync(path.join(root, 'src', 'services', 'minmax-engine', 'minmax-engine.class.js'), 'utf8')
    assert.match(service, /STATUS_TREND_VALUES = new Set\(\['ACTIVE', 'STABLE', 'TREND_DOWN', 'DECLINE', 'NOU', 'OK'\]\)/)
  })
})

describe('MIN/MAX N04 calendar day window contract', () => {
  it('derives sales lines from a calendar day window with a freezable anchor', () => {
    const salesLines = sqlSource('00c_sales_lines.sql')

    assert.doesNotMatch(salesLines, /DATEDIFF\(WEEK, f\.TRNDATE, @Azi\)/)
    assert.doesNotMatch(salesLines, /NRSAPT/)
    assert.match(salesLines, /DATEDIFF\(DAY, f\.TRNDATE, @Azi\) >= 0/)
    assert.match(salesLines, /DATEDIFF\(DAY, f\.TRNDATE, @Azi\) < @NrZile/)
    assert.match(salesLines, /CREATE OR ALTER FUNCTION dbo\.ufn_MinMaxSalesLines \(\s*@Company SMALLINT,\s*@ModAtribuireOverride VARCHAR\(10\),\s*@NrZileOverride INT,\s*@AziOverride DATE\s*\)/)

    // Ancora se poate ingheta: ramura @AziOverride trebuie sa preceada recalcularea din MAX(TRNDATE).
    const anchorOrder = salesLines.match(/IF @AziOverride IS NOT NULL[\s\S]*?ELSE[\s\S]*?MAX\(CONVERT\(DATE, f\.TRNDATE\)\)/)
    assert.ok(anchorOrder, '@AziOverride branch must precede the MAX(TRNDATE) recomputation')
  })

  it('keeps the weekly time axis separate from the new calendar day axis (the regression this guards against)', () => {
    const classify = sqlSource('01_classify.sql')

    // REGRESIA CARE CONTEAZA CEL MAI MULT: N04a a adaugat o axa in zile (IN_W1..IN_W4)
    // fara sa atinga seria saptamanala; daca cele doua axe s-ar fuziona, SIGMA_WK/SAPT_VZ/XYZ
    // ar deveni gresite in tacere. Testul pazeste separarea, nu doar prezenta textului.
    assert.match(classify, /INTO #ClientWeekly[\s\S]*?GROUP BY BRANCH, TRDR, MTRL, WEEK_INDEX;/)
    assert.match(classify, /INTO #WeeklyStats\s*FROM #BranchWeekly\s*WHERE WEEK_INDEX >= 0 AND WEEK_INDEX < @NrSaptamani/)
    assert.match(classify, /INTO #MonthlyBuckets\s*FROM #BranchWeekly\s*WHERE WEEK_INDEX >= 0 AND WEEK_INDEX < @NrSaptamani/)
  })

  it('uses @NrSaptamani, not a hardcoded 52, for the fourth window in SAPT mode', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /DATEDIFF\(WEEK, sl\.TRNDATE, sl\.AZI\) >= 0 AND DATEDIFF\(WEEK, sl\.TRNDATE, sl\.AZI\) < @NrSaptamani\)\s*THEN 1 ELSE 0\s*END AS IN_W4/)
  })

  it('does not clip VAL_52S to zero in #ClientWindowTotals', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /CONVERT\(DECIMAL\(28, 8\), SUM\(CASE WHEN IN_W4 = 1 THEN LTRNVAL ELSE 0 END\)\) AS VAL_52S/)
    assert.doesNotMatch(classify, /WHEN SUM\(CASE WHEN IN_W4 = 1 THEN LTRNVAL ELSE 0 END\) < 0 THEN 0/)
  })

  it('guards FERESTRE_CAPAT, FERESTRE_VZ_ZILE and the frozen anchor with dedicated THROWs', () => {
    const classify = sqlSource('01_classify.sql')
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classify, /THROW 50078, 'sp_MinMaxEngine_Classify: FERESTRE_CAPAT supports only \[0,N\)/)
    assert.match(classify, /THROW 50079, 'sp_MinMaxEngine_Classify: FERESTRE_VZ_ZILE exceeds NRZILE/)
    assert.match(classifyGroup, /THROW 50080, 'sp_MinMaxEngine_ClassifyGroup: the run has no frozen AZI/)
  })

  it('passes the frozen anchor from ClassifyGroup into ufn_MinMaxSalesLines', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classifyGroup, /dbo\.ufn_MinMaxSalesLines\(@Company, @ModAtribuire, @NrZile, @AziInghetat\)/)
  })

  it('seeds the four new N04a parameters with the documented defaults', () => {
    const params = sqlSource('00_params.sql')

    assert.match(params, /\('NRZILE',\s*'365',\s*'NUM',\s*'GLOBAL'/)
    assert.match(params, /\('FERESTRE_VZ_ZILE',\s*'28,91,182,365',\s*'STR',\s*'GLOBAL'/)
    assert.match(params, /\('FERESTRE_VZ',\s*'ZILE',\s*'STR',\s*'GLOBAL'/)
    assert.match(params, /\('FERESTRE_CAPAT',\s*'\[0,N\)',\s*'STR',\s*'GLOBAL'/)
  })

  it('exposes the ferestre_zile invariant in the validator', () => {
    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'ferestre_zile'/)
  })

  it('rejects a malformed FERESTRE_VZ_ZILE with THROW 50081 instead of shifting values silently', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /THROW 50081, 'sp_MinMaxEngine_Classify: FERESTRE_VZ_ZILE must contain exactly four positive, strictly increasing integers\.'/)
    assert.match(classify, /LEN\(@FerestreZileRaw\) - LEN\(REPLACE\(@FerestreZileRaw, ',', ''\)\)/)
    assert.doesNotMatch(classify, /SET @Zile1 = 28;/)
    assert.doesNotMatch(classify, /SET @Zile2 = 91;/)
    assert.doesNotMatch(classify, /SET @Zile3 = 182;/)
    assert.doesNotMatch(classify, /SET @Zile4 = 365;/)
  })

  it('drops the unused RAW_NET_QTY column while keeping the weekly NET_QTY clip in #ClientWeekly', () => {
    const classify = sqlSource('01_classify.sql')

    assert.doesNotMatch(classify, /RAW_NET_QTY/)
    assert.match(classify, /CASE WHEN SUM\(WINSORIZED_QTY\) < 0 THEN 0 ELSE SUM\(WINSORIZED_QTY\) END\s*\) AS NET_QTY[\s\S]*?INTO #ClientWeekly/)
  })
})