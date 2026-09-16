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
    @SummaryOnly BIT = 0,
    @Persist BIT = 0,
    @RunId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- ---------------------------------------------------------------
    -- 0. Validare sesiune, inaintea oricarui calcul
    --    Fara asta, un @RunId lipsa s-ar afla abia dupa intreg pipeline-ul.
    -- ---------------------------------------------------------------
    IF @Persist = 1
    BEGIN
        IF @RunId IS NULL
            THROW 50005, 'sp_MinMaxEngine_ClassifyGroup: @RunId is required when @Persist = 1; open a session with sp_MinMaxEngine_StartRun.', 1;

        IF NOT EXISTS (SELECT 1 FROM CCCMINMAXRUN WHERE RUNID = @RunId AND COMPANY = @Company)
            THROW 50006, 'sp_MinMaxEngine_ClassifyGroup: the requested RUNID does not exist for this company.', 1;

        IF NOT EXISTS (SELECT 1 FROM CCCMINMAXRUN WHERE RUNID = @RunId AND SESSION_STATUS = 'OPEN')
            THROW 50015, 'sp_MinMaxEngine_ClassifyGroup: the session is not OPEN; a finished session is immutable.', 1;

        IF NOT EXISTS (
            SELECT 1 FROM CCCMINMAXRUNPARAM
            WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = ''
        )
            THROW 50075, 'sp_MinMaxEngine_ClassifyGroup: the run parameter snapshot is missing.', 1;
    END;

    -- ---------------------------------------------------------------
    -- 1. Rezolvarea parametrilor: snapshot inghetat CCCMINMAXRUNPARAM cand
    --    @Persist = 1 (populat o singura data in StartRun), altfel valorile
    --    live din CCCMINMAXPARAMS (previzualizare fara sesiune).
    -- ---------------------------------------------------------------
    DECLARE @NrSaptamani INT;
    DECLARE @NrZile INT;
    DECLARE @FerestreVz VARCHAR(10);
    DECLARE @FerestreCapat VARCHAR(10);
    DECLARE @GrilaSapt VARCHAR(10);
    DECLARE @BazaSaptVz VARCHAR(10);
    DECLARE @FerestreZileRaw VARCHAR(255);
    DECLARE @Zile1 INT;
    DECLARE @Zile2 INT;
    DECLARE @Zile3 INT;
    DECLARE @Zile4 INT;
    DECLARE @WinsorPct FLOAT;
    DECLARE @WinsorMinLinii INT;
    DECLARE @WinsorSubPrag VARCHAR(10);
    DECLARE @ModAtribuire VARCHAR(10);
    DECLARE @SigmaMinRaw VARCHAR(255);
    DECLARE @SigmaMin DECIMAL(28, 8);
    DECLARE @HqDinAgregatCompanie BIT;
    DECLARE @PragRecHq INT;
    DECLARE @PragRecBr INT;
    -- P7: praguri lifecycle/ABC/XYZ/forced-Z (C11); fara ponderi AVG (ClassifyGroup nu calculeaza AVG_DEMAND)
    DECLARE @StandardMinSapt INT;
    DECLARE @NouMinSapt8 INT;
    DECLARE @NouNecesitaVz26 BIT;
    DECLARE @AbcA DECIMAL(10, 4);
    DECLARE @AbcB DECIMAL(10, 4);
    DECLARE @XyzX DECIMAL(10, 4);
    DECLARE @XyzY DECIMAL(10, 4);
    DECLARE @ForceZLunaDominanta DECIMAL(10, 4);
    DECLARE @ForceZMinLuni INT;
    -- P3: comutatoare ABC
    DECLARE @AbcConventieCumul VARCHAR(10);
    DECLARE @AbcPopulatie VARCHAR(10);
    DECLARE @AbcPrimArticolA BIT;
    DECLARE @Azi DATE;
    DECLARE @PercentileSql NVARCHAR(MAX);
    DECLARE @WinsorPctSql VARCHAR(32);
    DECLARE @StartedAt DATETIME = GETDATE();

    CREATE TABLE #ResolvedParams (
        PARAMKEY VARCHAR(50) NOT NULL PRIMARY KEY,
        PARAMVALUE VARCHAR(255) NULL
    );

    IF @Persist = 1
        INSERT INTO #ResolvedParams (PARAMKEY, PARAMVALUE)
        SELECT PARAMKEY, PARAMVALUE
        FROM CCCMINMAXRUNPARAM
        WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '';
    ELSE
        INSERT INTO #ResolvedParams (PARAMKEY, PARAMVALUE)
        SELECT PARAMKEY, PARAMVALUE
        FROM CCCMINMAXPARAMS
        WHERE SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @NrSaptamani = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'NRSAPT';
    SELECT @NrZile = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'NRZILE';
    SELECT @FerestreVz = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'FERESTRE_VZ';
    SELECT @FerestreCapat = LTRIM(RTRIM(PARAMVALUE)) FROM #ResolvedParams WHERE PARAMKEY = 'FERESTRE_CAPAT';
    SELECT @GrilaSapt = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'GRILA_SAPT';
    SELECT @BazaSaptVz = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'BAZA_SAPT_VZ';
    SELECT @FerestreZileRaw = PARAMVALUE FROM #ResolvedParams WHERE PARAMKEY = 'FERESTRE_VZ_ZILE';
    SELECT @WinsorPct = TRY_CONVERT(FLOAT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'WINSOR_PCT';
    SELECT @WinsorMinLinii = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'WINSOR_MIN_LINII';
    SELECT @WinsorSubPrag = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'WINSOR_SUB_PRAG';
    SELECT @ModAtribuire = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'MOD_ATRIBUIRE_FILIALA';

    -- P8: absent/NULL -> 1.3 (fallback), 0 explicit e valid (safety zero),
    -- negativ/nenumeric e o eroare de configurare, nu un fallback tacit.
    SELECT @SigmaMinRaw = PARAMVALUE FROM #ResolvedParams WHERE PARAMKEY = 'SIGMA_MIN';
    IF @SigmaMinRaw IS NULL
        SET @SigmaMin = 1.3;
    ELSE
    BEGIN
        SET @SigmaMin = TRY_CONVERT(DECIMAL(28, 8), @SigmaMinRaw);
        IF @SigmaMin IS NULL
            THROW 50072, 'sp_MinMaxEngine_ClassifyGroup: SIGMA_MIN must be numeric.', 1;
        IF @SigmaMin < 0
            THROW 50073, 'sp_MinMaxEngine_ClassifyGroup: SIGMA_MIN must not be negative.', 1;
    END;

    SELECT @HqDinAgregatCompanie = TRY_CONVERT(BIT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'HQ_DIN_AGREGAT_COMPANIE';
    SELECT @PragRecHq = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'PRAG_REC_HQ';
    SELECT @PragRecBr = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'PRAG_REC_BR';

    SELECT @StandardMinSapt = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'STANDARD_MIN_SAPT';
    SELECT @NouMinSapt8 = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'NOU_MIN_SAPT_8';
    SELECT @NouNecesitaVz26 = TRY_CONVERT(BIT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'NOU_NECESITA_VZ26';
    SELECT @AbcA = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'ABC_A';
    SELECT @AbcB = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'ABC_B';
    SELECT @XyzX = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'XYZ_X';
    SELECT @XyzY = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'XYZ_Y';
    SELECT @ForceZLunaDominanta = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'FORCE_Z_LUNA_DOMINANTA';
    SELECT @ForceZMinLuni = TRY_CONVERT(INT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'FORCE_Z_MIN_LUNI';

    SELECT @AbcConventieCumul = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'ABC_CONVENTIE_CUMUL';
    SELECT @AbcPopulatie = UPPER(LTRIM(RTRIM(PARAMVALUE))) FROM #ResolvedParams WHERE PARAMKEY = 'ABC_POPULATIE';
    SELECT @AbcPrimArticolA = TRY_CONVERT(BIT, PARAMVALUE) FROM #ResolvedParams WHERE PARAMKEY = 'ABC_PRIM_ARTICOL_A';

    IF COALESCE(@NrSaptamani, 0) <= 0 SET @NrSaptamani = 52;
    IF COALESCE(@NrZile, 0) <= 0 SET @NrZile = 365;
    IF @FerestreVz NOT IN ('ZILE', 'SAPT') OR @FerestreVz IS NULL SET @FerestreVz = 'ZILE';
    IF @FerestreCapat IS NULL SET @FerestreCapat = '[0,N)';
    IF @GrilaSapt IS NULL SET @GrilaSapt = 'ROLLING';
    IF @BazaSaptVz IS NULL SET @BazaSaptVz = 'ISO';
    IF @FerestreZileRaw IS NULL OR LTRIM(RTRIM(@FerestreZileRaw)) = '' SET @FerestreZileRaw = '28,91,182,365';

    IF @FerestreCapat <> '[0,N)'
        THROW 50084, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_CAPAT supports only [0,N); any other value is undeclared in the specification.', 1;

    IF @GrilaSapt NOT IN ('ROLLING', 'CALENDAR')
        THROW 50085, 'sp_MinMaxEngine_ClassifyGroup: GRILA_SAPT must be ROLLING or CALENDAR.', 1;
    IF @BazaSaptVz NOT IN ('ISO', 'GRILA')
        THROW 50086, 'sp_MinMaxEngine_ClassifyGroup: BAZA_SAPT_VZ must be ISO or GRILA.', 1;

    -- ALL-OR-NOTHING inaintea despicarii: fara exact 3 virgule, PARSENAME ar numara de la
    -- dreapta si ar deplasa tacit valorile pe pozitii gresite (ex: '28' -> @Zile4 = 28).
    IF LEN(@FerestreZileRaw) - LEN(REPLACE(@FerestreZileRaw, ',', '')) <> 3
        THROW 50087, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_VZ_ZILE must contain exactly four positive, strictly increasing integers.', 1;

    SET @Zile1 = TRY_CONVERT(INT, PARSENAME(REPLACE(@FerestreZileRaw, ',', '.'), 4));
    SET @Zile2 = TRY_CONVERT(INT, PARSENAME(REPLACE(@FerestreZileRaw, ',', '.'), 3));
    SET @Zile3 = TRY_CONVERT(INT, PARSENAME(REPLACE(@FerestreZileRaw, ',', '.'), 2));
    SET @Zile4 = TRY_CONVERT(INT, PARSENAME(REPLACE(@FerestreZileRaw, ',', '.'), 1));

    IF @Zile1 IS NULL OR @Zile2 IS NULL OR @Zile3 IS NULL OR @Zile4 IS NULL
        OR @Zile1 <= 0 OR @Zile2 <= 0 OR @Zile3 <= 0 OR @Zile4 <= 0
        OR NOT (@Zile1 < @Zile2 AND @Zile2 < @Zile3 AND @Zile3 < @Zile4)
        THROW 50087, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_VZ_ZILE must contain exactly four positive, strictly increasing integers.', 1;

    IF @FerestreVz = 'ZILE' AND (@Zile1 > @NrZile OR @Zile2 > @NrZile OR @Zile3 > @NrZile OR @Zile4 > @NrZile)
        THROW 50088, 'sp_MinMaxEngine_ClassifyGroup: FERESTRE_VZ_ZILE exceeds NRZILE; the window would be computed on a truncated population.', 1;

    IF @WinsorPct IS NULL OR @WinsorPct <= 0 OR @WinsorPct > 1 SET @WinsorPct = 0.95;
    IF COALESCE(@WinsorMinLinii, 0) <= 0 SET @WinsorMinLinii = 8;
    IF @WinsorSubPrag NOT IN ('NONE', 'MEDIANA') OR @WinsorSubPrag IS NULL SET @WinsorSubPrag = 'MEDIANA';
    IF @ModAtribuire NOT IN ('DOC', 'AGENT', 'CLIENT') OR @ModAtribuire IS NULL SET @ModAtribuire = 'CLIENT';
    SET @HqDinAgregatCompanie = COALESCE(@HqDinAgregatCompanie, 1);
    IF COALESCE(@PragRecHq, 0) <= 0 SET @PragRecHq = 39;
    IF COALESCE(@PragRecBr, 0) <= 0 SET @PragRecBr = 26;
    IF COALESCE(@StandardMinSapt, 0) <= 0 SET @StandardMinSapt = 3;
    IF COALESCE(@NouMinSapt8, 0) <= 0 SET @NouMinSapt8 = 2;
    SET @NouNecesitaVz26 = COALESCE(@NouNecesitaVz26, 1);
    IF @AbcA IS NULL OR @AbcA <= 0 OR @AbcA >= 1 SET @AbcA = 0.80;
    IF @AbcB IS NULL OR @AbcB <= @AbcA OR @AbcB >= 1 SET @AbcB = 0.95;
    IF @XyzX IS NULL OR @XyzX <= 0 SET @XyzX = 0.50;
    IF @XyzY IS NULL OR @XyzY <= @XyzX SET @XyzY = 1.00;
    IF @ForceZLunaDominanta IS NULL OR @ForceZLunaDominanta <= 0 SET @ForceZLunaDominanta = 0.60;
    IF COALESCE(@ForceZMinLuni, 0) <= 0 SET @ForceZMinLuni = 2;
    IF @AbcConventieCumul NOT IN ('INCLUSIV', 'PRECEDENT') OR @AbcConventieCumul IS NULL SET @AbcConventieCumul = 'INCLUSIV';
    IF @AbcPopulatie NOT IN ('STANDARD', 'TOATE') OR @AbcPopulatie IS NULL SET @AbcPopulatie = 'STANDARD';
    SET @AbcPrimArticolA = COALESCE(@AbcPrimArticolA, 1);

    -- ---------------------------------------------------------------
    -- 1b. Ancora inghetata: Classify e prima faza si stabileste AZI pentru sesiune.
    -- ---------------------------------------------------------------
    DECLARE @AziInghetat DATE;
    IF @Persist = 1
    BEGIN
        SELECT @AziInghetat = AZI FROM CCCMINMAXRUN WHERE RUNID = @RunId;
        IF @AziInghetat IS NULL
            THROW 50080, 'sp_MinMaxEngine_ClassifyGroup: the run has no frozen AZI; sp_MinMaxEngine_Classify must run first.', 1;
    END;

    -- ---------------------------------------------------------------
    -- 2. Extragere linii vânzări eligibile
    -- ---------------------------------------------------------------
    SELECT
        COMPANY, FINDOC, MTRTRN, LINENUM, TRNDATE, AZI, TRDR, TRDRCODE,
        MTRL, MTRSUP, CODE, BRANCH, QTY, LTRNVAL
    INTO #SalesLines
    FROM dbo.ufn_MinMaxSalesLines(@Company, @ModAtribuire, @NrZile, @AziInghetat);

    SELECT @Azi = MAX(AZI) FROM #SalesLines;
    IF @Azi IS NULL
        THROW 50001, 'sp_MinMaxEngine_ClassifyGroup: no eligible sales lines were found.', 1;

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
        THROW 50002, 'sp_MinMaxEngine_ClassifyGroup: no included branches with an active warehouse were found.', 1;

    -- ---------------------------------------------------------------
    -- 4. Maparea articol -> grupă (E18: grupa lipsă devine NEDEFINIT)
    --    Populatia trebuie sa coincida cu #IncludedLines; altfel NR_SKU_GRP
    --    numara articole vandute exclusiv in filiale scoase din perimetru.
    -- ---------------------------------------------------------------
    SELECT
        m.MTRL,
        COALESCE(m.MTRGROUP, 0) AS MTRGROUP,
        COALESCE(g.CODE, 'NEDEFINIT') AS MTRGROUP_CODE,
        COALESCE(g.NAME, 'NEDEFINIT') AS MTRGROUP_NAME
    INTO #ItemGroups
    FROM MTRL m
    LEFT JOIN MTRGROUP g ON g.MTRGROUP = m.MTRGROUP AND g.COMPANY = m.COMPANY
    WHERE m.MTRL IN (
        SELECT DISTINCT sl.MTRL
        FROM #SalesLines sl
        INNER JOIN #ActiveBranches b ON b.BRANCH = sl.BRANCH
        WHERE b.ESTE_HQ = 0 OR @HqDinAgregatCompanie = 0
    );

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
        sl.BRANCH, sl.TRDR, sl.MTRL, sl.MTRGROUP, sl.TRNDATE, sl.AZI,
        CASE WHEN @GrilaSapt = 'ROLLING' THEN lag.DAY_LAG / 7
             ELSE DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) END AS WEEK_BUCKET,
        CASE WHEN @BazaSaptVz = 'ISO' THEN iso.ISO_WEEK_INDEX
             WHEN @GrilaSapt = 'ROLLING' THEN lag.DAY_LAG / 7
             ELSE DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) END AS ISO_WEEK,
        lag.DAY_LAG AS DAY_LAG,
        CASE
            WHEN (@FerestreVz = 'ZILE' AND lag.DAY_LAG >= 0 AND lag.DAY_LAG < @Zile1)
                OR (@FerestreVz = 'SAPT' AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) >= 0 AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) < 4)
            THEN 1 ELSE 0
        END AS IN_W1,
        CASE
            WHEN (@FerestreVz = 'ZILE' AND lag.DAY_LAG >= 0 AND lag.DAY_LAG < @Zile2)
                OR (@FerestreVz = 'SAPT' AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) >= 0 AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) < 13)
            THEN 1 ELSE 0
        END AS IN_W2,
        CASE
            WHEN (@FerestreVz = 'ZILE' AND lag.DAY_LAG >= 0 AND lag.DAY_LAG < @Zile3)
                OR (@FerestreVz = 'SAPT' AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) >= 0 AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) < 26)
            THEN 1 ELSE 0
        END AS IN_W3,
        CASE
            WHEN (@FerestreVz = 'ZILE' AND lag.DAY_LAG >= 0 AND lag.DAY_LAG < @Zile4)
                OR (@FerestreVz = 'SAPT' AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) >= 0 AND DATEDIFF(WEEK, sl.TRNDATE, sl.AZI) < @NrSaptamani)
            THEN 1 ELSE 0
        END AS IN_W4,
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
    LEFT JOIN #WinsorStats ws ON ws.MTRL = sl.MTRL
    CROSS APPLY (
        SELECT DATEDIFF(DAY, sl.TRNDATE, sl.AZI) AS DAY_LAG
    ) lag
    CROSS APPLY (
        -- Ancorare pe luni fara SET DATEFIRST: 1900-01-01 a fost luni, deci modulo 7 da 0 lunea.
        SELECT DATEDIFF(DAY,
            DATEADD(DAY, -(DATEDIFF(DAY, '19000101', sl.TRNDATE) % 7), sl.TRNDATE),
            DATEADD(DAY, -(DATEDIFF(DAY, '19000101', sl.AZI) % 7), sl.AZI)) / 7 AS ISO_WEEK_INDEX
    ) iso;

    -- ---------------------------------------------------------------
    -- 6. Netting per (Branch, TRDR, Mtrl, bucket rolling) — tot la nivel de SKU
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, TRDR, MTRL, MAX(MTRGROUP) AS MTRGROUP, WEEK_BUCKET,
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
    GROUP BY BRANCH, TRDR, MTRL, WEEK_BUCKET;

    -- ---------------------------------------------------------------
    -- 7. Rulare pe SKU x filială x bucket rolling + agregator HQ
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRL, MAX(MTRGROUP) AS MTRGROUP, WEEK_BUCKET,
        CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS QTY,
        CONVERT(DECIMAL(28, 8), SUM(NET_VALUE)) AS SALES_VALUE,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #BranchWeekly
    FROM #NettedLines
    GROUP BY BRANCH, MTRL, WEEK_BUCKET;

    IF @HqDinAgregatCompanie = 1
    BEGIN
        INSERT INTO #BranchWeekly (BRANCH, MTRL, MTRGROUP, WEEK_BUCKET, QTY, SALES_VALUE, LAST_POSITIVE_SALE)
        SELECT
            hq.BRANCH, bw.MTRL, MAX(bw.MTRGROUP), bw.WEEK_BUCKET,
            CONVERT(DECIMAL(28, 8), SUM(bw.QTY)),
            CONVERT(DECIMAL(28, 8), SUM(bw.SALES_VALUE)),
            MAX(bw.LAST_POSITIVE_SALE)
        FROM #BranchWeekly bw
        INNER JOIN #ActiveBranches sourceBranch
            ON sourceBranch.BRANCH = bw.BRANCH AND sourceBranch.ESTE_HQ = 0
        CROSS JOIN #ActiveBranches hq
        WHERE hq.ESTE_HQ = 1
        GROUP BY hq.BRANCH, bw.MTRL, bw.WEEK_BUCKET;
    END;

    -- ---------------------------------------------------------------
    -- 8. Rulare pe grupă x filială x bucket rolling
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRGROUP, WEEK_BUCKET,
        CONVERT(DECIMAL(28, 8), SUM(QTY)) AS QTY,
        CONVERT(DECIMAL(28, 8), SUM(SALES_VALUE)) AS SALES_VALUE,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #GroupWeekly
    FROM #BranchWeekly
    GROUP BY BRANCH, MTRGROUP, WEEK_BUCKET;

    CREATE CLUSTERED INDEX IX_GroupWeekly_BranchGroupWeek
        ON #GroupWeekly (BRANCH, MTRGROUP, WEEK_BUCKET);

    -- ---------------------------------------------------------------
    -- 8b. Seria pe saptamani ISO (luni-duminica), doar pentru SAPT_VZ/SAPT_8S/ULT_VANZ (S 4.6).
    --     Grila separata de WEEK_BUCKET: cele doua nu trebuie amestecate (vezi #BaseAggregates).
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, TRDR, MTRL, MAX(MTRGROUP) AS MTRGROUP, ISO_WEEK,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN SUM(WINSORIZED_QTY) < 0 THEN 0 ELSE SUM(WINSORIZED_QTY) END
        ) AS NET_QTY,
        CASE WHEN SUM(WINSORIZED_QTY) > 0
            THEN MAX(CASE WHEN WINSORIZED_QTY > 0 THEN TRNDATE END)
            ELSE NULL
        END AS LAST_POSITIVE_SALE
    INTO #NettedIsoLines
    FROM #WinsorizedLines
    GROUP BY BRANCH, TRDR, MTRL, ISO_WEEK;

    SELECT
        BRANCH, MTRL, MAX(MTRGROUP) AS MTRGROUP, ISO_WEEK,
        CONVERT(DECIMAL(28, 8), SUM(NET_QTY)) AS QTY,
        MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
    INTO #BranchIsoWeekly
    FROM #NettedIsoLines
    GROUP BY BRANCH, MTRL, ISO_WEEK;

    IF @HqDinAgregatCompanie = 1
    BEGIN
        INSERT INTO #BranchIsoWeekly (BRANCH, MTRL, MTRGROUP, ISO_WEEK, QTY, LAST_POSITIVE_SALE)
        SELECT
            hq.BRANCH, bw.MTRL, MAX(bw.MTRGROUP), bw.ISO_WEEK,
            CONVERT(DECIMAL(28, 8), SUM(bw.QTY)),
            MAX(bw.LAST_POSITIVE_SALE)
        FROM #BranchIsoWeekly bw
        INNER JOIN #ActiveBranches sourceBranch
            ON sourceBranch.BRANCH = bw.BRANCH AND sourceBranch.ESTE_HQ = 0
        CROSS JOIN #ActiveBranches hq
        WHERE hq.ESTE_HQ = 1
        GROUP BY hq.BRANCH, bw.MTRL, bw.ISO_WEEK;
    END;

    -- Filtrul < @NrSaptamani pastreaza saptamana ISO curenta (index 0, partiala) si elimina
    -- saptamana ISO cea mai veche (partiala si ea), conform conventiei [0,N) din FERESTRE_CAPAT.
    SELECT
        BRANCH, MTRGROUP,
        SUM(CASE WHEN QTY > 0 THEN 1 ELSE 0 END) AS SAPT_VZ,
        SUM(CASE WHEN ISO_WEEK < 8 AND QTY > 0 THEN 1 ELSE 0 END) AS SAPT_8S,
        MAX(CASE WHEN QTY > 0 THEN LAST_POSITIVE_SALE END) AS ULT_VANZ
    INTO #GroupIsoWeeklyStats
    FROM (
        SELECT BRANCH, MTRGROUP, ISO_WEEK,
            CONVERT(DECIMAL(28, 8), SUM(QTY)) AS QTY,
            MAX(LAST_POSITIVE_SALE) AS LAST_POSITIVE_SALE
        FROM #BranchIsoWeekly
        WHERE ISO_WEEK >= 0 AND ISO_WEEK < @NrSaptamani
        GROUP BY BRANCH, MTRGROUP, ISO_WEEK
    ) gi
    GROUP BY BRANCH, MTRGROUP;

    CREATE CLUSTERED INDEX IX_GroupIsoWeeklyStats_BranchGroup
        ON #GroupIsoWeeklyStats (BRANCH, MTRGROUP);

    -- ---------------------------------------------------------------
    -- 8c. Ferestre VZ pe zile calendaristice (N04a), simetrice cu Classify:
    --     netting independent per fereastra, la nivel de client, apoi SKU, apoi grupa.
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, TRDR, MTRL, MAX(MTRGROUP) AS MTRGROUP,
        CONVERT(DECIMAL(28, 8), CASE
            WHEN SUM(CASE WHEN IN_W1 = 1 THEN WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
            ELSE SUM(CASE WHEN IN_W1 = 1 THEN WINSORIZED_QTY ELSE 0 END)
        END) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), CASE
            WHEN SUM(CASE WHEN IN_W2 = 1 THEN WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
            ELSE SUM(CASE WHEN IN_W2 = 1 THEN WINSORIZED_QTY ELSE 0 END)
        END) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), CASE
            WHEN SUM(CASE WHEN IN_W3 = 1 THEN WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
            ELSE SUM(CASE WHEN IN_W3 = 1 THEN WINSORIZED_QTY ELSE 0 END)
        END) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), CASE
            WHEN SUM(CASE WHEN IN_W4 = 1 THEN WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
            ELSE SUM(CASE WHEN IN_W4 = 1 THEN WINSORIZED_QTY ELSE 0 END)
        END) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(CASE WHEN IN_W4 = 1 THEN LTRNVAL ELSE 0 END)) AS VAL_52S
    INTO #ClientWindowTotals
    FROM #WinsorizedLines
    GROUP BY BRANCH, TRDR, MTRL;

    IF @HqDinAgregatCompanie = 1
    BEGIN
        INSERT INTO #ClientWindowTotals (
            BRANCH, TRDR, MTRL, MTRGROUP, VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S
        )
        SELECT
            hq.BRANCH, cw.TRDR, cw.MTRL, MAX(cw.MTRGROUP),
            CONVERT(DECIMAL(28, 8), CASE
                WHEN SUM(CASE WHEN cw.IN_W1 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
                ELSE SUM(CASE WHEN cw.IN_W1 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END)
            END),
            CONVERT(DECIMAL(28, 8), CASE
                WHEN SUM(CASE WHEN cw.IN_W2 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
                ELSE SUM(CASE WHEN cw.IN_W2 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END)
            END),
            CONVERT(DECIMAL(28, 8), CASE
                WHEN SUM(CASE WHEN cw.IN_W3 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
                ELSE SUM(CASE WHEN cw.IN_W3 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END)
            END),
            CONVERT(DECIMAL(28, 8), CASE
                WHEN SUM(CASE WHEN cw.IN_W4 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END) < 0 THEN 0
                ELSE SUM(CASE WHEN cw.IN_W4 = 1 THEN cw.WINSORIZED_QTY ELSE 0 END)
            END),
            CONVERT(DECIMAL(28, 8), SUM(CASE WHEN cw.IN_W4 = 1 THEN cw.LTRNVAL ELSE 0 END))
        FROM #WinsorizedLines cw
        INNER JOIN #ActiveBranches sourceBranch
            ON sourceBranch.BRANCH = cw.BRANCH AND sourceBranch.ESTE_HQ = 0
        CROSS JOIN #ActiveBranches hq
        WHERE hq.ESTE_HQ = 1
        GROUP BY hq.BRANCH, cw.TRDR, cw.MTRL;
    END;

    SELECT
        BRANCH, MTRL, MAX(MTRGROUP) AS MTRGROUP,
        CONVERT(DECIMAL(28, 8), SUM(VZ_4S)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_13S)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_26S)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_52S)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(VAL_52S)) AS VAL_52S
    INTO #BranchWindowTotals
    FROM #ClientWindowTotals
    GROUP BY BRANCH, MTRL;

    SELECT
        BRANCH, MTRGROUP,
        CONVERT(DECIMAL(28, 8), SUM(VZ_4S)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_13S)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_26S)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), SUM(VZ_52S)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), SUM(VAL_52S)) AS VAL_52S
    INTO #GroupWindowTotals
    FROM #BranchWindowTotals
    GROUP BY BRANCH, MTRGROUP;

    CREATE CLUSTERED INDEX IX_GroupWindowTotals_BranchGroup
        ON #GroupWindowTotals (BRANCH, MTRGROUP);

    -- NR_SKU_VZ se numara pe aceeasi fereastra ca VZ_52S, nu pe seria saptamanala:
    -- altfel contorul ar include bucket-ul de capat pe care ferestrele il exclud.
    SELECT
        BRANCH, MTRGROUP,
        COUNT(DISTINCT MTRL) AS NR_SKU_VZ
    INTO #GroupSkuCounts
    FROM #BranchWindowTotals
    WHERE VZ_52S > 0
    GROUP BY BRANCH, MTRGROUP;

    -- ---------------------------------------------------------------
    -- 9. Seria săptămânală completă cu zerouri (I12), pe grila rolling
    -- ---------------------------------------------------------------
    CREATE TABLE #Weeks (WEEK_BUCKET INT NOT NULL PRIMARY KEY);
    DECLARE @WeekIndex INT = 0;
    WHILE @WeekIndex < @NrSaptamani
    BEGIN
        INSERT INTO #Weeks (WEEK_BUCKET) VALUES (@WeekIndex);
        SET @WeekIndex = @WeekIndex + 1;
    END;

    SELECT
        b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA,
        g.MTRGROUP, g.MTRGROUP_CODE, g.MTRGROUP_NAME, g.NR_SKU_GRP, w.WEEK_BUCKET,
        CONVERT(DECIMAL(28, 8), COALESCE(gw.QTY, 0)) AS QTY,
        CONVERT(DECIMAL(28, 8), COALESCE(gw.SALES_VALUE, 0)) AS SALES_VALUE,
        gw.LAST_POSITIVE_SALE
    INTO #WeeklySeries
    FROM #Groups g
    CROSS JOIN #ActiveBranches b
    CROSS JOIN #Weeks w
    LEFT JOIN #GroupWeekly gw
        ON gw.BRANCH = b.BRANCH AND gw.MTRGROUP = g.MTRGROUP AND gw.WEEK_BUCKET = w.WEEK_BUCKET;

    CREATE CLUSTERED INDEX IX_WeeklySeries_BranchGroupWeek
        ON #WeeklySeries (BRANCH, MTRGROUP, WEEK_BUCKET);

    -- ---------------------------------------------------------------
    -- 10. Agregate de bază: SIGMA_WK pe grila rolling, ferestrele VZ pe zile,
    --     frecvența și recența pe grila ISO. Grilele nu se amestecă.
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRGROUP,
        MAX(MTRGROUP_CODE) AS MTRGROUP_CODE,
        MAX(MTRGROUP_NAME) AS MTRGROUP_NAME,
        MAX(NR_SKU_GRP) AS NR_SKU_GRP,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN COALESCE(STDEV(CONVERT(FLOAT, QTY)), 0) = 0 THEN @SigmaMin
                ELSE STDEV(CONVERT(FLOAT, QTY))
            END
        ) AS SIGMA_WK
    INTO #GroupRollingStats
    FROM #WeeklySeries
    GROUP BY BRANCH, MARIME, ESTE_HQ, ESTE_PODEA, MTRGROUP;

    SELECT
        @Company AS COMPANY, @Azi AS AZI,
        rs.BRANCH, rs.MARIME, rs.ESTE_HQ, rs.ESTE_PODEA,
        rs.MTRGROUP, rs.MTRGROUP_CODE, rs.MTRGROUP_NAME, rs.NR_SKU_GRP,
        CONVERT(DECIMAL(28, 8), COALESCE(wt.VZ_4S, 0)) AS VZ_4S,
        CONVERT(DECIMAL(28, 8), COALESCE(wt.VZ_13S, 0)) AS VZ_13S,
        CONVERT(DECIMAL(28, 8), COALESCE(wt.VZ_26S, 0)) AS VZ_26S,
        CONVERT(DECIMAL(28, 8), COALESCE(wt.VZ_52S, 0)) AS VZ_52S,
        CONVERT(DECIMAL(28, 8), COALESCE(wt.VAL_52S, 0)) AS VAL_52S,
        COALESCE(iso.SAPT_VZ, 0) AS SAPT_VZ,
        COALESCE(iso.SAPT_8S, 0) AS SAPT_8S,
        -- S 4.6: aceeasi recenta in zile ca in Classify, pastrata simetrica intre SKU si grupa.
        COALESCE(
            CONVERT(INT, ROUND(DATEDIFF(DAY, iso.ULT_VANZ, @Azi) / 7.0, 0)),
            @NrSaptamani
        ) AS SAPT_FARA,
        iso.ULT_VANZ,
        rs.SIGMA_WK
    INTO #BaseAggregates
    FROM #GroupRollingStats rs
    LEFT JOIN #GroupWindowTotals wt
        ON wt.BRANCH = rs.BRANCH AND wt.MTRGROUP = rs.MTRGROUP
    LEFT JOIN #GroupIsoWeeklyStats iso
        ON iso.BRANCH = rs.BRANCH AND iso.MTRGROUP = rs.MTRGROUP;

    CREATE CLUSTERED INDEX IX_BaseAggregates_BranchGroup
        ON #BaseAggregates (BRANCH, MTRGROUP);

    -- ---------------------------------------------------------------
    -- 11. Bucket-uri lunare 4-4-5 din cele 52 săptămâni + statistici XYZ
    -- ---------------------------------------------------------------
    SELECT
        BRANCH, MTRGROUP,
        CASE
            WHEN WEEK_BUCKET < 4 THEN 0
            WHEN WEEK_BUCKET < 8 THEN 1
            WHEN WEEK_BUCKET < 13 THEN 2
            WHEN WEEK_BUCKET < 17 THEN 3
            WHEN WEEK_BUCKET < 21 THEN 4
            WHEN WEEK_BUCKET < 26 THEN 5
            WHEN WEEK_BUCKET < 30 THEN 6
            WHEN WEEK_BUCKET < 34 THEN 7
            WHEN WEEK_BUCKET < 39 THEN 8
            WHEN WEEK_BUCKET < 43 THEN 9
            WHEN WEEK_BUCKET < 47 THEN 10
            ELSE 11
        END AS MONTH_INDEX,
        SUM(QTY) AS MONTH_QTY
    INTO #MonthlyBuckets
    FROM #WeeklySeries
    GROUP BY
        BRANCH, MTRGROUP,
        CASE
            WHEN WEEK_BUCKET < 4 THEN 0
            WHEN WEEK_BUCKET < 8 THEN 1
            WHEN WEEK_BUCKET < 13 THEN 2
            WHEN WEEK_BUCKET < 17 THEN 3
            WHEN WEEK_BUCKET < 21 THEN 4
            WHEN WEEK_BUCKET < 26 THEN 5
            WHEN WEEK_BUCKET < 30 THEN 6
            WHEN WEEK_BUCKET < 34 THEN 7
            WHEN WEEK_BUCKET < 39 THEN 8
            WHEN WEEK_BUCKET < 43 THEN 9
            WHEN WEEK_BUCKET < 47 THEN 10
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
                WHEN ba.SAPT_VZ >= @StandardMinSapt
                    AND ba.SAPT_FARA <= (CASE WHEN ba.ESTE_HQ = 1 THEN @PragRecHq ELSE @PragRecBr END)
                    AND ba.VZ_52S > 0
                THEN 'STANDARD'
                WHEN ba.SAPT_8S >= @NouMinSapt8 AND (@NouNecesitaVz26 = 0 OR ba.VZ_26S > 0)
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
            -- P3: contributie conditionata (STANDARD sau TOATE); NOU/OD raman
            -- in secventa (ordonare), dar nu consuma valoare cand @AbcPopulatie=STANDARD
            CONVERT(DECIMAL(28, 8),
                CASE WHEN @AbcPopulatie = 'TOATE' OR sl.LIFECYCLE = 'STANDARD' THEN sl.VAL_52S ELSE 0 END
            ) AS VAL_CONTRIB,
            -- Cumulativ per BRANCH: grupele concurează între ele în filială
            SUM(CASE WHEN @AbcPopulatie = 'TOATE' OR sl.LIFECYCLE = 'STANDARD' THEN sl.VAL_52S ELSE 0 END) OVER (
                PARTITION BY sl.BRANCH
            ) AS BR_TOTAL_VAL,
            COUNT(*) OVER (
                PARTITION BY sl.BRANCH
            ) AS BR_GROUP_COUNT,
            SUM(CASE WHEN @AbcPopulatie = 'TOATE' OR sl.LIFECYCLE = 'STANDARD' THEN sl.VAL_52S ELSE 0 END) OVER (
                PARTITION BY sl.BRANCH
                ORDER BY sl.VAL_52S DESC, sl.MTRGROUP_CODE ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS RUNNING_BR_VAL,
            ROW_NUMBER() OVER (
                PARTITION BY sl.BRANCH
                ORDER BY sl.VAL_52S DESC, sl.MTRGROUP_CODE ASC
            ) AS RN
        FROM Step1_Lifecycle sl
    ),
    Step3_AbcClassified AS (
        SELECT
            ap.*,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.BR_TOTAL_VAL > 0 THEN (ap.RUNNING_BR_VAL - ap.VAL_CONTRIB) / ap.BR_TOTAL_VAL
                    ELSE 0.0
                END
            ) AS PREV_CUMULATIVE_PCT,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN ap.BR_TOTAL_VAL > 0 THEN ap.RUNNING_BR_VAL / ap.BR_TOTAL_VAL
                    ELSE 1.0
                END
            ) AS CUMULATIVE_PCT,
            -- P3: rangul primului articol eligibil (contributie pozitiva si VAL_52S>0)
            -- din aceeasi ordonare; folosit de ABC_PRIM_ARTICOL_A mai jos
            MIN(CASE WHEN ap.VAL_CONTRIB > 0 AND ap.VAL_52S > 0 THEN ap.RN END) OVER (
                PARTITION BY ap.BRANCH
            ) AS FIRST_ELIGIBLE_RN
        FROM Step2_AbcPareto ap
    ),
    Step3b_AbcLetter AS (
        SELECT
            ac.*,
            CASE
                WHEN @AbcPrimArticolA = 1 AND ac.RN = ac.FIRST_ELIGIBLE_RN THEN 'A'
                WHEN ac.BR_TOTAL_VAL <= 0 OR ac.VAL_52S <= 0 THEN 'C'
                WHEN (CASE WHEN @AbcConventieCumul = 'INCLUSIV' THEN ac.CUMULATIVE_PCT ELSE ac.PREV_CUMULATIVE_PCT END) <= @AbcA THEN 'A'
                WHEN (CASE WHEN @AbcConventieCumul = 'INCLUSIV' THEN ac.CUMULATIVE_PCT ELSE ac.PREV_CUMULATIVE_PCT END) <= @AbcB THEN 'B'
                ELSE 'C'
            END AS ABC,
            CASE
                WHEN ac.LIFECYCLE IN ('NOU', 'OD')
                    OR ac.MAX_LUNA_QTY > @ForceZLunaDominanta * ac.VZ_52S
                    OR ac.LUNI_VZ < @ForceZMinLuni
                    OR ac.VZ_52S <= 0
                THEN 1
                ELSE 0
            END AS IS_FORCED_Z
        FROM Step3_AbcClassified ac
    ),
    Step4_XyzAndClass AS (
        SELECT
            ac.*,
            CASE
                WHEN ac.IS_FORCED_Z = 1 THEN 'Z'
                WHEN ac.CV <= @XyzX THEN 'X'
                WHEN ac.CV <= @XyzY THEN 'Y'
                ELSE 'Z'
            END AS XYZ,
            CASE
                WHEN ac.LIFECYCLE = 'NOU' THEN 'NOU'
                WHEN ac.LIFECYCLE = 'OD' THEN 'OD'
                ELSE ac.ABC + CASE
                    WHEN ac.IS_FORCED_Z = 1 THEN 'Z'
                    WHEN ac.CV <= @XyzX THEN 'X'
                    WHEN ac.CV <= @XyzY THEN 'Y'
                    ELSE 'Z'
                END
            END AS CLASA
        FROM Step3b_AbcLetter ac
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
    -- 13. Persistenta rularii in CCCMINMAXGRP
    --     Starea sta in coloanele GROUP_* ale antetului, nu in STATUS:
    --     ClassifyGroup se ataseaza unei rulari existente fara sa
    --     suprascrie starea lasata de Classify sau de Compute.
    -- ---------------------------------------------------------------
    IF @Persist = 1
    BEGIN
        UPDATE CCCMINMAXRUN
        SET GROUP_STATUS = 'RUNNING',
            GROUP_STARTEDAT = @StartedAt,
            GROUP_FINISHEDAT = NULL,
            GROUP_DURATA_SEC = NULL,
            GROUP_NR_RANDURI = NULL,
            GROUP_ERRORMSG = NULL
        WHERE RUNID = @RunId;

        BEGIN TRY
            INSERT INTO CCCMINMAXGRP (
                RUNID, COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
                MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME, NR_SKU_GRP, NR_SKU_VZ,
                VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
                SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, SIGMA_WK,
                LUNI_VZ, MAX_LUNA_QTY, MEAN_MTH, SIGMA_MTH, CV, IS_FORCED_Z,
                LIFECYCLE, ABC, XYZ, CLASA,
                PREV_CUMULATIVE_PCT, CUMULATIVE_PCT, BR_TOTAL_VAL, BR_GROUP_COUNT
            )
            SELECT
                @RunId, COMPANY, AZI, CONVERT(SMALLINT, BRANCH), MARIME, ESTE_HQ, ESTE_PODEA,
                MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME, NR_SKU_GRP, NR_SKU_VZ,
                VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
                SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, SIGMA_WK,
                LUNI_VZ, MAX_LUNA_QTY, MEAN_MTH, SIGMA_MTH, CV, IS_FORCED_Z,
                LIFECYCLE, ABC, XYZ, CLASA,
                PREV_CUMULATIVE_PCT, CUMULATIVE_PCT, BR_TOTAL_VAL, BR_GROUP_COUNT
            FROM #MinMaxGroupClassified;

            UPDATE CCCMINMAXRUN
            SET GROUP_STATUS = 'DONE',
                GROUP_FINISHEDAT = GETDATE(),
                GROUP_DURATA_SEC = DATEDIFF(SECOND, @StartedAt, GETDATE()),
                GROUP_NR_RANDURI = (SELECT COUNT(*) FROM CCCMINMAXGRP WHERE RUNID = @RunId)
            WHERE RUNID = @RunId;
        END TRY
        BEGIN CATCH
            -- XACT_ABORT poate lasa tranzactia apelantului condamnata; atunci antetul nu mai poate fi marcat.
            IF XACT_STATE() <> -1
                UPDATE CCCMINMAXRUN
                SET GROUP_STATUS = 'ERROR',
                    GROUP_FINISHEDAT = GETDATE(),
                    GROUP_DURATA_SEC = DATEDIFF(SECOND, @StartedAt, GETDATE()),
                    GROUP_ERRORMSG = LEFT(ERROR_MESSAGE(), 500)
                WHERE RUNID = @RunId;

            THROW;
        END CATCH;

        SELECT RUNID, COMPANY, AZI, FAZA, STATUS,
               GROUP_STATUS, GROUP_NR_RANDURI, GROUP_DURATA_SEC, GROUP_STARTEDAT, GROUP_FINISHEDAT
        FROM CCCMINMAXRUN
        WHERE RUNID = @RunId;
    END;

    -- ---------------------------------------------------------------
    -- 14. Output rezultate sau sumar de validare
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

    -- Randurile sunt deja in CCCMINMAXGRP; nu se mai streameaza setul complet.
    IF @Persist = 1
        RETURN;

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
