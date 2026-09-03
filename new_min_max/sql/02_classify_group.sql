-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — Faza 2b: dbo.sp_MinMaxEngine_ClassifyGroup
-- Clasificare ABC-XYZ agregată pe MTRGROUP x BRANCH (consumator: Branch Replenishment)
-- Același algoritm ca sp_MinMaxEngine_Classify, cu două diferențe de granularitate:
--   * seria săptămânală se însumează pe grupă, nu pe SKU
--   * cumulativul ABC se partiționează pe BRANCH (grupele concurează între ele în filială)
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_ClassifyGroup
    @Company SMALLINT,
    @Mtrgroup INT = NULL,
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

    IF COALESCE(@NrSaptamani, 0) <= 0 SET @NrSaptamani = 52;
    IF @WinsorPct IS NULL OR @WinsorPct <= 0 OR @WinsorPct > 1 SET @WinsorPct = 0.95;
    IF COALESCE(@WinsorMinLinii, 0) <= 0 SET @WinsorMinLinii = 8;
    IF @WinsorSubPrag NOT IN ('NONE', 'MEDIANA') OR @WinsorSubPrag IS NULL SET @WinsorSubPrag = 'MEDIANA';
    IF COALESCE(@SigmaMin, 0) <= 0 SET @SigmaMin = 1.3;
    SET @HqDinAgregatCompanie = COALESCE(@HqDinAgregatCompanie, 1);
    IF COALESCE(@PragRecHq, 0) <= 0 SET @PragRecHq = 39;
    IF COALESCE(@PragRecBr, 0) <= 0 SET @PragRecBr = 26;

    -- ---------------------------------------------------------------
    -- 2. Extragere linii vânzări eligibile
    -- ---------------------------------------------------------------
    SELECT
        COMPANY, FINDOC, MTRTRN, LINENUM, TRNDATE, AZI, TRDR, TRDRCODE,
        MTRL, MTRSUP, CODE, BRANCH, QTY, LTRNVAL
    INTO #SalesLines
    FROM dbo.ufn_MinMaxSalesLines(@Company);

    SELECT @Azi = MAX(AZI) FROM #SalesLines;
    IF @Azi IS NULL
        THROW 50001, 'sp_MinMaxEngine_ClassifyGroup: no eligible sales lines were found.', 1;

    -- ---------------------------------------------------------------
    -- 3. Maparea articol -> grupă (E18: grupa lipsă devine NEDEFINIT)
    -- ---------------------------------------------------------------
    SELECT
        m.MTRL,
        COALESCE(m.MTRGROUP, 0) AS MTRGROUP,
        COALESCE(g.CODE, 'NEDEFINIT') AS MTRGROUP_CODE,
        COALESCE(g.NAME, 'NEDEFINIT') AS MTRGROUP_NAME
    INTO #ItemGroups
    FROM MTRL m
    LEFT JOIN MTRGROUP g ON g.MTRGROUP = m.MTRGROUP AND g.COMPANY = m.COMPANY
    WHERE m.MTRL IN (SELECT DISTINCT MTRL FROM #SalesLines);

    CREATE CLUSTERED INDEX IX_ItemGroups_Mtrl ON #ItemGroups (MTRL);

    SELECT
        MTRGROUP,
        MAX(MTRGROUP_CODE) AS MTRGROUP_CODE,
        MAX(MTRGROUP_NAME) AS MTRGROUP_NAME,
        COUNT(*) AS NR_SKU_GRP
    INTO #Groups
    FROM #ItemGroups
    WHERE @Mtrgroup IS NULL OR MTRGROUP = @Mtrgroup
    GROUP BY MTRGROUP;

    IF NOT EXISTS (SELECT 1 FROM #Groups)
        THROW 50003, 'sp_MinMaxEngine_ClassifyGroup: no product groups matched the requested filter.', 1;

    -- ---------------------------------------------------------------
    -- 4. Filiale active incluse
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
        THROW 50002, 'sp_MinMaxEngine_ClassifyGroup: no included branches with an active warehouse were found.', 1;

    -- ---------------------------------------------------------------
    -- 5. Winsorizare p95 per SKU (identică cu Faza 2 — plafonarea e definită pe linie de SKU)
    -- ---------------------------------------------------------------
    SELECT sl.*, ig.MTRGROUP
    INTO #IncludedLines
    FROM #SalesLines sl
    INNER JOIN #ActiveBranches b ON b.BRANCH = sl.BRANCH
    INNER JOIN #ItemGroups ig ON ig.MTRL = sl.MTRL
    INNER JOIN #Groups gr ON gr.MTRGROUP = ig.MTRGROUP
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
        sl.BRANCH, sl.TRDR, sl.MTRL, sl.MTRGROUP, sl.TRNDATE,
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
    -- 6. Netting per (Branch, TRDR, Mtrl, Week) — tot la nivel de SKU
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, TRDR, MTRL, MAX(MTRGROUP) AS MTRGROUP, WEEK_INDEX,
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
    -- 7. Rulare pe SKU x filială x săptămână + agregator HQ
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRL, MAX(MTRGROUP) AS MTRGROUP, WEEK_INDEX,
        CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS QTY,
        CONVERT(DECIMAL(28, 8), SUM(NET_VALUE)) AS SALES_VALUE,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #BranchWeekly
    FROM #NettedLines
    GROUP BY BRANCH, MTRL, WEEK_INDEX;

    IF @HqDinAgregatCompanie = 1
    BEGIN
        INSERT INTO #BranchWeekly (BRANCH, MTRL, MTRGROUP, WEEK_INDEX, QTY, SALES_VALUE, LAST_POSITIVE_SALE)
        SELECT
            hq.BRANCH, bw.MTRL, MAX(bw.MTRGROUP), bw.WEEK_INDEX,
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
    -- 8. Rulare pe grupă x filială x săptămână
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRGROUP, WEEK_INDEX,
        CONVERT(DECIMAL(28, 8), SUM(QTY)) AS QTY,
        CONVERT(DECIMAL(28, 8), SUM(SALES_VALUE)) AS SALES_VALUE,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #GroupWeekly
    FROM #BranchWeekly
    GROUP BY BRANCH, MTRGROUP, WEEK_INDEX;

    CREATE CLUSTERED INDEX IX_GroupWeekly_BranchGroupWeek
        ON #GroupWeekly (BRANCH, MTRGROUP, WEEK_INDEX);

    SELECT
        BRANCH, MTRGROUP,
        COUNT(DISTINCT MTRL) AS NR_SKU_VZ
    INTO #GroupSkuCounts
    FROM #BranchWeekly
    WHERE QTY > 0
    GROUP BY BRANCH, MTRGROUP;

    -- ---------------------------------------------------------------
    -- 9. Seria săptămânală completă cu zerouri (I12)
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
        g.MTRGROUP, g.MTRGROUP_CODE, g.MTRGROUP_NAME, g.NR_SKU_GRP, w.WEEK_INDEX,
        CONVERT(DECIMAL(28, 8), COALESCE(gw.QTY, 0)) AS QTY,
        CONVERT(DECIMAL(28, 8), COALESCE(gw.SALES_VALUE, 0)) AS SALES_VALUE,
        gw.LAST_POSITIVE_SALE
    INTO #WeeklySeries
    FROM #Groups g
    CROSS JOIN #ActiveBranches b
    CROSS JOIN #Weeks w
    LEFT JOIN #GroupWeekly gw
        ON gw.BRANCH = b.BRANCH AND gw.MTRGROUP = g.MTRGROUP AND gw.WEEK_INDEX = w.WEEK_INDEX;

    CREATE CLUSTERED INDEX IX_WeeklySeries_BranchGroupWeek
        ON #WeeklySeries (BRANCH, MTRGROUP, WEEK_INDEX);

    -- ---------------------------------------------------------------
    -- 10. Agregate de bază (ferestre VZ, frecvență, recență, SIGMA_WK)
    -- ---------------------------------------------------------------
    SELECT
        @Company AS COMPANY, @Azi AS AZI,
        BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
        MTRGROUP, MAX(MTRGROUP_CODE) AS MTRGROUP_CODE, MAX(MTRGROUP_NAME) AS MTRGROUP_NAME,
        MAX(NR_SKU_GRP) AS NR_SKU_GRP,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 4 THEN QTY ELSE 0 END)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 13 THEN QTY ELSE 0 END)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 26 THEN QTY ELSE 0 END)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), SUM(QTY)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(SALES_VALUE)) AS VAL_52S,
        SUM(CASE WHEN QTY > 0 THEN 1 ELSE 0 END) AS SAPT_VZ,
        SUM(CASE WHEN WEEK_INDEX < 8 AND QTY > 0 THEN 1 ELSE 0 END) AS SAPT_8S,
        COALESCE(MIN(CASE WHEN QTY > 0 THEN WEEK_INDEX END), @NrSaptamani) AS SAPT_FARA,
        MAX(CASE WHEN QTY > 0 THEN LAST_POSITIVE_SALE END) AS ULT_VANZ,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN COALESCE(STDEV(CONVERT(FLOAT, QTY)), 0) = 0 THEN @SigmaMin
                ELSE STDEV(CONVERT(FLOAT, QTY))
            END
        ) AS SIGMA_WK
    INTO #BaseAggregates
    FROM #WeeklySeries
    GROUP BY BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRGROUP;

    CREATE CLUSTERED INDEX IX_BaseAggregates_BranchGroup
        ON #BaseAggregates (BRANCH, MTRGROUP);

    -- ---------------------------------------------------------------
    -- 11. Bucket-uri lunare 4-4-5 din cele 52 săptămâni + statistici XYZ
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRGROUP,
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
        BRANCH, MTRGROUP,
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

    SELECT
        BRANCH, MTRGROUP,
        CONVERT(DECIMAL(28, 8), AVG(CONVERT(FLOAT, MONTH_QTY))) AS MEAN_MTH,
        CONVERT(DECIMAL(28, 8), COALESCE(STDEV(CONVERT(FLOAT, MONTH_QTY)), 0)) AS SIGMA_MTH,
        CONVERT(DECIMAL(28, 8), MAX(MONTH_QTY)) AS MAX_LUNA_QTY,
        SUM(CASE WHEN MONTH_QTY > 0 THEN 1 ELSE 0 END) AS LUNI_VZ
    INTO #MonthlyStats
    FROM #MonthlyBuckets
    GROUP BY BRANCH, MTRGROUP;

    CREATE CLUSTERED INDEX IX_MonthlyStats_BranchGroup
        ON #MonthlyStats (BRANCH, MTRGROUP);

    -- ---------------------------------------------------------------
    -- 12. Clasificare (LIFECYCLE, ABC per filială, XYZ, CLASA)
    -- ---------------------------------------------------------------
    ;WITH Step1_Lifecycle AS (
        SELECT
            ba.COMPANY, ba.AZI, ba.BRANCH, ba.MARIME, ba.ESTE_HQ, ba.ESTE_PODEA,
            ba.MTRGROUP, ba.MTRGROUP_CODE, ba.MTRGROUP_NAME,
            ba.NR_SKU_GRP, COALESCE(gc.NR_SKU_VZ, 0) AS NR_SKU_VZ,
            ba.VZ_4S, ba.VZ_13S, ba.VZ_26S, ba.VZ_52S, ba.VAL_52S,
            ba.SAPT_VZ, ba.SAPT_8S, ba.SAPT_FARA, ba.ULT_VANZ, ba.SIGMA_WK,
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
        INNER JOIN #MonthlyStats ms ON ms.BRANCH = ba.BRANCH AND ms.MTRGROUP = ba.MTRGROUP
        LEFT JOIN #GroupSkuCounts gc ON gc.BRANCH = ba.BRANCH AND gc.MTRGROUP = ba.MTRGROUP
    ),
    Step2_AbcPareto AS (
        SELECT
            sl.*,
            -- Cumulativ pe VAL_52S per BRANCH: grupele concurează între ele în filială
            SUM(sl.VAL_52S) OVER (
                PARTITION BY sl.BRANCH
            ) AS BR_TOTAL_VAL,
            COUNT(*) OVER (
                PARTITION BY sl.BRANCH
            ) AS BR_GROUP_COUNT,
            SUM(sl.VAL_52S) OVER (
                PARTITION BY sl.BRANCH
                ORDER BY sl.VAL_52S DESC, sl.MTRGROUP_CODE ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS RUNNING_BR_VAL
        FROM Step1_Lifecycle sl
    ),
    Step3_AbcClassified AS (
        SELECT
            ap.*,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.BR_TOTAL_VAL > 0 THEN (ap.RUNNING_BR_VAL - ap.VAL_52S) / ap.BR_TOTAL_VAL
                    ELSE 0.0
                END
            ) AS PREV_CUMULATIVE_PCT,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.BR_TOTAL_VAL > 0 THEN ap.RUNNING_BR_VAL / ap.BR_TOTAL_VAL
                    ELSE 1.0
                END
            ) AS CUMULATIVE_PCT,
            CASE
                WHEN ap.BR_TOTAL_VAL <= 0 OR ap.VAL_52S <= 0 THEN 'C'
                WHEN (ap.RUNNING_BR_VAL - ap.VAL_52S) / ap.BR_TOTAL_VAL < 0.80 THEN 'A'
                WHEN (ap.RUNNING_BR_VAL - ap.VAL_52S) / ap.BR_TOTAL_VAL < 0.95 THEN 'B'
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
            END AS CLASA
        FROM Step3_AbcClassified ac
    )
    SELECT
        COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
        MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME, NR_SKU_GRP, NR_SKU_VZ,
        VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
        SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, SIGMA_WK,
        LUNI_VZ, MAX_LUNA_QTY, MEAN_MTH, SIGMA_MTH, CV, IS_FORCED_Z,
        LIFECYCLE, ABC, XYZ, CLASA,
        PREV_CUMULATIVE_PCT, CUMULATIVE_PCT, BR_TOTAL_VAL, BR_GROUP_COUNT
    INTO #MinMaxGroupClassified
    FROM Step4_XyzAndClass;

    -- ---------------------------------------------------------------
    -- 13. Output rezultate sau sumar de validare
    -- ---------------------------------------------------------------
    IF @SummaryOnly = 1
    BEGIN
        SELECT
            COUNT(*) AS TOTAL_ROWS,
            COUNT(DISTINCT MTRGROUP) AS DISTINCT_GROUPS,
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
            SUM(CASE WHEN IS_FORCED_Z = 1 AND XYZ <> 'Z' THEN 1 ELSE 0 END) AS FORCED_Z_MISMATCH_ROWS,
            SUM(CASE WHEN VZ_52S < 0 THEN 1 ELSE 0 END) AS NEGATIVE_VZ_ROWS,
            SUM(CASE WHEN SIGMA_WK IS NULL THEN 1 ELSE 0 END) AS NULL_SIGMA_ROWS
        FROM #MinMaxGroupClassified;

        SELECT
            BRANCH,
            MAX(CONVERT(INT, ESTE_HQ)) AS ESTE_HQ,
            MAX(MARIME) AS MARIME,
            COUNT(*) AS TOTAL_GROUPS,
            SUM(CASE WHEN ABC = 'A' THEN 1 ELSE 0 END) AS A_GROUPS,
            SUM(CASE WHEN ABC = 'B' THEN 1 ELSE 0 END) AS B_GROUPS,
            SUM(CASE WHEN ABC = 'C' THEN 1 ELSE 0 END) AS C_GROUPS,
            SUM(CASE WHEN XYZ = 'X' THEN 1 ELSE 0 END) AS X_GROUPS,
            SUM(CASE WHEN XYZ = 'Y' THEN 1 ELSE 0 END) AS Y_GROUPS,
            SUM(CASE WHEN XYZ = 'Z' THEN 1 ELSE 0 END) AS Z_GROUPS,
            CONVERT(DECIMAL(28, 2), SUM(VAL_52S)) AS TOTAL_VAL_52S
        FROM #MinMaxGroupClassified
        GROUP BY BRANCH
        ORDER BY BRANCH;

        RETURN;
    END;

    SELECT
        COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
        MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME, NR_SKU_GRP, NR_SKU_VZ,
        VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
        SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, SIGMA_WK,
        LUNI_VZ, MAX_LUNA_QTY, MEAN_MTH, SIGMA_MTH, CV, IS_FORCED_Z,
        LIFECYCLE, ABC, XYZ, CLASA,
        PREV_CUMULATIVE_PCT, CUMULATIVE_PCT, BR_TOTAL_VAL, BR_GROUP_COUNT
    FROM #MinMaxGroupClassified
    ORDER BY BRANCH, VAL_52S DESC, MTRGROUP_CODE;
END;
