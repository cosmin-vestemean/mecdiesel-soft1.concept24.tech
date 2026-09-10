-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — Faza 3: dbo.sp_MinMaxEngine_Compute
-- Calcul buffer, cycle, cap HQ, podea Bucuresti, pack rules si BUY_QTY.
-- Sursa: CCCMINMAXDET pentru un RUNID deja clasificat (STATUS='DONE').
-- Referinta: new_min_max/FAZA3_HANDOFF.md
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_Compute
    @Company SMALLINT,
    @RunId INT,
    @Mtrl INT = NULL,
    @SummaryOnly BIT = 0,
    @Persist BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @StartedAt DATETIME = GETDATE();

    -- ---------------------------------------------------------------
    -- 1. Validare @RunId (precondiii din FAZA3_HANDOFF.md §4.1)
    -- ---------------------------------------------------------------
    DECLARE @RunCompany SMALLINT;
    DECLARE @RunStatus VARCHAR(10);
    DECLARE @RunFaza VARCHAR(20);
    DECLARE @RunSession VARCHAR(10);

    SELECT @RunCompany = COMPANY, @RunStatus = STATUS, @RunFaza = FAZA, @RunSession = SESSION_STATUS
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId;

    IF @RunCompany IS NULL
        THROW 50010, 'sp_MinMaxEngine_Compute: the requested RUNID does not exist.', 1;

    IF @RunCompany <> @Company
        THROW 50011, 'sp_MinMaxEngine_Compute: RUNID belongs to a different company.', 1;

    IF @RunStatus <> 'DONE'
        THROW 50012, 'sp_MinMaxEngine_Compute: RUNID is not in DONE status.', 1;

    IF @RunFaza NOT IN ('CLASSIFY', 'COMPUTE')
        THROW 50013, 'sp_MinMaxEngine_Compute: RUNID has not completed classification.', 1;

    -- Citirea unei sesiuni inchise ramane permisa; doar scrierea este blocata.
    IF @Persist = 1 AND COALESCE(@RunSession, '') <> 'OPEN'
        THROW 50017, 'sp_MinMaxEngine_Compute: the session is not OPEN; a finished session is immutable.', 1;

    -- ---------------------------------------------------------------
    -- 2. Citire parametri din snapshot-ul rularii (CCCMINMAXRUNPARAM)
    --    @RunId e obligatoriu si se refera intotdeauna la o sesiune
    --    deschisa cu StartRun, deci snapshot-ul exista deja.
    -- ---------------------------------------------------------------
    DECLARE @InflatieHq DECIMAL(10, 4);
    DECLARE @HqCapFactor DECIMAL(10, 4);
    DECLARE @CapLuni DECIMAL(10, 4);
    DECLARE @ProcentPodeaBuc DECIMAL(10, 4);
    DECLARE @CzCycleZero BIT;
    DECLARE @Vz26CapSentinel DECIMAL(28, 8);
    DECLARE @FlagsZeroLaApply BIT;

    SELECT @InflatieHq = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'INFLATIE_HQ';

    SELECT @HqCapFactor = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'HQ_CAP_FACTOR';

    SELECT @CapLuni = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'CAP_LUNI';

    SELECT @ProcentPodeaBuc = TRY_CONVERT(DECIMAL(10, 4), PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'PROCENT_PODEA_BUC';

    SELECT @CzCycleZero = TRY_CONVERT(BIT, PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'CZ_CYCLE_ZERO';

    SELECT @Vz26CapSentinel = TRY_CONVERT(DECIMAL(28, 8), PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'VZ26_CAP_SENTINEL';

    SELECT @FlagsZeroLaApply = TRY_CONVERT(BIT, PARAMVALUE)
    FROM CCCMINMAXRUNPARAM
    WHERE RUNID = @RunId AND BRANCH = 0 AND PREFIX = '' AND PARAMKEY = 'FLAGS_ZERO_LA_APPLY';

    IF COALESCE(@InflatieHq, 0) <= 0 SET @InflatieHq = 1.30;
    IF COALESCE(@HqCapFactor, 0) <= 0 SET @HqCapFactor = 1.5;
    IF COALESCE(@CapLuni, 0) <= 0 SET @CapLuni = 6;
    IF COALESCE(@ProcentPodeaBuc, 0) <= 0 SET @ProcentPodeaBuc = 0.30;
    SET @CzCycleZero = COALESCE(@CzCycleZero, 1);
    IF COALESCE(@Vz26CapSentinel, 0) <= 0 SET @Vz26CapSentinel = 9999;
    SET @FlagsZeroLaApply = COALESCE(@FlagsZeroLaApply, 1);

    -- ---------------------------------------------------------------
    -- 3. #Src — randurile clasificate ale rularii (pipeline §4.2 pas 2)
    -- ---------------------------------------------------------------
    SELECT
        RUNID, COMPANY, AZI, BRANCH, MARIME, ESTE_HQ, ESTE_PODEA,
        MTRL, MTRSUP, CODE, MTRL_NAME, MTRGROUP, MTRGROUP_CODE, MTRGROUP_NAME,
        VZ_4S, VZ_13S, VZ_26S, VZ_52S, VAL_52S,
        SAPT_VZ, SAPT_8S, SAPT_FARA, ULT_VANZ, MIN_DOC, SIGMA_WK,
        LIFECYCLE, ABC, XYZ, CLASA, COV_TGT, SL, SSF, LT_ZILE, FRECVENTA_ZILE,
        [AVG], ad
    INTO #Src
    FROM CCCMINMAXDET
    WHERE RUNID = @RunId
        AND (@Mtrl IS NULL OR MTRL = @Mtrl);

    CREATE CLUSTERED INDEX IX_Src_BranchMtrl
        ON #Src (BRANCH, MTRL);

    IF NOT EXISTS (SELECT 1 FROM #Src)
        THROW 50014, 'sp_MinMaxEngine_Compute: no rows found in CCCMINMAXDET for the requested RUNID/MTRL.', 1;

    SELECT DISTINCT BRANCH, ESTE_HQ
    INTO #RunBranches
    FROM #Src;

    -- WHOUSE.ISACTIVE nu se filtreaza aici: tiparul de stoc validat in productie
    -- (sp_GetMtrlsData) restrange pe filiala, nu pe depozit.
    -- CCCBRANCH este int, BRANCH din CCCMINMAXDET este smallint: conversia evita
    -- conversii implicite in fiecare join ulterior.
    SELECT w.WHOUSE, CONVERT(SMALLINT, w.CCCBRANCH) AS BRANCH
    INTO #WhouseBranch
    FROM WHOUSE w
    WHERE w.COMPANY = @Company
        AND w.CCCBRANCH IS NOT NULL;

    CREATE CLUSTERED INDEX IX_WhouseBranch_Whouse
        ON #WhouseBranch (WHOUSE);

    -- ---------------------------------------------------------------
    -- 4. #Stock — STOC_QTY per (BRANCH, MTRL); HQ = suma nationala (D1)
    -- ---------------------------------------------------------------
    DECLARE @FiscPrd INT = YEAR(GETDATE());

    SELECT
        wb.BRANCH,
        fd.MTRL,
        CONVERT(DECIMAL(28, 8), SUM(COALESCE(fd.QTY1, 0))) AS STOC_QTY
    INTO #StockBranch
    FROM MTRFINDATA fd
    INNER JOIN #WhouseBranch wb
        ON wb.WHOUSE = fd.WHOUSE
    WHERE fd.COMPANY = @Company
        AND fd.FISCPRD = @FiscPrd
        AND (@Mtrl IS NULL OR fd.MTRL = @Mtrl)
    GROUP BY wb.BRANCH, fd.MTRL;

    SELECT sb.BRANCH, sb.MTRL, sb.STOC_QTY
    INTO #Stock
    FROM #StockBranch sb
    INNER JOIN #RunBranches rb
        ON rb.BRANCH = sb.BRANCH AND rb.ESTE_HQ = 0;

    INSERT INTO #Stock (BRANCH, MTRL, STOC_QTY)
    SELECT hq.BRANCH, sb.MTRL, CONVERT(DECIMAL(28, 8), SUM(sb.STOC_QTY))
    FROM #StockBranch sb
    INNER JOIN #RunBranches rb
        ON rb.BRANCH = sb.BRANCH AND rb.ESTE_HQ = 0
    CROSS JOIN (SELECT BRANCH FROM #RunBranches WHERE ESTE_HQ = 1) hq
    GROUP BY hq.BRANCH, sb.MTRL;

    CREATE CLUSTERED INDEX IX_Stock_BranchMtrl
        ON #Stock (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 5. #PendingSup — ORD_FURN per (BRANCH, MTRL); HQ = total companie (D2)
    --    Expresie directa in loc de FNSOGETLINEPEND: UDF-ul scalar forteaza plan serial.
    -- ---------------------------------------------------------------
    SELECT
        wb.BRANCH,
        ml.MTRL,
        CONVERT(DECIMAL(28, 8), SUM(
            COALESCE(ml.QTY1, 0) - COALESCE(ml.QTY1COV, 0) - COALESCE(ml.QTY1CANC, 0)
        )) AS ORD_FURN
    INTO #PendingSrc
    FROM MTRLINES ml
    INNER JOIN FINDOC f
        ON f.COMPANY = ml.COMPANY AND f.FINDOC = ml.FINDOC AND f.SOSOURCE = ml.SOSOURCE
    INNER JOIN RESTMODE rm
        ON rm.COMPANY = ml.COMPANY AND rm.RESTMODE = ml.RESTMODE
    LEFT JOIN #WhouseBranch wb
        ON wb.WHOUSE = ml.WHOUSE
    WHERE ml.COMPANY = @Company
        AND ml.SOSOURCE = 1251
        AND ml.PENDING = 1
        AND rm.RESTCATEG = 1
        AND f.ISCANCEL = 0
        AND (@Mtrl IS NULL OR ml.MTRL = @Mtrl)
    GROUP BY wb.BRANCH, ml.MTRL;

    SELECT ps.BRANCH, ps.MTRL, ps.ORD_FURN
    INTO #PendingSup
    FROM #PendingSrc ps
    INNER JOIN #RunBranches rb
        ON rb.BRANCH = ps.BRANCH AND rb.ESTE_HQ = 0;

    -- Totalul de companie include si liniile fara CCCBRANCH (depozit 8002) — D2a deschis.
    INSERT INTO #PendingSup (BRANCH, MTRL, ORD_FURN)
    SELECT hq.BRANCH, ps.MTRL, CONVERT(DECIMAL(28, 8), SUM(ps.ORD_FURN))
    FROM #PendingSrc ps
    CROSS JOIN (SELECT BRANCH FROM #RunBranches WHERE ESTE_HQ = 1) hq
    GROUP BY hq.BRANCH, ps.MTRL;

    CREATE CLUSTERED INDEX IX_PendingSup_BranchMtrl
        ON #PendingSup (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 6. #ErpLimits — limite ERP, flags externe, N_PACK, LAST_RECEIPT
    --    HQ citeste nivelul de companie din MTRL; filialele din MTRBRNLIMITS.
    -- ---------------------------------------------------------------
    SELECT
        mt.MTRL,
        MAX(mt.TRNDATE) AS LAST_RECEIPT
    INTO #LastReceipt
    FROM MTRTRN mt
    INNER JOIN TPRMS tp
        ON tp.COMPANY = mt.COMPANY AND tp.SODTYPE = mt.SODTYPE AND tp.TPRMS = mt.TPRMS
    WHERE mt.COMPANY = @Company
        AND mt.SOSOURCE = 1251
        AND COALESCE(tp.FLG01, 0) = 1
        AND (@Mtrl IS NULL OR mt.MTRL = @Mtrl)
    GROUP BY mt.MTRL;

    CREATE CLUSTERED INDEX IX_LastReceipt_Mtrl
        ON #LastReceipt (MTRL);

    SELECT
        s.BRANCH,
        s.MTRL,
        CONVERT(BIT, CASE WHEN s.ESTE_HQ = 1 OR bl.MTRL IS NOT NULL THEN 1 ELSE 0 END) AS ARE_POZITIE_ERP,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN s.ESTE_HQ = 1 THEN COALESCE(m.REMAINLIMMIN, 0) ELSE COALESCE(bl.REMAINLIMMIN, 0) END
        ) AS ERP_MIN,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN s.ESTE_HQ = 1 THEN COALESCE(m.REMAINLIMMAX, 0) ELSE COALESCE(bl.REMAINLIMMAX, 0) END
        ) AS ERP_MAX,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN s.ESTE_HQ = 1 THEN COALESCE(m.CCCMINAUTOCOMP, 0) ELSE COALESCE(bl.CCCMINAUTO, 0) END
        ) AS ERP_MIN_AUTO,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN s.ESTE_HQ = 1 THEN COALESCE(m.CCCMAXAUTOCOMP, 0) ELSE COALESCE(bl.CCCMAXAUTO, 0) END
        ) AS ERP_MAX_AUTO,
        CONVERT(DECIMAL(28, 8),
            CASE WHEN COALESCE(m.MTRPACK, 0) <= 0 THEN 1 ELSE m.MTRPACK END
        ) AS N_PACK,
        CONVERT(BIT, CASE WHEN COALESCE(m.CCCITEMOUTLET, 0) <> 0 THEN 1 ELSE 0 END) AS FLAG_LICHIDARE,
        CONVERT(BIT, CASE WHEN COALESCE(m.CCCBLOCKPUR, 0) <> 0 THEN 1 ELSE 0 END) AS FLAG_BLOCAT,
        CONVERT(BIT, CASE WHEN COALESCE(m.CCCEXSTAT, 0) <> 0 THEN 1 ELSE 0 END) AS FLAG_EXCLUS,
        lr.LAST_RECEIPT
    INTO #ErpLimits
    FROM #Src s
    LEFT JOIN MTRL m
        ON m.MTRL = s.MTRL AND m.COMPANY = @Company
    LEFT JOIN MTRBRNLIMITS bl
        ON bl.COMPANY = @Company AND bl.MTRL = s.MTRL AND bl.BRANCH = s.BRANCH
    LEFT JOIN #LastReceipt lr
        ON lr.MTRL = s.MTRL;

    CREATE CLUSTERED INDEX IX_ErpLimits_BranchMtrl
        ON #ErpLimits (BRANCH, MTRL);

    -- ---------------------------------------------------------------
    -- 7. #Calc — formule pe rand (§3.2)
    --    T-SQL nu are MIN/MAX scalar sub SQL Server 2022: se folosesc
    --    agregate peste (VALUES ...), cu CONVERT pe fiecare termen ca sa
    --    nu urce precizia intermediara la DECIMAL(38, x).
    -- ---------------------------------------------------------------
    ;WITH Joined AS (
        SELECT
            s.RUNID, s.COMPANY, s.AZI, s.BRANCH, s.ESTE_HQ, s.ESTE_PODEA, s.MTRL,
            s.LIFECYCLE, s.CLASA, s.COV_TGT, s.SL, s.SSF, s.LT_ZILE, s.FRECVENTA_ZILE,
            s.SIGMA_WK, s.MIN_DOC, s.VZ_13S, s.VZ_26S, s.VZ_52S, s.[AVG], s.ad,
            CONVERT(DECIMAL(28, 8), COALESCE(st.STOC_QTY, 0)) AS STOC_QTY,
            CONVERT(DECIMAL(28, 8), COALESCE(pd.ORD_FURN, 0)) AS ORD_FURN,
            CONVERT(DECIMAL(28, 8), COALESCE(NULLIF(el.N_PACK, 0), 1)) AS N_PACK,
            el.ERP_MIN, el.ERP_MAX, el.ERP_MIN_AUTO, el.ERP_MAX_AUTO,
            el.LAST_RECEIPT, el.ARE_POZITIE_ERP,
            el.FLAG_LICHIDARE, el.FLAG_BLOCAT, el.FLAG_EXCLUS
        FROM #Src s
        LEFT JOIN #Stock st
            ON st.BRANCH = s.BRANCH AND st.MTRL = s.MTRL
        LEFT JOIN #PendingSup pd
            ON pd.BRANCH = s.BRANCH AND pd.MTRL = s.MTRL
        LEFT JOIN #ErpLimits el
            ON el.BRANCH = s.BRANCH AND el.MTRL = s.MTRL
    ),
    Step1 AS (
        SELECT
            j.*,
            CONVERT(DECIMAL(28, 8), j.SIGMA_WK * j.SSF * SQRT(CONVERT(FLOAT, j.LT_ZILE) / 7.0)) AS SAFETY,
            CONVERT(DECIMAL(28, 8), j.ad * j.LT_ZILE) AS LT_STOCK,
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN j.COV_TGT = 0 AND @CzCycleZero = 1 THEN 0
                    ELSE (
                        SELECT MAX(v) FROM (VALUES
                            (CONVERT(DECIMAL(28, 8), j.[AVG] * j.COV_TGT)),
                            (CONVERT(DECIMAL(28, 8), j.ad * j.FRECVENTA_ZILE))
                        ) t(v)
                    )
                END
            ) AS CYCLE
        FROM Joined j
    ),
    Step2 AS (
        SELECT
            s1.*,
            CONVERT(DECIMAL(28, 8), s1.LT_STOCK * (100.0 / COALESCE(NULLIF(s1.SL, 0), 100.0) - 1)) AS SLTS
        FROM Step1 s1
    ),
    Step3 AS (
        SELECT
            s2.*,
            CONVERT(DECIMAL(28, 8), s2.SAFETY + s2.SLTS + s2.LT_STOCK) AS BUF
        FROM Step2 s2
    ),
    Step4 AS (
        SELECT
            s3.*,
            CONVERT(DECIMAL(28, 8), CEILING(s3.BUF + s3.CYCLE)) AS MAX_RAW,
            CONVERT(DECIMAL(28, 8), CEILING(s3.[AVG] * @CapLuni)) AS CAP6,
            CONVERT(DECIMAL(28, 8),
                CASE WHEN s3.VZ_26S > 0 THEN s3.VZ_26S ELSE @Vz26CapSentinel END
            ) AS VZ26_CAP
        FROM Step3 s3
    ),
    Step5 AS (
        SELECT
            s4.*,
            CONVERT(DECIMAL(28, 8),
                CASE WHEN s4.ESTE_HQ = 1 THEN CEILING(s4.MAX_RAW * @InflatieHq) ELSE s4.MAX_RAW END
            ) AS MAX_INF,
            CONVERT(DECIMAL(28, 8), (
                SELECT MAX(v) FROM (VALUES
                    (CONVERT(DECIMAL(28, 8), CEILING(s4.BUF))),
                    (CONVERT(DECIMAL(28, 8), s4.MIN_DOC))
                ) t(v)
            )) AS MIN_BASE
        FROM Step4 s4
    ),
    Step6 AS (
        SELECT
            s5.*,
            -- E1: OD scurtcircuitat explicit, ca planseul SIGMA_MIN sa nu produca buffer pe un articol fara cerere.
            CONVERT(DECIMAL(28, 8),
                CASE
                    WHEN s5.LIFECYCLE = 'OD' THEN 0
                    ELSE (
                        SELECT MIN(v) FROM (VALUES
                            (s5.MAX_INF), (s5.CAP6), (s5.VZ26_CAP)
                        ) t(v)
                    )
                END
            ) AS ENG_MAX0
        FROM Step5 s5
    )
    SELECT
        s6.RUNID, s6.COMPANY, s6.AZI, s6.BRANCH, s6.ESTE_HQ, s6.ESTE_PODEA, s6.MTRL,
        s6.LIFECYCLE, s6.VZ_13S, s6.VZ_26S, s6.VZ_52S, s6.[AVG],
        s6.STOC_QTY, s6.ORD_FURN, s6.N_PACK,
        s6.ERP_MIN, s6.ERP_MAX, s6.ERP_MIN_AUTO, s6.ERP_MAX_AUTO,
        s6.LAST_RECEIPT, s6.ARE_POZITIE_ERP,
        s6.FLAG_LICHIDARE, s6.FLAG_BLOCAT, s6.FLAG_EXCLUS,
        s6.SAFETY, s6.LT_STOCK, s6.SLTS, s6.BUF, s6.CYCLE,
        s6.MAX_RAW, s6.MAX_INF, s6.CAP6, s6.VZ26_CAP,
        CONVERT(DECIMAL(28, 8), NULL) AS SUM_BR_MAX,
        s6.ENG_MAX0 AS ENG_MAX,
        CONVERT(DECIMAL(28, 8),
            CASE
                WHEN s6.LIFECYCLE = 'OD' THEN 0
                ELSE (
                    SELECT MIN(v) FROM (VALUES
                        (s6.MIN_BASE), (s6.ENG_MAX0)
                    ) t(v)
                )
            END
        ) AS ENG_MIN,
        CONVERT(DECIMAL(28, 8), NULL) AS BUY_RAW,
        CONVERT(DECIMAL(28, 8), NULL) AS BUY_QTY,
        CONVERT(BIT, 0) AS HQ_CAP_APLICAT,
        CONVERT(BIT, 0) AS PODEA_APLICATA,
        CONVERT(DECIMAL(28, 8), NULL) AS ACOP_CUR,
        CONVERT(DECIMAL(28, 8), NULL) AS FLAG_RATIO,
        CONVERT(VARCHAR(20), NULL) AS FLAG_TXT,
        CONVERT(DECIMAL(28, 8), NULL) AS TREND_PCT,
        CONVERT(VARCHAR(20), NULL) AS STATUS_TREND,
        CONVERT(BIT, NULL) AS DISC_FLAG,
        CONVERT(BIT, NULL) AS WARN_VZ26_ZERO,
        CONVERT(BIT, NULL) AS WARN_STOC_NEG,
        CONVERT(BIT, NULL) AS WARN_STOC_MORT
    INTO #Calc
    FROM Step6 s6;

    CREATE CLUSTERED INDEX IX_Calc_BranchMtrl
        ON #Calc (BRANCH, MTRL);

    CREATE NONCLUSTERED INDEX IX_Calc_MtrlHq
        ON #Calc (MTRL, ESTE_HQ);

    -- ---------------------------------------------------------------
    -- 7a. HQ CAP + re-clamp ENG_MIN (ordinea din §3.3 este obligatorie)
    -- ---------------------------------------------------------------
    UPDATE hq
    SET SUM_BR_MAX = br.SUM_BR_MAX
    FROM #Calc hq
    INNER JOIN (
        SELECT MTRL, CONVERT(DECIMAL(28, 8), SUM(ENG_MAX)) AS SUM_BR_MAX
        FROM #Calc
        WHERE ESTE_HQ = 0
        GROUP BY MTRL
    ) br ON br.MTRL = hq.MTRL
    WHERE hq.ESTE_HQ = 1;

    UPDATE #Calc
    SET ENG_MAX = CONVERT(DECIMAL(28, 8), CEILING(SUM_BR_MAX * @HqCapFactor)),
        HQ_CAP_APLICAT = 1
    WHERE ESTE_HQ = 1
        AND SUM_BR_MAX > 0
        AND ENG_MAX > SUM_BR_MAX * @HqCapFactor;

    -- Fara re-clamp, caparea poate lasa MIN > MAX pe rândul HQ.
    UPDATE #Calc
    SET ENG_MIN = ENG_MAX
    WHERE ESTE_HQ = 1 AND ENG_MIN > ENG_MAX;

    -- ---------------------------------------------------------------
    -- 7b. Podea (ESTE_PODEA = 1), doar unde ENG_MIN_HQ > 0
    --     SUM_BR_MAX ramane snapshot pre-podea: ordinea HQ CAP -> podea
    --     rupe intentionat circularitatea podea -> SUM_BR_MAX -> cap HQ.
    -- ---------------------------------------------------------------
    UPDATE p
    SET ENG_MIN = CONVERT(DECIMAL(28, 8), CEILING(hq.ENG_MIN * @ProcentPodeaBuc)),
        PODEA_APLICATA = 1
    FROM #Calc p
    INNER JOIN #Calc hq
        ON hq.MTRL = p.MTRL AND hq.ESTE_HQ = 1
    WHERE p.ESTE_PODEA = 1
        AND hq.ENG_MIN > 0
        AND p.ENG_MIN < CEILING(hq.ENG_MIN * @ProcentPodeaBuc);

    -- E11/E12: la podea MAX devine egal cu MIN, nu MAX(...).
    UPDATE #Calc
    SET ENG_MAX = ENG_MIN
    WHERE ESTE_PODEA = 1 AND ENG_MIN > ENG_MAX;

    -- ---------------------------------------------------------------
    -- 7c. BUY_QTY — obligatoriu dupa HQ CAP si podea (E10, E13)
    -- ---------------------------------------------------------------
    UPDATE #Calc
    SET BUY_RAW = CONVERT(DECIMAL(28, 8),
        CASE
            WHEN ENG_MAX - (CASE WHEN STOC_QTY > 0 THEN STOC_QTY ELSE 0 END) - ORD_FURN < 0 THEN 0
            ELSE ENG_MAX - (CASE WHEN STOC_QTY > 0 THEN STOC_QTY ELSE 0 END) - ORD_FURN
        END);

    UPDATE #Calc
    SET BUY_QTY = CONVERT(DECIMAL(28, 8), CEILING(BUY_RAW / N_PACK) * N_PACK);

    -- ---------------------------------------------------------------
    -- 7d. Indicatori de raportare + warnings (§3.4)
    -- ---------------------------------------------------------------
    UPDATE #Calc
    SET ACOP_CUR = CONVERT(DECIMAL(28, 8), STOC_QTY / NULLIF([AVG], 0)),
        FLAG_RATIO = CONVERT(DECIMAL(28, 8), ENG_MAX / NULLIF(ERP_MAX, 0)),
        TREND_PCT = CONVERT(DECIMAL(28, 8), 2.0 * VZ_13S / NULLIF(VZ_26S, 0) - 1),
        DISC_FLAG =
            CASE
                WHEN LAST_RECEIPT IS NULL THEN NULL
                WHEN DATEDIFF(DAY, LAST_RECEIPT, AZI) > 365 THEN 1
                ELSE 0
            END,
        WARN_VZ26_ZERO = CASE WHEN COALESCE(VZ_26S, 0) <= 0 THEN 1 ELSE 0 END,
        WARN_STOC_NEG = CASE WHEN STOC_QTY < 0 THEN 1 ELSE 0 END,
        WARN_STOC_MORT = CASE WHEN ENG_MAX = 0 AND STOC_QTY > 0 THEN 1 ELSE 0 END;

    UPDATE #Calc
    SET FLAG_TXT =
            CASE
                WHEN FLAG_RATIO IS NULL THEN 'FARA_REFERINTA'
                WHEN FLAG_RATIO > 2.00 THEN 'MAJOR_UP'
                WHEN FLAG_RATIO > 1.30 THEN 'UP'
                WHEN FLAG_RATIO >= 0.77 THEN 'OK'
                WHEN FLAG_RATIO >= 0.50 THEN 'DOWN'
                ELSE 'SUPRASTOC'
            END,
        STATUS_TREND =
            CASE
                WHEN TREND_PCT IS NULL THEN 'DECLINE'
                WHEN TREND_PCT > 0.10 THEN 'ACTIVE'
                WHEN TREND_PCT >= -0.10 THEN 'STABLE'
                WHEN TREND_PCT >= -0.30 THEN 'TREND_DOWN'
                ELSE 'DECLINE'
            END;

    -- ---------------------------------------------------------------
    -- 8. Persistenta — o singura trecere peste CCCMINMAXDET
    -- ---------------------------------------------------------------
    IF @Persist = 1
    BEGIN
        UPDATE CCCMINMAXRUN
        SET COMPUTE_STATUS = 'RUNNING',
            COMPUTE_STARTEDAT = @StartedAt,
            COMPUTE_FINISHEDAT = NULL,
            COMPUTE_DURATA_SEC = NULL,
            COMPUTE_ERRORMSG = NULL
        WHERE RUNID = @RunId;

        BEGIN TRY
            UPDATE d
            SET d.STOC_QTY = c.STOC_QTY,
                d.ORD_FURN = c.ORD_FURN,
                d.N_PACK = c.N_PACK,
                d.ERP_MIN = c.ERP_MIN,
                d.ERP_MAX = c.ERP_MAX,
                d.ERP_MIN_AUTO = c.ERP_MIN_AUTO,
                d.ERP_MAX_AUTO = c.ERP_MAX_AUTO,
                d.LAST_RECEIPT = c.LAST_RECEIPT,
                d.ARE_POZITIE_ERP = c.ARE_POZITIE_ERP,
                d.FLAG_LICHIDARE = c.FLAG_LICHIDARE,
                d.FLAG_BLOCAT = c.FLAG_BLOCAT,
                d.FLAG_EXCLUS = c.FLAG_EXCLUS,
                d.SAFETY = c.SAFETY,
                d.LT_STOCK = c.LT_STOCK,
                d.SLTS = c.SLTS,
                d.BUF = c.BUF,
                d.CYCLE = c.CYCLE,
                d.MAX_RAW = c.MAX_RAW,
                d.MAX_INF = c.MAX_INF,
                d.CAP6 = c.CAP6,
                d.VZ26_CAP = c.VZ26_CAP,
                d.SUM_BR_MAX = c.SUM_BR_MAX,
                d.ENG_MIN = c.ENG_MIN,
                d.ENG_MAX = c.ENG_MAX,
                d.BUY_RAW = c.BUY_RAW,
                d.BUY_QTY = c.BUY_QTY,
                d.HQ_CAP_APLICAT = c.HQ_CAP_APLICAT,
                d.PODEA_APLICATA = c.PODEA_APLICATA,
                d.ACOP_CUR = c.ACOP_CUR,
                d.FLAG_RATIO = c.FLAG_RATIO,
                d.FLAG_TXT = c.FLAG_TXT,
                d.TREND_PCT = c.TREND_PCT,
                d.STATUS_TREND = c.STATUS_TREND,
                d.DISC_FLAG = c.DISC_FLAG,
                d.WARN_VZ26_ZERO = c.WARN_VZ26_ZERO,
                d.WARN_STOC_NEG = c.WARN_STOC_NEG,
                d.WARN_STOC_MORT = c.WARN_STOC_MORT
            FROM CCCMINMAXDET d
            INNER JOIN #Calc c
                ON c.RUNID = d.RUNID AND c.BRANCH = d.BRANCH AND c.MTRL = d.MTRL
            WHERE d.RUNID = @RunId;

            UPDATE CCCMINMAXRUN
            SET FAZA = 'COMPUTE',
                COMPUTE_STATUS = 'DONE',
                COMPUTE_FINISHEDAT = GETDATE(),
                COMPUTE_DURATA_SEC = DATEDIFF(SECOND, @StartedAt, GETDATE())
            WHERE RUNID = @RunId;
        END TRY
        BEGIN CATCH
            -- XACT_ABORT poate lasa tranzactia apelantului condamnata; atunci antetul nu mai poate fi marcat.
            IF XACT_STATE() <> -1
                UPDATE CCCMINMAXRUN
                SET COMPUTE_STATUS = 'ERROR',
                    COMPUTE_FINISHEDAT = GETDATE(),
                    COMPUTE_DURATA_SEC = DATEDIFF(SECOND, @StartedAt, GETDATE()),
                    COMPUTE_ERRORMSG = LEFT(ERROR_MESSAGE(), 500)
                WHERE RUNID = @RunId;

            THROW;
        END CATCH;

        SELECT RUNID, COMPANY, AZI, FAZA, STATUS, MTRL,
               COMPUTE_STATUS, COMPUTE_DURATA_SEC, COMPUTE_STARTEDAT, COMPUTE_FINISHEDAT
        FROM CCCMINMAXRUN
        WHERE RUNID = @RunId;
    END;

    -- ---------------------------------------------------------------
    -- 9. Rapoarte de integritate sau setul complet
    -- ---------------------------------------------------------------
    IF @SummaryOnly = 1
    BEGIN
        -- Modulo nu accepta DECIMAL in T-SQL, deci multiplul de pack se verifica prin FLOOR.
        SELECT
            COUNT(*) AS TOTAL_ROWS,
            COUNT(DISTINCT MTRL) AS DISTINCT_ITEMS,
            COUNT(DISTINCT BRANCH) AS DISTINCT_BRANCHES,
            SUM(CASE WHEN ESTE_HQ = 1 THEN 1 ELSE 0 END) AS HQ_ROWS,
            SUM(CASE WHEN ENG_MIN > ENG_MAX THEN 1 ELSE 0 END) AS MIN_GT_MAX_ROWS,
            SUM(CASE WHEN ENG_MIN < 0 OR ENG_MAX < 0 OR BUY_QTY < 0 THEN 1 ELSE 0 END) AS NEGATIVE_RESULT_ROWS,
            SUM(CASE WHEN LIFECYCLE = 'OD' AND ENG_MAX <> 0 AND PODEA_APLICATA = 0 THEN 1 ELSE 0 END) AS OD_NONZERO_ROWS,
            SUM(CASE WHEN LIFECYCLE = 'OD' AND ENG_MAX <> 0 AND PODEA_APLICATA = 1 THEN 1 ELSE 0 END) AS OD_FLOOR_OVERRIDE_ROWS,
            SUM(CASE WHEN BUY_QTY - FLOOR(BUY_QTY / N_PACK) * N_PACK <> 0 THEN 1 ELSE 0 END) AS PACK_MISMATCH_ROWS,
            SUM(CASE WHEN ENG_MIN IS NULL OR ENG_MAX IS NULL OR BUY_QTY IS NULL THEN 1 ELSE 0 END) AS NULL_RESULT_ROWS,
            SUM(CASE WHEN HQ_CAP_APLICAT = 1 THEN 1 ELSE 0 END) AS HQ_CAP_ROWS,
            SUM(CASE WHEN PODEA_APLICATA = 1 THEN 1 ELSE 0 END) AS PODEA_ROWS,
            SUM(CASE WHEN WARN_VZ26_ZERO = 1 THEN 1 ELSE 0 END) AS WARN_VZ26_ZERO_ROWS,
            SUM(CASE WHEN WARN_STOC_NEG = 1 THEN 1 ELSE 0 END) AS WARN_STOC_NEG_ROWS,
            SUM(CASE WHEN WARN_STOC_MORT = 1 THEN 1 ELSE 0 END) AS WARN_STOC_MORT_ROWS,
            SUM(CASE WHEN DISC_FLAG = 1 THEN 1 ELSE 0 END) AS DISC_FLAG_ROWS,
            CONVERT(DECIMAL(28, 2), SUM(ENG_MIN)) AS TOTAL_ENG_MIN,
            CONVERT(DECIMAL(28, 2), SUM(ENG_MAX)) AS TOTAL_ENG_MAX,
            CONVERT(DECIMAL(28, 2), SUM(BUY_QTY)) AS TOTAL_BUY_QTY
        FROM #Calc;

        SELECT
            FLAG_TXT,
            COUNT(*) AS ROWS_COUNT,
            SUM(CASE WHEN ESTE_HQ = 0 THEN 1 ELSE 0 END) AS BRANCH_ROWS
        FROM #Calc
        GROUP BY FLAG_TXT
        ORDER BY FLAG_TXT;

        SELECT
            BRANCH,
            MAX(CONVERT(INT, ESTE_HQ)) AS ESTE_HQ,
            MAX(CONVERT(INT, ESTE_PODEA)) AS ESTE_PODEA,
            COUNT(*) AS TOTAL_ITEMS,
            SUM(CASE WHEN ENG_MAX > 0 THEN 1 ELSE 0 END) AS ITEMS_WITH_MAX,
            SUM(CASE WHEN BUY_QTY > 0 THEN 1 ELSE 0 END) AS ITEMS_TO_BUY,
            CONVERT(DECIMAL(28, 2), SUM(ENG_MIN)) AS TOTAL_ENG_MIN,
            CONVERT(DECIMAL(28, 2), SUM(ENG_MAX)) AS TOTAL_ENG_MAX,
            CONVERT(DECIMAL(28, 2), SUM(BUY_QTY)) AS TOTAL_BUY_QTY
        FROM #Calc
        GROUP BY BRANCH
        ORDER BY BRANCH;

        RETURN;
    END;

    -- Randurile sunt deja in CCCMINMAXDET; nu se mai streameaza setul complet.
    IF @Persist = 1
        RETURN;

    SELECT
        COMPANY, AZI, BRANCH, ESTE_HQ, ESTE_PODEA, MTRL, LIFECYCLE,
        VZ_13S, VZ_26S, VZ_52S, [AVG],
        STOC_QTY, ORD_FURN, N_PACK,
        ERP_MIN, ERP_MAX, ERP_MIN_AUTO, ERP_MAX_AUTO, LAST_RECEIPT, ARE_POZITIE_ERP,
        FLAG_LICHIDARE, FLAG_BLOCAT, FLAG_EXCLUS,
        SAFETY, LT_STOCK, SLTS, BUF, CYCLE,
        MAX_RAW, MAX_INF, CAP6, VZ26_CAP, SUM_BR_MAX,
        ENG_MIN, ENG_MAX, BUY_RAW, BUY_QTY, HQ_CAP_APLICAT, PODEA_APLICATA,
        ACOP_CUR, FLAG_RATIO, FLAG_TXT, TREND_PCT, STATUS_TREND, DISC_FLAG,
        WARN_VZ26_ZERO, WARN_STOC_NEG, WARN_STOC_MORT
    FROM #Calc
    ORDER BY MTRL, BRANCH;
END;
