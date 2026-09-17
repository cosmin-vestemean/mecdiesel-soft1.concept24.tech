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
    assert.match(classify, /INTO #ClientWeekly[\s\S]*?GROUP BY BRANCH, TRDR, MTRL, WEEK_BUCKET;/)
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
    const hqWeeklyBlock = classify.match(/IF @HqDinAgregatCompanie = 1\s+BEGIN\s+INSERT INTO #BranchWeekly \([\s\S]*?GROUP BY hq\.BRANCH, bw\.MTRL, bw\.WEEK_BUCKET;\s+END;/)

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
    assert.match(classifyGroup, /ROUND\(DATEDIFF\(DAY, iso\.ULT_VANZ, @Azi\) \/ 7\.0, 0\)[\s\S]*?\) AS SAPT_FARA/)
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
    assert.match(classify, /INTO #ClientWeekly[\s\S]*?GROUP BY BRANCH, TRDR, MTRL, WEEK_BUCKET;/)
    assert.match(classify, /INTO #RollingWeeklyStats\s*FROM #BranchWeekly\s*WHERE WEEK_BUCKET >= 0 AND WEEK_BUCKET < @NrSaptamani/)
    assert.match(classify, /INTO #MonthlyBuckets\s*FROM #BranchWeekly\s*WHERE WEEK_BUCKET >= 0 AND WEEK_BUCKET < @NrSaptamani/)
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

describe('MIN/MAX N04b weekly grid split contract', () => {
  it('seeds the two new N04b parameters with the documented defaults', () => {
    const params = sqlSource('00_params.sql')

    assert.match(params, /\('GRILA_SAPT',\s*'ROLLING',\s*'STR',\s*'GLOBAL'/)
    assert.match(params, /\('BAZA_SAPT_VZ',\s*'ISO',\s*'STR',\s*'GLOBAL'/)
  })

  it('guards GRILA_SAPT and BAZA_SAPT_VZ with dedicated THROWs instead of a silent fallback', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /IF @GrilaSapt IS NULL SET @GrilaSapt = 'ROLLING';/)
    assert.match(classify, /IF @BazaSaptVz IS NULL SET @BazaSaptVz = 'ISO';/)
    assert.match(classify, /THROW 50082, 'sp_MinMaxEngine_Classify: GRILA_SAPT must be ROLLING or CALENDAR\.'/)
    assert.match(classify, /THROW 50083, 'sp_MinMaxEngine_Classify: BAZA_SAPT_VZ must be ISO or GRILA\.'/)
  })

  it('splits the single weekly grid into a rolling WEEK_BUCKET and a DATEFIRST-independent ISO_WEEK', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /CASE WHEN @GrilaSapt = 'ROLLING' THEN lag\.DAY_LAG \/ 7\s+ELSE DATEDIFF\(WEEK, sl\.TRNDATE, sl\.AZI\) END AS WEEK_BUCKET,/)
    assert.match(classify, /CASE WHEN @BazaSaptVz = 'ISO' THEN iso\.ISO_WEEK_INDEX[\s\S]*?AS ISO_WEEK,/)
    assert.match(classify, /DATEADD\(DAY, -\(DATEDIFF\(DAY, '19000101', sl\.TRNDATE\) % 7\), sl\.TRNDATE\)/)
    assert.doesNotMatch(classify, /DATEPART\(WEEKDAY/)
  })

  it('keeps #ClientIsoWeekly/#BranchIsoWeekly lean and separate from the rolling grid', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /INTO #ClientIsoWeekly\s*FROM #WinsorizedLines\s*GROUP BY BRANCH, TRDR, MTRL, ISO_WEEK;/)
    assert.match(classify, /INTO #BranchIsoWeekly\s*FROM #ClientIsoWeekly\s*GROUP BY BRANCH, MTRL, ISO_WEEK;/)
    assert.match(classify, /IF @HqDinAgregatCompanie = 1\s+BEGIN\s+INSERT INTO #BranchIsoWeekly \([\s\S]*?GROUP BY hq\.BRANCH, bw\.MTRL, bw\.ISO_WEEK;\s+END;/)
  })

  it('derives BUCKETS_VZ from the rolling grid and uses it (not SAPT_VZ) in the sigma constant-demand guard', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /SUM\(CASE WHEN QTY > 0 THEN 1 ELSE 0 END\) AS BUCKETS_VZ\s*INTO #RollingWeeklyStats/)
    assert.match(classify, /WHEN COALESCE\(weeklyStats\.BUCKETS_VZ, 0\) = 0\s+OR \(weeklyStats\.BUCKETS_VZ = @NrSaptamani AND weeklyStats\.MIN_WEEK_QTY = weeklyStats\.MAX_WEEK_QTY\)/)
    assert.doesNotMatch(classify, /WHEN COALESCE\(weeklyStats\.SAPT_VZ, 0\) = 0/)
  })

  it('combines the rolling and ISO grids into #WeeklyStats with a join that cannot drop rows', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /INTO #WeeklyStats\s*FROM #RollingWeeklyStats rolling\s*FULL JOIN #IsoWeeklyStats iso/)
  })

  it('persists the rolling WEEK_BUCKET into the unchanged CCCMINMAXWEEK.WEEK_INDEX column', () => {
    const classify = sqlSource('01_classify.sql')

    assert.match(classify, /RUNID, COMPANY, BRANCH, MTRL, WEEK_INDEX,/)
    assert.match(classify, /CONVERT\(SMALLINT, BRANCH\), MTRL, CONVERT\(SMALLINT, WEEK_BUCKET\),/)
    assert.match(classify, /FROM #BranchWeekly\s*WHERE WEEK_BUCKET >= 0 AND WEEK_BUCKET < @NrSaptamani\s*AND \(QTY <> 0 OR SALES_VALUE <> 0\);/)

    const persist = sqlSource('00b_persist.sql')
    assert.match(persist, /WEEK_INDEX SMALLINT NOT NULL,/)
  })

  it('mirrors the split grid in ClassifyGroup, with its own THROWs (item 1c)', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classifyGroup, /CASE WHEN @GrilaSapt = 'ROLLING' THEN lag\.DAY_LAG \/ 7\s+ELSE DATEDIFF\(WEEK, sl\.TRNDATE, sl\.AZI\) END AS WEEK_BUCKET,/)
    assert.match(classifyGroup, /CASE WHEN @BazaSaptVz = 'ISO' THEN iso\.ISO_WEEK_INDEX[\s\S]*?AS ISO_WEEK,/)
    assert.match(classifyGroup, /THROW 50085, 'sp_MinMaxEngine_ClassifyGroup: GRILA_SAPT must be ROLLING or CALENDAR\.'/)
    assert.match(classifyGroup, /THROW 50086, 'sp_MinMaxEngine_ClassifyGroup: BAZA_SAPT_VZ must be ISO or GRILA\.'/)
    // Grila veche nu mai are niciun consumator: WEEK_INDEX era ultimul ei punct de sprijin.
    assert.doesNotMatch(classifyGroup, /DATEDIFF\(WEEK, sl\.TRNDATE, sl\.AZI\) AS WEEK_INDEX,/)
    // Sigma de grupa ramane pe grila rolling, iar SAPT_VZ/SAPT_8S pe cea ISO; nu se amesteca.
    assert.match(classifyGroup, /INTO #GroupRollingStats\s*FROM #WeeklySeries/)
    assert.match(classifyGroup, /SUM\(CASE WHEN ISO_WEEK < 8 AND QTY > 0 THEN 1 ELSE 0 END\) AS SAPT_8S,[\s\S]*?INTO #GroupIsoWeeklyStats/)
  })

  it('computes the group VZ windows on calendar days, symmetric with Classify (item 1c)', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classifyGroup, /THROW 50084, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_CAPAT supports only \[0,N\);/)
    assert.match(classifyGroup, /THROW 50087, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_VZ_ZILE must contain exactly four/)
    assert.match(classifyGroup, /THROW 50088, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_VZ_ZILE exceeds NRZILE/)
    assert.match(classifyGroup, /@FerestreVz = 'ZILE' AND lag\.DAY_LAG >= 0 AND lag\.DAY_LAG < @Zile1/)
    // Ferestrele vin din netting per client, nu din insumarea seriei saptamanale.
    assert.match(classifyGroup, /INTO #ClientWindowTotals\s*FROM #WinsorizedLines\s*GROUP BY BRANCH, TRDR, MTRL;/)
    assert.match(classifyGroup, /INTO #GroupWindowTotals\s*FROM #BranchWindowTotals\s*GROUP BY BRANCH, MTRGROUP;/)
    assert.doesNotMatch(classifyGroup, /SUM\(CASE WHEN WEEK_BUCKET < 4 THEN QTY ELSE 0 END\)\) AS VZ_4S/)
  })

  it('exposes the grila_sapt invariant in the validator', () => {
    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'grila_sapt'/)
  })

  it('exposes the vz_grp_det invariant in the validator (item 1c)', () => {
    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')
    assert.match(validator, /id: 'vz_grp_det'/)
  })
})

describe('MIN/MAX branch assignment default contract', () => {
  it('seeds MOD_ATRIBUIRE_FILIALA with AGENT', () => {
    assert.match(sqlSource('00_params.sql'), /\('MOD_ATRIBUIRE_FILIALA',\s*'AGENT',\s*'STR',\s*'GLOBAL'/)
  })

  it('falls back to AGENT in every stage that resolves the mode on its own', () => {
    assert.match(sqlSource('00e_start_run.sql'), /IF @BranchAssignmentMode = '' OR @BranchAssignmentMode IS NULL\s*SET @BranchAssignmentMode = 'AGENT';/)
    assert.match(sqlSource('00c_sales_lines.sql'), /IF @ModAtribuire NOT IN \('DOC', 'AGENT', 'CLIENT'\) OR @ModAtribuire IS NULL\s*SET @ModAtribuire = 'AGENT';/)
    assert.match(sqlSource('01_classify.sql'), /OR @ModAtribuire IS NULL SET @ModAtribuire = 'AGENT';/)
    assert.match(sqlSource('02_classify_group.sql'), /OR @ModAtribuire IS NULL SET @ModAtribuire = 'AGENT';/)
  })

  it('keeps all three modes selectable, so the default is a parameter and not a hardcoded rule', () => {
    assert.match(sqlSource('00e_start_run.sql'), /IF @BranchAssignmentMode NOT IN \('DOC', 'AGENT', 'CLIENT'\)\s*THROW 50052/)
  })

  it('re-derives live sales lines with the mode frozen in the snapshot, not with the current default', () => {
    const validator = fs.readFileSync(path.join(root, 'new_min_max', 'tools', 'validate-minmax-invariants.cjs'), 'utf8')

    assert.match(validator, /const modAtribuireRaw = String\(runParams\.MOD_ATRIBUIRE_FILIALA \|\| ''\)/)
    assert.doesNotMatch(validator, /\? modAtribuireRaw : 'CLIENT'/)
  })
})

describe('MIN/MAX retention purge contract (P17)', () => {
  it('keeps PurgeRun the final authority: current (50042), OPEN (50043) and pin (50053/ESTE_REPER) guards precede the 50044 retention throw', () => {
    const purgeRun = sqlSource('00h_purge_run.sql')

    assert.match(purgeRun, /IF COALESCE\(@EsteCurent, 0\) = 1\s*THROW 50042/)
    assert.match(purgeRun, /IF @SessionStatus = 'OPEN'\s*THROW 50043/)
    assert.match(purgeRun, /ESTE_REPER = 1\s*\)\s*THROW 50053/)
    assert.match(purgeRun, /THROW 50044, 'sp_MinMaxEngine_PurgeRun: RUNID is protected by RETENTIE_DET_SESIUNI\.'/)

    // Guard order in source: current, then OPEN, then pin, then retention window.
    const order = ['THROW 50042', 'THROW 50043', 'THROW 50053', 'THROW 50044']
      .map((needle) => purgeRun.indexOf(needle))
    assert.ok(order.every((pos) => pos > -1), 'all four guards present')
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i] > order[i - 1], `guard ${order[i]} must come after ${order[i - 1]}`)
    }
  })

  it('selector labels CURRENT/OPEN/PINNED/PROTECTED/PURGED before ELIGIBLE, never deletes, and drives from the same RETENTIE_DET_SESIUNI window as PurgeRun', () => {
    const selector = sqlSource('00k_purge_selector.sql')
    const purgeRun = sqlSource('00h_purge_run.sql')

    assert.doesNotMatch(selector, /\bDELETE\b/i)
    assert.match(selector, /PARAMKEY = 'RETENTIE_DET_SESIUNI'/)
    assert.match(selector, /IF COALESCE\(@RetentionCount, 0\) < 1 SET @RetentionCount = 2;/)

    // Same "protected" shape as PurgeRun: TOP(@RetentionCount) most recent
    // FULL/DONE runs, oldest excluded.
    assert.match(selector, /SELECT TOP \(@RetentionCount\) RUNID\s*FROM CCCMINMAXRUN\s*WHERE COMPANY = @Company\s*AND SCOPE = 'FULL'\s*AND SESSION_STATUS = 'DONE'\s*ORDER BY RUNID DESC/)
    assert.match(purgeRun, /SELECT TOP \(@RetentionCount\) RUNID\s*FROM CCCMINMAXRUN\s*WHERE COMPANY = @Company\s*AND SCOPE = 'FULL'\s*AND SESSION_STATUS = 'DONE'\s*ORDER BY RUNID DESC/)

    const casePos = selector.indexOf('CASE')
    const currentPos = selector.indexOf("'CURRENT'")
    const openPos = selector.indexOf("'OPEN'")
    const pinnedPos = selector.indexOf("'PINNED'")
    const protectedPos = selector.indexOf("'PROTECTED'")
    const purgedPos = selector.indexOf("'PURGED'")
    const eligiblePos = selector.indexOf("'ELIGIBLE'")
    for (const pos of [casePos, currentPos, openPos, pinnedPos, protectedPos, purgedPos, eligiblePos]) {
      assert.ok(pos > -1, 'every PURGE_STATUS branch is present')
    }
    // CASE evaluates in source order: CURRENT, OPEN, PINNED, PROTECTED, PURGED, ELIGIBLE.
    assert.ok(currentPos < openPos && openPos < pinnedPos && pinnedPos < protectedPos)
    assert.ok(protectedPos < purgedPos && purgedPos < eligiblePos)

    // Both terminal states are reclaimable. The retention window itself stays
    // deliberately limited to FULL/DONE, exactly like PurgeRun's 50044 guard.
    assert.match(selector, /WHEN r\.SESSION_STATUS IN \('DONE', 'ABANDONED'\)\s*AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXDET WHERE RUNID = r\.RUNID\)\s*AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXWEEK WHERE RUNID = r\.RUNID\)\s*AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXWINSOR WHERE RUNID = r\.RUNID\)\s*AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = r\.RUNID\) THEN 'PURGED'/)
    assert.match(selector, /WHEN r\.SESSION_STATUS IN \('DONE', 'ABANDONED'\) THEN 'ELIGIBLE'/)
    assert.doesNotMatch(selector, /WHEN r\.SCOPE = 'FULL' THEN 'ELIGIBLE'/)
  })

  it('executor picks oldest-first ELIGIBLE candidates, calls only sp_MinMaxEngine_PurgeRun up to 2 runs, never DELETEs RUN/GRP/RUNPARAM and never wraps the loop in a transaction', () => {
    const retention = sqlSource('00l_purge_retention.sql')

    assert.match(retention, /IF COALESCE\(@MaxRuns, 0\) < 1 OR @MaxRuns > 2 SET @MaxRuns = 2;/)
    assert.match(retention, /INSERT INTO #Selector \([^)]+\)\s*EXEC dbo\.sp_MinMaxEngine_PurgeSelector @Company = @Company;/)
    assert.match(retention, /SELECT TOP 1 @RunId = RUNID\s*FROM #Selector\s*WHERE PURGE_STATUS = 'ELIGIBLE'[\s\S]*?ORDER BY RUNID ASC;/)
    assert.match(retention, /EXEC dbo\.sp_MinMaxEngine_PurgeRun @Company = @Company, @RunId = @RunId, @BatchSize = @BatchSize;/)
    assert.match(retention, /RAISERROR\(N'MIN\/MAX retention purge failed for RUNID %d: %s', 10, 1, @RunId, @PurgeError\);/)

    // No DELETE of its own against a registry table (clearing the local
    // @PurgeResult table variable between iterations is fine), and no
    // direct DML against the header/registry tables either.
    assert.doesNotMatch(retention, /DELETE\s+FROM\s+CCCMINMAX/i)
    assert.doesNotMatch(retention, /(?:UPDATE|INSERT INTO)\s+CCCMINMAXRUN\b(?!PARAM)/i)
    assert.doesNotMatch(retention, /(?:UPDATE|INSERT INTO)\s+CCCMINMAXGRP\b/i)
    assert.doesNotMatch(retention, /(?:UPDATE|INSERT INTO)\s+CCCMINMAXRUNPARAM\b/i)

    // No global transaction wrapping the loop: a per-row failure is caught
    // and recorded, not rolled back batch-wide.
    assert.doesNotMatch(retention, /BEGIN TRANSACTION/i)
    assert.doesNotMatch(retention, /COMMIT TRANSACTION/i)
    assert.match(retention, /BEGIN TRY[\s\S]*EXEC dbo\.sp_MinMaxEngine_PurgeRun[\s\S]*END TRY\s*BEGIN CATCH/)
  })

  it('auto-purges at most once after a successful FinishRun, isolated in its own TRY/CATCH with no THROW and no engine error-column contamination', () => {
    const runPhases = sqlSource('00i_run_phases.sql')

    assert.match(runPhases, /EXEC dbo\.sp_MinMaxEngine_PurgeRetention @Company = @Company, @MaxRuns = 1;/)

    const finishRunThrowPos = runPhases.lastIndexOf('THROW;')
    const purgeCallPos = runPhases.indexOf('sp_MinMaxEngine_PurgeRetention')
    assert.ok(finishRunThrowPos > -1 && purgeCallPos > finishRunThrowPos, 'auto-purge runs after the engine CATCH/THROW block, i.e. only on a successful FinishRun')

    const purgeBlock = runPhases.slice(runPhases.indexOf('BEGIN TRY', purgeCallPos - 200))
    assert.match(purgeBlock, /BEGIN TRY\s*EXEC dbo\.sp_MinMaxEngine_PurgeRetention[\s\S]*END TRY\s*BEGIN CATCH/)
    assert.doesNotMatch(purgeBlock, /\bTHROW\b/)
    assert.doesNotMatch(purgeBlock, /ERRORMSG\s*=/)
    assert.match(purgeBlock, /RAISERROR\(.*10, 1/)
  })

  it('backfill job is one fixed TSQL step with a hardcoded @MaxRuns = 2 command, no schedule, setup-only and never started', () => {
    const backfill = sqlSource('00m_ensure_backfill_job.sql')

    assert.match(backfill, /MEC_MinMaxEngine_PurgeRetentionBackfill_/)
    assert.match(backfill, /N'EXEC dbo\.sp_MinMaxEngine_PurgeRetention @Company = '\s*\+\s*CONVERT\(NVARCHAR\(10\), @Company\) \+ N', @MaxRuns = 2;';/)
    assert.match(backfill, /COUNT\(\*\) FROM msdb\.dbo\.sysjobsteps sx WHERE sx\.job_id = j\.job_id\) = 1/)
    assert.match(backfill, /NOT EXISTS \(SELECT 1 FROM msdb\.dbo\.sysjobschedules sc WHERE sc\.job_id = j\.job_id\)/)
    // The comment documents that starting is manual (mentions sp_start_job in
    // prose); the procedure body itself must never issue that EXEC.
    assert.doesNotMatch(backfill, /EXEC\s+(?:msdb\.dbo\.)?sp_start_job/i)

    const ajsSource = fs.readFileSync(path.join(root, 'external', 'MEC', 'SyncItalia', 'S1', 'AJS', 'NewMinMax.js'), 'utf8')
    assert.match(ajsSource, /X\.RUNSQL\(getEnsureBackfillJobProcedureSql\(\), null\);\s*\/\/[\s\S]*?\s*X\.RUNSQL\("EXEC dbo\.sp_MinMaxEngine_EnsureBackfillJob @Company = " \+ X\.SYS\.COMPANY, null\);/)
    // sp_start_job is used elsewhere for the phase-runner job (runPhases);
    // the backfill job must never be auto-started the same way.
    assert.doesNotMatch(ajsSource, /sp_start_job[\s\S]{0,200}Backfill/)
    assert.doesNotMatch(ajsSource, /Backfill[\s\S]{0,200}sp_start_job/)
  })
})

