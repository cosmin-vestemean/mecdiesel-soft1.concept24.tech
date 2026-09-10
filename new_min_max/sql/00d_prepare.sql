-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — Faza 1b: dbo.sp_MinMaxEngine_Prepare
-- Agregate de baza pe (BRANCH, MTRL): ferestre VZ, frecventa, recenta, SIGMA_WK.
-- Acelasi pipeline ca sp_MinMaxEngine_Classify, oprit inainte de clasificare.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_Prepare
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
    DECLARE @ModAtribuire VARCHAR(10);
    DECLARE @SigmaMin DECIMAL(28, 8);
    DECLARE @HqDinAgregatCompanie BIT;
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

    SELECT @ModAtribuire = UPPER(LTRIM(RTRIM(PARAMVALUE)))
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'MOD_ATRIBUIRE_FILIALA' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @SigmaMin = TRY_CONVERT(DECIMAL(28, 8), PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SIGMA_MIN' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @HqDinAgregatCompanie = TRY_CONVERT(BIT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'HQ_DIN_AGREGAT_COMPANIE' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF COALESCE(@NrSaptamani, 0) <= 0 SET @NrSaptamani = 52;
    IF @WinsorPct IS NULL OR @WinsorPct <= 0 OR @WinsorPct > 1 SET @WinsorPct = 0.95;
    IF COALESCE(@WinsorMinLinii, 0) <= 0 SET @WinsorMinLinii = 8;
    IF @WinsorSubPrag NOT IN ('NONE', 'MEDIANA') OR @WinsorSubPrag IS NULL SET @WinsorSubPrag = 'MEDIANA';
    IF @ModAtribuire NOT IN ('DOC', 'AGENT', 'CLIENT') OR @ModAtribuire IS NULL SET @ModAtribuire = 'CLIENT';
    IF COALESCE(@SigmaMin, 0) <= 0 SET @SigmaMin = 1.3;
    SET @HqDinAgregatCompanie = COALESCE(@HqDinAgregatCompanie, 1);

    -- ---------------------------------------------------------------
    -- 2. Extragere linii vanzari eligibile
    -- ---------------------------------------------------------------
    SELECT
        COMPANY, FINDOC, MTRTRN, LINENUM, TRNDATE, AZI, TRDR, TRDRCODE,
        MTRL, MTRSUP, CODE, BRANCH, QTY, LTRNVAL
    INTO #SalesLines
    FROM dbo.ufn_MinMaxSalesLines(@Company, @ModAtribuire)
    WHERE @Mtrl IS NULL OR MTRL = @Mtrl;

    SELECT @Azi = MAX(AZI) FROM #SalesLines;
    IF @Azi IS NULL
        THROW 50001, 'sp_MinMaxEngine_Prepare: no eligible sales lines were found.', 1;

    -- ---------------------------------------------------------------
    -- 3. Filiale active incluse
    -- HQ este un rand virtual (stratul de companie), deci nu se testeaza contra WHOUSE.
    -- ---------------------------------------------------------------
    SELECT b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA
    INTO #ActiveBranches
    FROM CCCMINMAXBRANCH b
    WHERE b.INCLUS = 1
        AND (
            b.ESTE_HQ = 1
            OR EXISTS (
                SELECT 1
                FROM WHOUSE w
                WHERE w.CCCBRANCH = b.BRANCH
                    AND w.COMPANY = @Company
                    AND w.ISACTIVE = 1
            )
        );

    IF NOT EXISTS (SELECT 1 FROM #ActiveBranches)
        THROW 50002, 'sp_MinMaxEngine_Prepare: no included branches with an active warehouse were found.', 1;

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
    -- 6. Agregare saptamanala pe filiala + Agregator HQ
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

    CREATE CLUSTERED INDEX IX_BranchWeekly_BranchMtrlWeek
        ON #BranchWeekly (BRANCH, MTRL, WEEK_INDEX);

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
    -- 8. Agregate saptamanale rare; saptamanile absente sunt zerouri implicite
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRL,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 4 THEN QTY ELSE 0 END)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 13 THEN QTY ELSE 0 END)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN WEEK_INDEX < 26 THEN QTY ELSE 0 END)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), SUM(QTY)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(SALES_VALUE)) AS VAL_52S,
        SUM(CASE WHEN QTY > 0 THEN 1 ELSE 0 END) AS SAPT_VZ,
        SUM(CASE WHEN WEEK_INDEX < 8 AND QTY > 0 THEN 1 ELSE 0 END) AS SAPT_8S,
        MIN(CASE WHEN QTY > 0 THEN WEEK_INDEX END) AS SAPT_FARA,
        MAX(CASE WHEN QTY > 0 THEN LAST_POSITIVE_SALE END) AS ULT_VANZ,
        MIN(QTY) AS MIN_WEEK_QTY,
        MAX(QTY) AS MAX_WEEK_QTY,
        SUM(CONVERT(FLOAT, QTY) * CONVERT(FLOAT, QTY)) AS SIGMA_WK_SUMSQ
    INTO #WeeklyStats
    FROM #BranchWeekly
    WHERE WEEK_INDEX >= 0 AND WEEK_INDEX < @NrSaptamani
    GROUP BY BRANCH, MTRL;

    CREATE CLUSTERED INDEX IX_WeeklyStats_BranchMtrl
        ON #WeeklyStats (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 9. Un singur rand per articol x filiala, cu SIGMA_WK din momente
    -- ---------------------------------------------------------------
    SELECT
        @Company AS COMPANY, @Azi AS AZI,
        b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA,
        i.MTRL, i.MTRSUP, i.CODE,
        CONVERT(DECIMAL(28, 8), COALESCE(ws.VZ_4S, 0)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), COALESCE(ws.VZ_13S, 0)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), COALESCE(ws.VZ_26S, 0)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), COALESCE(ws.VZ_52S, 0)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), COALESCE(ws.VAL_52S, 0)) AS VAL_52S,
        COALESCE(ws.SAPT_VZ, 0) AS SAPT_VZ,
        COALESCE(ws.SAPT_8S, 0) AS SAPT_8S,
        COALESCE(ws.SAPT_FARA, @NrSaptamani) AS SAPT_FARA,
        ws.ULT_VANZ,
        i.MIN_DOC,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN COALESCE(ws.SAPT_VZ, 0) = 0
                    OR (ws.SAPT_VZ = @NrSaptamani AND ws.MIN_WEEK_QTY = ws.MAX_WEEK_QTY)
                    OR variance.SAMPLE_VARIANCE <= 0 THEN @SigmaMin
                ELSE SQRT(variance.SAMPLE_VARIANCE)
            END
        ) AS SIGMA_WK
    INTO #MinMaxBase
    FROM #Items i
    CROSS JOIN #ActiveBranches b
    LEFT JOIN #WeeklyStats ws
        ON ws.BRANCH = b.BRANCH AND ws.MTRL = i.MTRL
    CROSS APPLY (
        SELECT CASE
            WHEN @NrSaptamani > 1 THEN
                (COALESCE(CONVERT(FLOAT, ws.SIGMA_WK_SUMSQ), 0.0)
                    - POWER(COALESCE(CONVERT(FLOAT, ws.VZ_52S), 0.0), 2)
                        / CONVERT(FLOAT, @NrSaptamani))
                    / CONVERT(FLOAT, @NrSaptamani - 1)
            ELSE 0.0
        END AS SAMPLE_VARIANCE
    ) variance;

    -- ---------------------------------------------------------------
    -- 10. Output rezultate sau sumare de validare
    -- ---------------------------------------------------------------
    IF @SummaryOnly = 1
    BEGIN
        SELECT
            COUNT(*) AS RESULT_ROWS,
            COUNT(DISTINCT MTRL) AS DISTINCT_ITEMS,
            COUNT(DISTINCT BRANCH) AS DISTINCT_BRANCHES,
            SUM(CASE WHEN ESTE_HQ = 1 THEN 1 ELSE 0 END) AS HQ_ROWS,
            SUM(CASE WHEN ESTE_PODEA = 1 THEN 1 ELSE 0 END) AS FLOOR_ROWS,
            SUM(CASE WHEN VZ_52S > 0 THEN 1 ELSE 0 END) AS ROWS_WITH_SALES,
            SUM(CASE WHEN VZ_52S = 0 THEN 1 ELSE 0 END) AS ZERO_SALES_ROWS,
            SUM(CASE WHEN SIGMA_WK IS NULL THEN 1 ELSE 0 END) AS NULL_SIGMA_ROWS,
            SUM(CASE WHEN MIN_DOC IS NULL THEN 1 ELSE 0 END) AS NULL_MIN_DOC_ROWS,
            SUM(CASE WHEN VZ_4S > VZ_13S OR VZ_13S > VZ_26S OR VZ_26S > VZ_52S THEN 1 ELSE 0 END) AS INVALID_WINDOW_ROWS,
            SUM(CASE WHEN SAPT_VZ NOT BETWEEN 0 AND @NrSaptamani
                OR SAPT_8S NOT BETWEEN 0 AND 8
                OR SAPT_FARA NOT BETWEEN 0 AND @NrSaptamani THEN 1 ELSE 0 END) AS INVALID_WEEK_ROWS,
            SUM(CASE WHEN (SAPT_VZ = 0 AND ULT_VANZ IS NOT NULL)
                OR (SAPT_VZ > 0 AND ULT_VANZ IS NULL) THEN 1 ELSE 0 END) AS INVALID_LAST_SALE_ROWS,
            MIN(AZI) AS MIN_AZI,
            MAX(AZI) AS MAX_AZI,
            MIN(SIGMA_WK) AS MIN_SIGMA,
            MAX(SIGMA_WK) AS MAX_SIGMA
        FROM #MinMaxBase;

        SELECT
            BRANCH, MAX(CONVERT(INT, ESTE_HQ)) AS ESTE_HQ,
            COUNT(*) AS ITEM_COUNT,
            SUM(VZ_52S) AS TOTAL_VZ_52S,
            SUM(VAL_52S) AS TOTAL_VAL_52S,
            SUM(CASE WHEN VZ_52S > 0 THEN 1 ELSE 0 END) AS ITEMS_WITH_SALES
        FROM #MinMaxBase
        GROUP BY BRANCH
        ORDER BY BRANCH;

        RETURN;
    END;

    SELECT
        COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRL, MTRSUP, CODE,
        VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
        SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, MIN_DOC, SIGMA_WK
    FROM #MinMaxBase;
END;
