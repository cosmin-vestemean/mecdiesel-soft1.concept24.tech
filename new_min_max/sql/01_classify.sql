-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — Faza 2: dbo.sp_MinMaxEngine_Classify
-- Clasificare SKU (LIFECYCLE, ABC per grupă, XYZ lunar 12 buckets, COV_TGT, SL, AVG, ad)
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_Classify
    @Company SMALLINT,
    @Mtrl INT = NULL,
    @SummaryOnly BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- ---------------------------------------------------------------
    -- 1. Citire parametri din CCCMINMAXPARAMS
    -- ---------------------------------------------------------------
    DECLARE @NrSaptamani INT;
    DECLARE @WinsorPct FLOAT;
    DECLARE @WinsorMinLinii INT;
    DECLARE @WinsorSubPrag VARCHAR(10);
    DECLARE @SigmaMin DECIMAL(28, 8);
    DECLARE @HqDinAgregatCompanie BIT;
    DECLARE @PragRecHq INT;
    DECLARE @PragRecBr INT;
    DECLARE @SlA DECIMAL(10, 4);
    DECLARE @SlB DECIMAL(10, 4);
    DECLARE @SlC DECIMAL(10, 4);
    DECLARE @SsfGlobal DECIMAL(10, 4);
    DECLARE @LtZileGlobal INT;
    DECLARE @FrecventaZileGlobal INT;
    DECLARE @Azi DATE;
    DECLARE @PercentileSql NVARCHAR(MAX);
    DECLARE @WinsorPctSql VARCHAR(32);

    SELECT @NrSaptamani = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'NRSAPT' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @WinsorPct = TRY_CONVERT(FLOAT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'WINSOR_PCT' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @WinsorMinLinii = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'WINSOR_MIN_LINII' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @WinsorSubPrag = UPPER(LTRIM(RTRIM(PARAMVALUE)))
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'WINSOR_SUB_PRAG' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SigmaMin = TRY_CONVERT(DECIMAL(28, 8), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SIGMA_MIN' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @HqDinAgregatCompanie = TRY_CONVERT(BIT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'HQ_DIN_AGREGAT_COMPANIE' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @PragRecHq = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'PRAG_REC_HQ' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @PragRecBr = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'PRAG_REC_BR' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SlA = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SL_A' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SlB = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SL_B' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SlC = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SL_C' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SsfGlobal = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SSF' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @LtZileGlobal = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'LT_ZILE' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @FrecventaZileGlobal = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'FRECVENTA_ZILE' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF COALESCE(@NrSaptamani, 0) <= 0 SET @NrSaptamani = 52;
    IF @WinsorPct IS NULL OR @WinsorPct <= 0 OR @WinsorPct > 1 SET @WinsorPct = 0.95;
    IF COALESCE(@WinsorMinLinii, 0) <= 0 SET @WinsorMinLinii = 8;
    IF @WinsorSubPrag NOT IN ('NONE', 'MEDIANA') OR @WinsorSubPrag IS NULL SET @WinsorSubPrag = 'MEDIANA';
    IF COALESCE(@SigmaMin, 0) <= 0 SET @SigmaMin = 1.3;
    SET @HqDinAgregatCompanie = COALESCE(@HqDinAgregatCompanie, 1);
    IF COALESCE(@PragRecHq, 0) <= 0 SET @PragRecHq = 39;
    IF COALESCE(@PragRecBr, 0) <= 0 SET @PragRecBr = 26;
    IF COALESCE(@SlA, 0) <= 0 SET @SlA = 95.0;
    IF COALESCE(@SlB, 0) <= 0 SET @SlB = 85.0;
    IF COALESCE(@SlC, 0) <= 0 SET @SlC = 75.0;
    IF COALESCE(@SsfGlobal, 0) <= 0 SET @SsfGlobal = 1.28;
    IF COALESCE(@LtZileGlobal, 0) <= 0 SET @LtZileGlobal = 30;
    IF COALESCE(@FrecventaZileGlobal, 0) <= 0 SET @FrecventaZileGlobal = 14;

    -- ---------------------------------------------------------------
    -- 2. Extragere linii vânzări eligibile
    -- ---------------------------------------------------------------
    SELECT
        COMPANY, FINDOC, MTRTRN, LINENUM, TRNDATE, AZI, TRDR, TRDRCODE,
        MTRL, MTRSUP, CODE, BRANCH, QTY, LTRNVAL
    INTO #SalesLines
    FROM dbo.ufn_MinMaxSalesLines(@Company)
    WHERE @Mtrl IS NULL OR MTRL = @Mtrl;

    SELECT @Azi = MAX(AZI) FROM #SalesLines;
    IF @Azi IS NULL
        THROW 50001, 'sp_MinMaxEngine_Classify: no eligible sales lines were found.', 1;

    -- ---------------------------------------------------------------
    -- 3. Filiale active incluse
    -- ---------------------------------------------------------------
    SELECT b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA
    INTO #ActiveBranches
    FROM CCCMINMAXBRANCH b
    WHERE b.INCLUS = 1
        AND EXISTS (
            SELECT 1
            FROM WHOUSE w
            WHERE w.CCCBRANCH = b.BRANCH
                AND w.ISACTIVE = 1
                AND (w.COMPANY = @Company OR b.ESTE_HQ = 1)
        );

    IF NOT EXISTS (SELECT 1 FROM #ActiveBranches)
        THROW 50002, 'sp_MinMaxEngine_Classify: no included branches with an active warehouse were found.', 1;

    -- ---------------------------------------------------------------
    -- 4. Winsorizare p95 per SKU
    -- ---------------------------------------------------------------
    SELECT sl.*
    INTO #IncludedLines
    FROM #SalesLines sl
    INNER JOIN #ActiveBranches b ON b.BRANCH = sl.BRANCH
    WHERE b.ESTE_HQ = 0 OR @HqDinAgregatCompanie = 0;

    CREATE CLUSTERED INDEX IX_IncludedLines_MtrlBranch
        ON #IncludedLines (MTRL, BRANCH, TRDR, TRNDATE);

    CREATE TABLE #WinsorStats (
        MTRL INT NOT NULL PRIMARY KEY,
        POSITIVE_LINE_COUNT INT NOT NULL,
        P95_QTY DECIMAL(28, 8) NULL,
        MEDIAN_QTY DECIMAL(28, 8) NULL
    );

    SET @WinsorPctSql = CONVERT(VARCHAR(32), CONVERT(DECIMAL(10, 8), @WinsorPct));
    SET @PercentileSql =
        N';WITH PositiveLines AS (' +
        N' SELECT MTRL, QTY FROM #IncludedLines WHERE QTY > 0' +
        N'), Percentiles AS (' +
        N' SELECT MTRL,' +
        N' COUNT(*) OVER (PARTITION BY MTRL) AS POSITIVE_LINE_COUNT,' +
        N' PERCENTILE_CONT(' + @WinsorPctSql + N') WITHIN GROUP (ORDER BY QTY)' +
        N'     OVER (PARTITION BY MTRL) AS P95_QTY,' +
        N' PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY QTY)' +
        N'     OVER (PARTITION BY MTRL) AS MEDIAN_QTY' +
        N' FROM PositiveLines' +
        N')' +
        N' INSERT INTO #WinsorStats (MTRL, POSITIVE_LINE_COUNT, P95_QTY, MEDIAN_QTY)' +
        N' SELECT DISTINCT MTRL, POSITIVE_LINE_COUNT,' +
        N' CONVERT(DECIMAL(28, 8), P95_QTY), CONVERT(DECIMAL(28, 8), MEDIAN_QTY)' +
        N' FROM Percentiles;';
    EXEC sys.sp_executesql @PercentileSql;

    SELECT
        sl.BRANCH, sl.TRDR, sl.MTRL, sl.MTRSUP, sl.CODE, sl.TRNDATE, sl.AZI,
        DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) AS WEEK_INDEX,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN sl.QTY <= 0 THEN sl.QTY
                WHEN ws.POSITIVE_LINE_COUNT >= @WinsorMinLinii AND sl.QTY > ws.P95_QTY THEN ws.P95_QTY
                WHEN ws.POSITIVE_LINE_COUNT < @WinsorMinLinii
                    AND @WinsorSubPrag = 'MEDIANA' AND sl.QTY > ws.MEDIAN_QTY THEN ws.MEDIAN_QTY
                ELSE sl.QTY
            END
        ) AS WINSORIZED_QTY,
        sl.LTRNVAL
    INTO #WinsorizedLines
    FROM #IncludedLines sl
    LEFT JOIN #WinsorStats ws ON ws.MTRL = sl.MTRL;

    -- ---------------------------------------------------------------
    -- 5. Netting per (Branch, TRDR, Mtrl, Week)
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, TRDR, MTRL, MAX(MTRSUP) AS MTRSUP, MAX(CODE) AS CODE, WEEK_INDEX,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN SUM(WINSORIZED_QTY) < 0 THEN 0 ELSE SUM(WINSORIZED_QTY) END
        ) AS NET_QTY,
        CONVERT(DECIMAL(28, 8), SUM(LTRNVAL)) AS NET_VALUE,
        CASE WHEN SUM(WINSORIZED_QTY) > 0
            THEN MAX(CASE WHEN WINSORIZED_QTY > 0 THEN TRNDATE END)
            ELSE NULL
        END AS LAST_POSITIVE_SALE
    INTO #NettedLines
    FROM #WinsorizedLines
    GROUP BY BRANCH, TRDR, MTRL, WEEK_INDEX;

    -- ---------------------------------------------------------------
    -- 6. Agregare săptămânală pe filială + Agregator HQ
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRL, MAX(MTRSUP) AS MTRSUP, MAX(CODE) AS CODE, WEEK_INDEX,
        CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS QTY,
        CONVERT(DECIMAL(28, 8), SUM(NET_VALUE)) AS SALES_VALUE,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #BranchWeekly
    FROM #NettedLines
    GROUP BY BRANCH, MTRL, WEEK_INDEX;

    IF @HqDinAgregatCompanie = 1
    BEGIN
        INSERT INTO #BranchWeekly (
            BRANCH, MTRL, MTRSUP, CODE, WEEK_INDEX, QTY, SALES_VALUE, LAST_POSITIVE_SALE
        )
        SELECT
            hq.BRANCH, bw.MTRL, MAX(bw.MTRSUP), MAX(bw.CODE), bw.WEEK_INDEX,
            CONVERT(DECIMAL(28, 8), SUM(bw.QTY)),
            CONVERT(DECIMAL(28, 8), SUM(bw.SALES_VALUE)),
            MAX(bw.LAST_POSITIVE_SALE)
        FROM #BranchWeekly bw
        INNER JOIN #ActiveBranches sourceBranch
            ON sourceBranch.BRANCH = bw.BRANCH AND sourceBranch.ESTE_HQ = 0
        CROSS JOIN #ActiveBranches hq
        WHERE hq.ESTE_HQ = 1
        GROUP BY hq.BRANCH, bw.MTRL, bw.WEEK_INDEX;
    END;

    -- ---------------------------------------------------------------
    -- 7. MIN_DOC per articol
    -- ---------------------------------------------------------------
    SELECT
        MTRL, MAX(MTRSUP) AS MTRSUP, MAX(CODE) AS CODE,
        CONVERT(DECIMAL(28, 8), COALESCE(MIN(CASE WHEN WINSORIZED_QTY > 0 THEN WINSORIZED_QTY END), 1)) AS MIN_DOC
    INTO #Items
    FROM #WinsorizedLines
    GROUP BY MTRL;

    -- ---------------------------------------------------------------
    -- 8. Seria săptămânală completă de 52 săptămâni cu zerouri
    -- ---------------------------------------------------------------
    CREATE TABLE #Weeks (WEEK_INDEX INT NOT NULL PRIMARY KEY);
    DECLARE @WeekIndex INT = 0;
    WHILE @WeekIndex < @NrSaptamani
    BEGIN
        INSERT INTO #Weeks (WEEK_INDEX) VALUES (@WeekIndex);
        SET @WeekIndex = @WeekIndex + 1;
    END;

    SELECT
        b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA,
        i.MTRL, i.MTRSUP, i.CODE, i.MIN_DOC, w.WEEK_INDEX,
        CONVERT(DECIMAL(28, 8), COALESCE(bw.QTY, 0)) AS QTY,
        CONVERT(DECIMAL(28, 8), COALESCE(bw.SALES_VALUE, 0)) AS SALES_VALUE,
        bw.LAST_POSITIVE_SALE
    INTO #WeeklySeries
    FROM #Items i
    CROSS JOIN #ActiveBranches b
    CROSS JOIN #Weeks w
    LEFT JOIN #BranchWeekly bw
        ON bw.BRANCH = b.BRANCH AND bw.MTRL = i.MTRL AND bw.WEEK_INDEX = w.WEEK_INDEX;

    CREATE CLUSTERED INDEX IX_WeeklySeries_BranchMtrlWeek
        ON #WeeklySeries (BRANCH, MTRL, WEEK_INDEX);

    -- ---------------------------------------------------------------
    -- 9. Agregate de bază (ferestre VZ, frecvență, recență, SIGMA_WK)
    -- ---------------------------------------------------------------
    SELECT
        @Company AS COMPANY, @Azi AS AZI,
        BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRL, MAX(MTRSUP) AS MTRSUP, MAX(CODE) AS CODE,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 4 THEN QTY ELSE 0 END)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 13 THEN QTY ELSE 0 END)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 26 THEN QTY ELSE 0 END)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), SUM(QTY)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(SALES_VALUE)) AS VAL_52S,
        SUM(CASE WHEN QTY > 0 THEN 1 ELSE 0 END) AS SAPT_VZ,
        SUM(CASE WHEN WEEK_INDEX < 8 AND QTY > 0 THEN 1 ELSE 0 END) AS SAPT_8S,
        COALESCE(MIN(CASE WHEN QTY > 0 THEN WEEK_INDEX END), @NrSaptamani) AS SAPT_FARA,
        MAX(CASE WHEN QTY > 0 THEN LAST_POSITIVE_SALE END) AS ULT_VANZ,
        MAX(MIN_DOC) AS MIN_DOC,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN COALESCE(STDEV(CONVERT(FLOAT, QTY)), 0) = 0 THEN @SigmaMin
                ELSE STDEV(CONVERT(FLOAT, QTY))
            END
        ) AS SIGMA_WK
    INTO #BaseAggregates
    FROM #WeeklySeries
    GROUP BY BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRL;

    CREATE CLUSTERED INDEX IX_BaseAggregates_BranchMtrl
        ON #BaseAggregates (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 10. Construire 12 bucket-uri lunare din cele 52 săptămâni (4-4-5)
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRL,
        CASE
            WHEN WEEK_INDEX < 4 THEN 0
            WHEN WEEK_INDEX < 8 THEN 1
            WHEN WEEK_INDEX < 13 THEN 2
            WHEN WEEK_INDEX < 17 THEN 3
            WHEN WEEK_INDEX < 21 THEN 4
            WHEN WEEK_INDEX < 26 THEN 5
            WHEN WEEK_INDEX < 30 THEN 6
            WHEN WEEK_INDEX < 34 THEN 7
            WHEN WEEK_INDEX < 39 THEN 8
            WHEN WEEK_INDEX < 43 THEN 9
            WHEN WEEK_INDEX < 47 THEN 10
            ELSE 11
        END AS MONTH_INDEX,
        SUM(QTY) AS MONTH_QTY
    INTO #MonthlyBuckets
    FROM #WeeklySeries
    GROUP BY
        BRANCH, MTRL,
        CASE
            WHEN WEEK_INDEX < 4 THEN 0
            WHEN WEEK_INDEX < 8 THEN 1
            WHEN WEEK_INDEX < 13 THEN 2
            WHEN WEEK_INDEX < 17 THEN 3
            WHEN WEEK_INDEX < 21 THEN 4
            WHEN WEEK_INDEX < 26 THEN 5
            WHEN WEEK_INDEX < 30 THEN 6
            WHEN WEEK_INDEX < 34 THEN 7
            WHEN WEEK_INDEX < 39 THEN 8
            WHEN WEEK_INDEX < 43 THEN 9
            WHEN WEEK_INDEX < 47 THEN 10
            ELSE 11
        END;

    CREATE CLUSTERED INDEX IX_MonthlyBuckets_BranchMtrlMonth
        ON #MonthlyBuckets (BRANCH, MTRL, MONTH_INDEX);

    -- Statistici lunare (Mean, StdDev, Max luna, Luni cu vanzari, CV)
    SELECT
        BRANCH, MTRL,
        CONVERT(DECIMAL(28, 8), AVG(CONVERT(FLOAT, MONTH_QTY))) AS MEAN_MTH,
        CONVERT(DECIMAL(28, 8), COALESCE(STDEV(CONVERT(FLOAT, MONTH_QTY)), 0)) AS SIGMA_MTH,
        CONVERT(DECIMAL(28, 8), MAX(MONTH_QTY)) AS MAX_LUNA_QTY,
        SUM(CASE WHEN MONTH_QTY > 0 THEN 1 ELSE 0 END) AS LUNI_VZ
    INTO #MonthlyStats
    FROM #MonthlyBuckets
    GROUP BY BRANCH, MTRL;

    CREATE CLUSTERED INDEX IX_MonthlyStats_BranchMtrl
        ON #MonthlyStats (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 11. Informații suplimentare articol (Grupă, Cod, Denumire)
    -- ---------------------------------------------------------------
    SELECT
        m.MTRL,
        COALESCE(m.MTRGROUP, 0) AS MTRGROUP,
        COALESCE(g.CODE, 'NEDEFINIT') AS MTRGROUP_CODE,
        COALESCE(g.NAME, 'NEDEFINIT') AS MTRGROUP_NAME,
        m.NAME AS MTRL_NAME
    INTO #ItemDetails
    FROM MTRL m
    LEFT JOIN MTRGROUP g ON g.MTRGROUP = m.MTRGROUP AND g.COMPANY = m.COMPANY
    WHERE m.MTRL IN (SELECT DISTINCT MTRL FROM #Items);

    CREATE CLUSTERED INDEX IX_ItemDetails_Mtrl
        ON #ItemDetails (MTRL);

    -- ---------------------------------------------------------------
    -- 12. Clasificare completă (LIFECYCLE, ABC per grupă, XYZ, CLASA, COV_TGT, SL, AVG, ad)
    -- ---------------------------------------------------------------
    ;WITH Step1_Lifecycle AS (
        SELECT
            ba.COMPANY, ba.AZI, ba.BRANCH, ba.MARIME, ba.ESTE_HQ, ba.ESTE_PODEA,
            ba.MTRL, ba.MTRSUP, ba.CODE,
            id.MTRL_NAME, id.MTRGROUP, id.MTRGROUP_CODE, id.MTRGROUP_NAME,
            ba.VZ_4S, ba.VZ_13S, ba.VZ_26S, ba.VZ_52S, ba.VAL_52S,
            ba.SAPT_VZ, ba.SAPT_8S, ba.SAPT_FARA, ba.ULT_VANZ, ba.MIN_DOC, ba.SIGMA_WK,
            ms.MEAN_MTH, ms.SIGMA_MTH, ms.MAX_LUNA_QTY, ms.LUNI_VZ,
            CONVERT(DECIMAL(28, 8),
                CASE WHEN ms.MEAN_MTH > 0 THEN ms.SIGMA_MTH / ms.MEAN_MTH ELSE NULL END
            ) AS CV,
            CASE
                WHEN ba.SAPT_VZ >= 3
                    AND ba.SAPT_FARA <= (CASE WHEN ba.ESTE_HQ = 1 THEN @PragRecHq ELSE @PragRecBr END)
                    AND ba.VZ_52S > 0
                THEN 'STANDARD'
                WHEN ba.SAPT_8S >= 2 AND ba.VZ_26S > 0
                THEN 'NOU'
                ELSE 'OD'
            END AS LIFECYCLE
        FROM #BaseAggregates ba
        INNER JOIN #MonthlyStats ms ON ms.BRANCH = ba.BRANCH AND ms.MTRL = ba.MTRL
        LEFT JOIN #ItemDetails id ON id.MTRL = ba.MTRL
    ),
    Step2_AbcPareto AS (
        SELECT
            sl.*,
            -- Cumulativ pe VAL_52S per (BRANCH, MTRGROUP) cu ordonare secundară deterministă pe CODE
            SUM(sl.VAL_52S) OVER (
                PARTITION BY sl.BRANCH, sl.MTRGROUP
            ) AS GRP_TOTAL_VAL,
            COUNT(*) OVER (
                PARTITION BY sl.BRANCH, sl.MTRGROUP
            ) AS GRP_ITEM_COUNT,
            SUM(sl.VAL_52S) OVER (
                PARTITION BY sl.BRANCH, sl.MTRGROUP
                ORDER BY sl.VAL_52S DESC, sl.CODE ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS RUNNING_GRP_VAL
        FROM Step1_Lifecycle sl
    ),
    Step3_AbcClassified AS (
        SELECT
            ap.*,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.GRP_TOTAL_VAL > 0 THEN (ap.RUNNING_GRP_VAL - ap.VAL_52S) / ap.GRP_TOTAL_VAL
                    ELSE 0.0
                END
            ) AS PREV_CUMULATIVE_PCT,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.GRP_TOTAL_VAL > 0 THEN ap.RUNNING_GRP_VAL / ap.GRP_TOTAL_VAL
                    ELSE 1.0
                END
            ) AS CUMULATIVE_PCT,
            CASE
                WHEN ap.GRP_TOTAL_VAL <= 0 OR ap.VAL_52S <= 0 THEN 'C'
                WHEN (ap.RUNNING_GRP_VAL - ap.VAL_52S) / ap.GRP_TOTAL_VAL < 0.80 THEN 'A'
                WHEN (ap.RUNNING_GRP_VAL - ap.VAL_52S) / ap.GRP_TOTAL_VAL < 0.95 THEN 'B'
                ELSE 'C'
            END AS ABC,
            CASE
                WHEN ap.LIFECYCLE IN ('NOU', 'OD')
                    OR ap.MAX_LUNA_QTY > 0.60 * ap.VZ_52S
                    OR ap.LUNI_VZ < 2
                    OR ap.VZ_52S <= 0
                THEN 1
                ELSE 0
            END AS IS_FORCED_Z
        FROM Step2_AbcPareto ap
    ),
    Step4_XyzAndClass AS (
        SELECT
            ac.*,
            CASE
                WHEN ac.IS_FORCED_Z = 1 THEN 'Z'
                WHEN ac.CV <= 0.50 THEN 'X'
                WHEN ac.CV <= 1.00 THEN 'Y'
                ELSE 'Z'
            END AS XYZ,
            CASE
                WHEN ac.LIFECYCLE = 'NOU' THEN 'NOU'
                WHEN ac.LIFECYCLE = 'OD' THEN 'OD'
                ELSE ac.ABC + CASE
                    WHEN ac.IS_FORCED_Z = 1 THEN 'Z'
                    WHEN ac.CV <= 0.50 THEN 'X'
                    WHEN ac.CV <= 1.00 THEN 'Y'
                    ELSE 'Z'
                END
            END AS CLASA,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ac.LIFECYCLE = 'STANDARD'
                    THEN ac.VZ_4S * 0.30 + (ac.VZ_13S / 3.0) * 0.40 + (ac.VZ_26S / 6.0) * 0.15 + (ac.VZ_52S / 12.0) * 0.15
                    WHEN ac.LIFECYCLE = 'NOU'
                    THEN ac.VZ_13S / 3.0
                    ELSE 0
                END
            ) AS AVG_DEMAND,
            CASE
                WHEN ac.GRP_ITEM_COUNT < 5 THEN 1
                ELSE 0
            END AS WARN_GRUPA_MICA
        FROM Step3_AbcClassified ac
    )
    SELECT
        xc.COMPANY, xc.AZI, xc.BRANCH, xc.MARIME, xc.ESTE_HQ, xc.ESTE_PODEA,
        xc.MTRL, xc.MTRSUP, xc.CODE, xc.MTRL_NAME,
        xc.MTRGROUP, xc.MTRGROUP_CODE, xc.MTRGROUP_NAME,
        xc.VZ_4S, xc.VZ_13S, xc.VZ_26S, xc.VZ_52S, xc.VAL_52S,
        xc.SAPT_VZ, xc.SAPT_8S, xc.SAPT_FARA, xc.ULT_VANZ, xc.MIN_DOC, xc.SIGMA_WK,
        xc.LUNI_VZ, xc.MAX_LUNA_QTY, xc.MEAN_MTH, xc.SIGMA_MTH, xc.CV, xc.IS_FORCED_Z,
        xc.LIFECYCLE, xc.ABC, xc.XYZ, xc.CLASA,
        CONVERT(DECIMAL(10, 4), COALESCE(cov.COV, 0.0)) AS COV_TGT,
        CONVERT(DECIMAL(10, 4),
            CASE
                WHEN xc.LIFECYCLE = 'NOU' THEN @SlB
                WHEN xc.ABC = 'A' THEN @SlA
                WHEN xc.ABC = 'B' THEN @SlB
                ELSE @SlC
            END
        ) AS SL,
        @SsfGlobal AS SSF,
        @LtZileGlobal AS LT_ZILE,
        @FrecventaZileGlobal AS FRECVENTA_ZILE,
        xc.AVG_DEMAND AS [AVG],
        CONVERT(DECIMAL(28, 8), xc.AVG_DEMAND / 30.0) AS ad,
        xc.PREV_CUMULATIVE_PCT, xc.CUMULATIVE_PCT, xc.GRP_TOTAL_VAL, xc.GRP_ITEM_COUNT,
        xc.WARN_GRUPA_MICA
    INTO #MinMaxClassified
    FROM Step4_XyzAndClass xc
    LEFT JOIN CCCMINMAXCOV cov
        ON cov.CLASA = xc.CLASA AND cov.MARIME = xc.MARIME;

    -- ---------------------------------------------------------------
    -- 13. Output rezultate sau sumare de validare
    -- ---------------------------------------------------------------
    IF @SummaryOnly = 1
    BEGIN
        -- Raport integritate generală
        SELECT
            COUNT(*) AS TOTAL_ROWS,
            COUNT(DISTINCT MTRL) AS DISTINCT_ITEMS,
            COUNT(DISTINCT BRANCH) AS DISTINCT_BRANCHES,
            SUM(CASE WHEN LIFECYCLE = 'STANDARD' THEN 1 ELSE 0 END) AS STANDARD_ROWS,
            SUM(CASE WHEN LIFECYCLE = 'NOU' THEN 1 ELSE 0 END) AS NOU_ROWS,
            SUM(CASE WHEN LIFECYCLE = 'OD' THEN 1 ELSE 0 END) AS OD_ROWS,
            SUM(CASE WHEN CLASA = 'AX' THEN 1 ELSE 0 END) AS COUNT_AX,
            SUM(CASE WHEN CLASA = 'AY' THEN 1 ELSE 0 END) AS COUNT_AY,
            SUM(CASE WHEN CLASA = 'AZ' THEN 1 ELSE 0 END) AS COUNT_AZ,
            SUM(CASE WHEN CLASA = 'BX' THEN 1 ELSE 0 END) AS COUNT_BX,
            SUM(CASE WHEN CLASA = 'BY' THEN 1 ELSE 0 END) AS COUNT_BY,
            SUM(CASE WHEN CLASA = 'BZ' THEN 1 ELSE 0 END) AS COUNT_BZ,
            SUM(CASE WHEN CLASA = 'CX' THEN 1 ELSE 0 END) AS COUNT_CX,
            SUM(CASE WHEN CLASA = 'CY' THEN 1 ELSE 0 END) AS COUNT_CY,
            SUM(CASE WHEN CLASA = 'CZ' THEN 1 ELSE 0 END) AS COUNT_CZ,
            SUM(CASE WHEN CLASA = 'NOU' THEN 1 ELSE 0 END) AS COUNT_NOU,
            SUM(CASE WHEN CLASA = 'OD' THEN 1 ELSE 0 END) AS COUNT_OD,
            SUM(CASE WHEN LIFECYCLE IS NULL THEN 1 ELSE 0 END) AS NULL_LIFECYCLE_ROWS,
            SUM(CASE WHEN ABC IS NULL THEN 1 ELSE 0 END) AS NULL_ABC_ROWS,
            SUM(CASE WHEN XYZ IS NULL THEN 1 ELSE 0 END) AS NULL_XYZ_ROWS,
            SUM(CASE WHEN CLASA IS NULL THEN 1 ELSE 0 END) AS NULL_CLASA_ROWS,
            SUM(CASE WHEN COV_TGT IS NULL THEN 1 ELSE 0 END) AS NULL_COV_TGT_ROWS,
            SUM(CASE WHEN LIFECYCLE = 'STANDARD' AND COV_TGT = 0 AND CLASA <> 'CZ' THEN 1 ELSE 0 END) AS UNMATCHED_COV_ROWS,
            SUM(CASE WHEN IS_FORCED_Z = 1 AND XYZ <> 'Z' THEN 1 ELSE 0 END) AS FORCED_Z_MISMATCH_ROWS,
            SUM(CASE WHEN [AVG] < 0 THEN 1 ELSE 0 END) AS NEGATIVE_AVG_ROWS,
            SUM(CASE WHEN WARN_GRUPA_MICA = 1 THEN 1 ELSE 0 END) AS SMALL_GROUP_WARNING_ROWS
        FROM #MinMaxClassified;

        -- Distribuție pe filiale
        SELECT
            BRANCH,
            MAX(CONVERT(INT, ESTE_HQ)) AS ESTE_HQ,
            MAX(MARIME) AS MARIME,
            COUNT(*) AS TOTAL_ITEMS,
            SUM(CASE WHEN LIFECYCLE = 'STANDARD' THEN 1 ELSE 0 END) AS STANDARD_ITEMS,
            SUM(CASE WHEN LIFECYCLE = 'NOU' THEN 1 ELSE 0 END) AS NOU_ITEMS,
            SUM(CASE WHEN LIFECYCLE = 'OD' THEN 1 ELSE 0 END) AS OD_ITEMS,
            SUM(CASE WHEN ABC = 'A' THEN 1 ELSE 0 END) AS A_ITEMS,
            SUM(CASE WHEN ABC = 'B' THEN 1 ELSE 0 END) AS B_ITEMS,
            SUM(CASE WHEN ABC = 'C' THEN 1 ELSE 0 END) AS C_ITEMS,
            SUM(CASE WHEN XYZ = 'X' THEN 1 ELSE 0 END) AS X_ITEMS,
            SUM(CASE WHEN XYZ = 'Y' THEN 1 ELSE 0 END) AS Y_ITEMS,
            SUM(CASE WHEN XYZ = 'Z' THEN 1 ELSE 0 END) AS Z_ITEMS,
            CONVERT(DECIMAL(28, 2), SUM([AVG])) AS TOTAL_AVG_DEMAND
        FROM #MinMaxClassified
        GROUP BY BRANCH
        ORDER BY BRANCH;

        RETURN;
    END;

    -- Returnare dataset clasificat complet
    SELECT
        COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
        MTRL, MTRSUP, CODE, MTRL_NAME,
        MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME,
        VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
        SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, MIN_DOC, SIGMA_WK,
        LUNI_VZ, MAX_LUNA_QTY, MEAN_MTH, SIGMA_MTH, CV, IS_FORCED_Z,
        LIFECYCLE, ABC, XYZ, CLASA, COV_TGT, SL, SSF, LT_ZILE, FRECVENTA_ZILE,
        [AVG], ad, PREV_CUMULATIVE_PCT, CUMULATIVE_PCT, GRP_TOTAL_VAL, GRP_ITEM_COUNT,
        WARN_GRUPA_MICA
    FROM #MinMaxClassified;
END;