describe('MIN/MAX P16 frozen sales-line snapshot contract', () => {
  it('declares CCCMINMAXSALES idempotently with the exact 14-column projection plus RUNID, keyed by a RUNID-leading clustered index (not a PK, since MTRTRN/LINENUM uniqueness is unconfirmed)', () => {
    const persist = sqlSource('00b_persist.sql')

    assert.match(persist, /IF NOT EXISTS \(SELECT \* FROM sysobjects WHERE name='CCCMINMAXSALES' AND xtype='U'\)\s*CREATE TABLE CCCMINMAXSALES \(/)

    const tableStart = persist.indexOf('CREATE TABLE CCCMINMAXSALES (')
    const tableEnd = persist.indexOf(');', tableStart)
    const tableBody = persist.slice(tableStart, tableEnd)

    for (const columnDecl of [
      'RUNID INT NOT NULL,',
      'COMPANY SMALLINT NOT NULL,',
      'FINDOC INT NOT NULL,',
      'MTRTRN INT NOT NULL,',
      'LINENUM INT NOT NULL,',
      'TRNDATE DATETIME NOT NULL,',
      'AZI DATE NOT NULL,',
      'TRDR INT NOT NULL,',
      'TRDRCODE VARCHAR(30) NULL,',
      'MTRL INT NOT NULL,',
      'MTRSUP INT NULL,',
      'CODE VARCHAR(50) NOT NULL,',
      'BRANCH SMALLINT NULL,',
      'QTY DECIMAL(28, 8) NOT NULL,',
      'LTRNVAL DECIMAL(28, 8) NOT NULL'
    ]) {
      assert.ok(tableBody.includes(columnDecl), `CCCMINMAXSALES is missing column declaration: ${columnDecl}`)
    }

    // No PRIMARY KEY / UNIQUE on this table: uniqueness of MTRTRN/LINENUM is
    // an open question (RESTANTE_INTERNE.md P16), so the constraint would be
    // an unverified assumption baked into the schema.
    assert.doesNotMatch(tableBody, /PRIMARY KEY|UNIQUE/)

    assert.match(persist, /IF NOT EXISTS \(SELECT \* FROM sys\.indexes WHERE name='IX_CCCMINMAXSALES_RUNID' AND object_id = OBJECT_ID\('CCCMINMAXSALES'\)\)\s*CREATE CLUSTERED INDEX IX_CCCMINMAXSALES_RUNID ON CCCMINMAXSALES\(RUNID\);/)
  })

  it('Classify (@Persist=1) refreshes the full CCCMINMAXSALES snapshot for @RunId before any @Mtrl filter, then reads #SalesLines only from that snapshot; preview alone calls the live UDF', () => {
    const classify = sqlSource('01_classify.sql')

    const persistBranchMatch = classify.match(/IF @Persist = 1\s*BEGIN\s*DELETE FROM CCCMINMAXSALES WHERE RUNID = @RunId;([\s\S]*?)END\s*ELSE\s*BEGIN([\s\S]*?)END;\s*SELECT @Azi = MAX\(AZI\) FROM #SalesLines;/)
    assert.ok(persistBranchMatch, 'expected an IF @Persist = 1 / ELSE branch around #SalesLines extraction')

    const [, persistBody, previewBody] = persistBranchMatch

    // The full-population write must not carry the @Mtrl filter.
    const insertMatch = persistBody.match(/INSERT INTO CCCMINMAXSALES \([\s\S]*?\)\s*SELECT[\s\S]*?FROM dbo\.ufn_MinMaxSalesLines\(@Company, @ModAtribuire, @NrZile, NULL\);/)
    assert.ok(insertMatch, 'expected an unfiltered INSERT INTO CCCMINMAXSALES from the live UDF')
    assert.doesNotMatch(insertMatch[0], /@Mtrl/)

    // #SalesLines must be sourced from the snapshot, filtered by @Mtrl only here.
    assert.match(persistBody, /INSERT INTO #SalesLines \([\s\S]*?\)\s*SELECT[\s\S]*?FROM CCCMINMAXSALES\s*WHERE RUNID = @RunId\s*AND \(@Mtrl IS NULL OR MTRL = @Mtrl\);/)
    assert.doesNotMatch(persistBody.slice(persistBody.indexOf('INSERT INTO #SalesLines')), /ufn_MinMaxSalesLines/)

    // The DELETE (refresh) must precede the INSERT, which must precede the snapshot read.
    const insertPos = persistBody.indexOf('INSERT INTO CCCMINMAXSALES')
    const readPos = persistBody.indexOf('FROM CCCMINMAXSALES')
    assert.ok(insertPos > -1 && readPos > insertPos, 'INSERT must precede the snapshot read')

    // Preview keeps calling the live UDF with the @Mtrl filter, untouched.
    assert.match(previewBody, /INSERT INTO #SalesLines \([\s\S]*?\)\s*SELECT[\s\S]*?FROM dbo\.ufn_MinMaxSalesLines\(@Company, @ModAtribuire, @NrZile, NULL\)\s*WHERE @Mtrl IS NULL OR MTRL = @Mtrl;/)
    assert.strictEqual((classify.match(/CREATE TABLE #SalesLines/g) || []).length, 1)
    assert.doesNotMatch(classify, /^\s*INTO #SalesLines\b/m)
  })

  it('ClassifyGroup (@Persist=1) reads #SalesLines only from CCCMINMAXSALES for @RunId, guards an empty/missing snapshot with a distinct THROW, and never falls back to the live UDF; preview keeps calling the UDF', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')

    const persistBranchMatch = classifyGroup.match(/IF @Persist = 1\s*BEGIN\s*IF NOT EXISTS \(SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = @RunId\)\s*THROW (\d+), '([^']+)', 1;([\s\S]*?)END\s*ELSE\s*BEGIN([\s\S]*?)END;\s*SELECT @Azi = MAX\(AZI\) FROM #SalesLines;/)
    assert.ok(persistBranchMatch, 'expected an IF @Persist = 1 / ELSE branch guarding and reading CCCMINMAXSALES')

    const [, throwCode, throwMessage, persistBody, previewBody] = persistBranchMatch

    // Distinct code from every other THROW already in this procedure (50001-50088 range).
    assert.strictEqual(throwCode, '50089')
    assert.match(throwMessage, /no sales snapshot found for this RUNID/)
    assert.match(throwMessage, /sp_MinMaxEngine_Classify must run first/)

    assert.match(persistBody, /INSERT INTO #SalesLines \([\s\S]*?\)\s*SELECT[\s\S]*?FROM CCCMINMAXSALES\s*WHERE RUNID = @RunId;/)
    assert.doesNotMatch(persistBody, /ufn_MinMaxSalesLines/)

    // Preview is unchanged: live UDF, frozen-AZI override, no snapshot involved.
    assert.match(previewBody, /INSERT INTO #SalesLines \([\s\S]*?\)\s*SELECT[\s\S]*?FROM dbo\.ufn_MinMaxSalesLines\(@Company, @ModAtribuire, @NrZile, @AziInghetat\);/)
    assert.doesNotMatch(previewBody, /CCCMINMAXSALES/)
    assert.strictEqual((classifyGroup.match(/CREATE TABLE #SalesLines/g) || []).length, 1)
    assert.doesNotMatch(classifyGroup, /^\s*INTO #SalesLines\b/m)
  })

  it('does not derive #Groups/#ItemGroups from CCCMINMAXDET: vz_grp_det stays an independent reconciliation invariant', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')
    assert.doesNotMatch(classifyGroup, /CCCMINMAXDET/)
  })

  it('extends retention (PurgeRun) and the read-only selector diagnostic (PurgeSelector) to CCCMINMAXSALES alongside DET/WEEK/WINSOR', () => {
    const purgeRun = sqlSource('00h_purge_run.sql')
    const selector = sqlSource('00k_purge_selector.sql')

    // PurgeRun: batched delete loop, same shape as the DET/WEEK/WINSOR loops,
    // running after the existing pin/OPEN/current/retention guards (50042/50043/50053/50044).
    assert.match(purgeRun, /DECLARE @DeletedSales INT = 0;/)
    assert.match(purgeRun, /DELETE TOP \(@BatchSize\)\s*FROM CCCMINMAXSALES\s*WHERE RUNID = @RunId;\s*SET @Affected = @@ROWCOUNT;\s*SET @DeletedSales = @DeletedSales \+ @Affected;/)
    assert.match(purgeRun, /@DeletedSales AS DELETED_SALES/)

    const detLoopPos = purgeRun.indexOf('FROM CCCMINMAXDET\n        WHERE RUNID = @RunId;')
    const salesLoopPos = purgeRun.indexOf('FROM CCCMINMAXSALES\n        WHERE RUNID = @RunId;')
    assert.ok(detLoopPos > -1 && salesLoopPos > detLoopPos, 'CCCMINMAXSALES purge loop runs after the DET loop')

    const pinGuardPos = purgeRun.indexOf('THROW 50053')
    assert.ok(pinGuardPos > -1 && salesLoopPos > pinGuardPos, 'the pin/retention guards must still run before any delete loop')

    // PurgeSelector: HAS_SALES alongside HAS_DET/HAS_WEEK/HAS_WINSOR, and the
    // PURGED classification requires all four to be absent (read-only, no DELETE).
    assert.doesNotMatch(selector, /\bDELETE\b/i)
    assert.match(selector, /CASE WHEN EXISTS \(SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = r\.RUNID\) THEN 1 ELSE 0 END AS HAS_SALES/)
    assert.match(selector, /AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXWINSOR WHERE RUNID = r\.RUNID\)\s*AND NOT EXISTS \(SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = r\.RUNID\) THEN 'PURGED'/)
  })

  it('keeps the AJS mirror (S1-MEC/AJS/NewMinMax.js) byte-identical to the P16 SQL sources', () => {
    const { toSqlLines } = require('../../new_min_max/tools/sql-to-js.cjs')
    const js = fs.readFileSync(path.join(root, 'S1-MEC/AJS/NewMinMax.js'), 'utf8')

    function extract (fn) {
      const i = js.indexOf('function ' + fn)
      const s = js.indexOf('return [', i)
      const e = js.indexOf('].join("\\n");', s)
      const body = js.slice(s + 'return ['.length, e).trim().replace(/,$/, '')
      return JSON.parse('[' + body + ']')
    }

    for (const [fn, rel] of [
      ['getPersistTablesSql', '00b_persist.sql'],
      ['getClassifyProcedureSql', '01_classify.sql'],
      ['getClassifyGroupProcedureSql', '02_classify_group.sql'],
      ['getPurgeRunSql', '00h_purge_run.sql'],
      ['getPurgeSelectorSql', '00k_purge_selector.sql'],
      ['getPurgeRetentionSql', '00l_purge_retention.sql']
    ]) {
      const fromJs = extract(fn)
      const expected = toSqlLines(sqlSource(rel))
      assert.deepStrictEqual(fromJs, expected, `${fn} mirror drifted from ${rel}`)
    }
  })

  it('fails closed (THROW 50090) when the persisted snapshot AZI does not match the frozen run AZI, with no UDF fallback', () => {
    const classifyGroup = sqlSource('02_classify_group.sql')

    assert.match(classifyGroup, /IF @Persist = 1 AND @Azi <> @AziInghetat\s*THROW 50090, 'sp_MinMaxEngine_ClassifyGroup: the sales snapshot AZI does not match the frozen run AZI\.', 1;/)

    // 50090 must be a single, distinct error code, checked only after the
    // no-lines guard (50001) and only on the persisted path.
    const codes = [...classifyGroup.matchAll(/THROW (\d+),/g)].map((m) => m[1])
    assert.strictEqual(codes.filter((c) => c === '50090').length, 1, '50090 must be used exactly once')
    assert.ok(classifyGroup.indexOf('THROW 50090') > classifyGroup.indexOf('THROW 50001'), '50090 guard must run after the no-lines guard')
  })

  it('keeps the #Selector shape in PurgeRetention exactly aligned with PurgeSelector\'s result-set (guards the positional INSERT ... EXEC contract)', () => {
    const selector = sqlSource('00k_purge_selector.sql')
    const retention = sqlSource('00l_purge_retention.sql')

    const expectedColumns = [
      'RUNID', 'SCOPE', 'SESSION_STATUS', 'ESTE_CURENT', 'ESTE_REPER',
      'HAS_DET', 'HAS_WEEK', 'HAS_WINSOR', 'HAS_SALES', 'IS_RETENTION_PROTECTED', 'PURGE_STATUS'
    ]

    // PurgeSelector's final SELECT projects each column in this exact order.
    const selectorPositions = expectedColumns.map((col) => {
      const pos = selector.search(new RegExp(`(?:AS |r\\.)${col}\\b`))
      assert.ok(pos > -1, `PurgeSelector must project ${col}`)
      return pos
    })
    for (let i = 1; i < selectorPositions.length; i += 1) {
      assert.ok(selectorPositions[i] > selectorPositions[i - 1], `PurgeSelector must project ${expectedColumns[i]} after ${expectedColumns[i - 1]}`)
    }

    // #Selector's CREATE TABLE column order must match exactly (positional INSERT ... EXEC target).
    const declStart = retention.indexOf('CREATE TABLE #Selector (') + 'CREATE TABLE #Selector ('.length
    const declEnd = retention.indexOf(');', declStart)
    const declaredColumns = retention.slice(declStart, declEnd)
      .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/)[0])
    assert.deepStrictEqual(declaredColumns, expectedColumns)

    // The explicit INSERT column list must repeat the same order (no positional guessing).
    const insertMatch = retention.match(/INSERT INTO #Selector \(([^)]+)\)\s*EXEC dbo\.sp_MinMaxEngine_PurgeSelector/)
    assert.ok(insertMatch, 'expected an explicit column list on INSERT INTO #Selector ... EXEC')
    assert.deepStrictEqual(insertMatch[1].split(',').map((c) => c.trim()), expectedColumns)
  })

  it('keeps @PurgeResult/@Result in PurgeRetention aligned with PurgeRun\'s result-set (DELETED_SALES end-to-end)', () => {
    const purgeRun = sqlSource('00h_purge_run.sql')
    const retention = sqlSource('00l_purge_retention.sql')

    const expectedColumns = ['RUNID', 'DELETED_WEEK', 'DELETED_WINSOR', 'DELETED_DET', 'DELETED_SALES']

    // PurgeRun's final SELECT projects each column in this exact order.
    const purgeRunPositions = expectedColumns.map((col) => {
      const pos = purgeRun.search(new RegExp(`@\\w+ AS ${col}\\b`))
      assert.ok(pos > -1, `PurgeRun must project ${col}`)
      return pos
    })
    for (let i = 1; i < purgeRunPositions.length; i += 1) {
      assert.ok(purgeRunPositions[i] > purgeRunPositions[i - 1], `PurgeRun must project ${expectedColumns[i]} after ${expectedColumns[i - 1]}`)
    }

    // @PurgeResult is the positional INSERT ... EXEC target for PurgeRun; its declared
    // shape and explicit column list must match exactly, including DELETED_SALES.
    const purgeResultMatch = retention.match(/DECLARE @PurgeResult TABLE \(([^)]+)\);/)
    assert.ok(purgeResultMatch)
    assert.deepStrictEqual(purgeResultMatch[1].split(',').map((c) => c.trim().split(/\s+/)[0]), expectedColumns)

    const insertMatch = retention.match(/INSERT INTO @PurgeResult \(([^)]+)\)\s*EXEC dbo\.sp_MinMaxEngine_PurgeRun/)
    assert.ok(insertMatch, 'expected an explicit column list on INSERT INTO @PurgeResult ... EXEC')
    assert.deepStrictEqual(insertMatch[1].split(',').map((c) => c.trim()), expectedColumns)

    // @Result and the final SELECT must carry DELETED_SALES through end-to-end too.
    assert.match(retention, /DECLARE @Result TABLE \(\s*RUNID INT NOT NULL,\s*DELETED_WEEK INT NULL,\s*DELETED_WINSOR INT NULL,\s*DELETED_DET INT NULL,\s*DELETED_SALES INT NULL,\s*ERRORMSG NVARCHAR\(500\) NULL\s*\);/)
    assert.match(retention, /SELECT RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, NULL FROM @PurgeResult;/)
    assert.match(retention, /VALUES \(@RunId, NULL, NULL, NULL, NULL, @PurgeError\);/)
    assert.match(retention, /SELECT RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, ERRORMSG\s*FROM @Result/)
  })

  it('maps DELETED_SALES/HAS_SALES to camelCase in the AJS purgeRun/purgeSelector endpoint methods', () => {
    const js = fs.readFileSync(path.join(root, 'S1-MEC/AJS/NewMinMax.js'), 'utf8')

    const purgeRunStart = js.indexOf('function purgeRun(obj) {')
    const purgeRunEnd = js.indexOf('\nfunction ', purgeRunStart + 1)
    assert.ok(purgeRunStart > -1 && purgeRunEnd > purgeRunStart)
    assert.match(js.slice(purgeRunStart, purgeRunEnd), /deletedSales: ds\.DELETED_SALES/)

    const purgeSelectorStart = js.indexOf('function purgeSelector(obj) {')
    const purgeSelectorEnd = js.indexOf('\nfunction ', purgeSelectorStart + 1)
    assert.ok(purgeSelectorStart > -1 && purgeSelectorEnd > purgeSelectorStart)
    assert.match(js.slice(purgeSelectorStart, purgeSelectorEnd), /hasSales: ds\.HAS_SALES/)
  })

  it('includes CCCMINMAXSALES in the setup() response tables array, exactly once, in the correct position (after RUNPARAM, before DET)', () => {
    const js = fs.readFileSync(path.join(root, 'S1-MEC/AJS/NewMinMax.js'), 'utf8')

    // Find the setup function and its return statement with the tables array
      const setupMatch = js.match(/function setup\(obj\)\s*\{[\s\S]*?return JSON\.stringify\(\{\s*success:\s*true,\s*tables:\s*\[([\s\S]*?)\],/m)
    assert.ok(setupMatch && setupMatch[1], 'setup() must return a JSON object with a tables array')

    const tablesContent = setupMatch[1]
    const tables = tablesContent.split(',').map((t) => t.trim().replace(/["\s]/g, '')).filter(Boolean)

    // Verify CCCMINMAXSALES appears exactly once
    const salesCount = tables.filter((t) => t === 'CCCMINMAXSALES').length
    assert.strictEqual(salesCount, 1, 'CCCMINMAXSALES must appear exactly once in the tables array')

    // Verify it comes after RUNPARAM and before DET
    const salesIdx = tables.indexOf('CCCMINMAXSALES')
    const runparamIdx = tables.indexOf('CCCMINMAXRUNPARAM')
    const detIdx = tables.indexOf('CCCMINMAXDET')
    assert.ok(runparamIdx >= 0 && detIdx >= 0 && salesIdx >= 0, 'CCCMINMAXRUNPARAM and CCCMINMAXDET must both be present')
    assert.strictEqual(salesIdx, runparamIdx + 1, 'CCCMINMAXSALES must come immediately after CCCMINMAXRUNPARAM')
    assert.ok(salesIdx < detIdx, 'CCCMINMAXSALES must come before CCCMINMAXDET')
  })
})
