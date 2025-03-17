--The data is retrieved from a stored procedure that is executed in the database by internal mechanisms of the ERP

CREATE OR ALTER PROCEDURE sp_GetMtrlsData
    @branchesEmit VARCHAR(100),
    @branchesDest VARCHAR(100),
    @company INT = 1000,
    @setConditionForNecesar BIT = 1,
    @fiscalYear INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Set default fiscal year if not provided
    IF @fiscalYear IS NULL
        SET @fiscalYear = YEAR(GETDATE());

    -- Create temp table for pre-calculated pending orders
    CREATE TABLE #PendingOrders (
        mtrl INT,
        whouse INT,
        qty DECIMAL(18,4)
    );

    -- Populate pending orders temp table once
    -- This replaces multiple calls to getPendingStr() function
    INSERT INTO #PendingOrders
    SELECT 
        A.mtrl, 
        A.whouse, 
        SUM((ISNULL(A.QTY1,0)) - (ISNULL(A.QTY1COV,0) + ISNULL(A.QTY1CANC,0)))
    FROM MTRLINES A 
    INNER JOIN findoc c ON (c.findoc=a.findoc AND c.company=a.company AND c.sosource=a.sosource)
    WHERE 
        A.COMPANY = @company
        AND a.pending = 1
        AND a.restmode IN (1,2) 
        AND c.FISCPRD = @fiscalYear
        AND c.iscancel = 0
    GROUP BY A.mtrl, A.whouse;

    -- Create temp table for pre-calculated unreceived transfers
    CREATE TABLE #UnreceivedTransfers (
        mtrl INT,
        branchFrom INT,
        branchTo INT,
        qty DECIMAL(18,4)
    );

    -- Populate unreceived transfers temp table once
    -- This replaces multiple calls to transferuriNereceptionateStr() function
    INSERT INTO #UnreceivedTransfers
    SELECT 
        C.mtrl, 
        A.BRANCH, 
        B.BRANCHSEC, 
        SUM(ISNULL(c.qty1, 0))
    FROM FINDOC A
    INNER JOIN MTRDOC B ON A.FINDOC = B.FINDOC
    INNER JOIN MTRLINES C ON (A.SOSOURCE=C.SOSOURCE AND A.FINDOC=C.FINDOC AND A.COMPANY=C.COMPANY)
    WHERE 
        A.COMPANY = @company
        AND A.SOSOURCE = 1151
        AND A.FPRMS = 3153
        AND A.FULLYTRANSF = 0
        AND B.WHOUSESEC = 9999
        AND A.FISCPRD = @fiscalYear
        AND A.iscancel = 0
    GROUP BY C.mtrl, A.BRANCH, B.BRANCHSEC;

    -- Create temp table for branch limits with calculated max values
    CREATE TABLE #BranchLimits (
        mtrl INT,
        branch INT,
        MinLimit DECIMAL(18,4),
        MaxLimit DECIMAL(18,4)
    );

    -- Populate branch limits temp table
    INSERT INTO #BranchLimits
    SELECT 
        mtrl, 
        branch,
        CASE WHEN ISNULL(RemainLimMin, 0) > ISNULL(cccminauto, 0) THEN ISNULL(RemainLimMin, 0) ELSE ISNULL(cccminauto, 0) END AS MinLimit,
        CASE WHEN ISNULL(RemainLimMax, 0) > ISNULL(cccmaxauto, 0) THEN ISNULL(RemainLimMax, 0) ELSE ISNULL(cccmaxauto, 0) END AS MaxLimit
    FROM MTRBRNLIMITS 
    WHERE company = @company;

    -- Main query using WITH clause
    WITH cte AS (
        SELECT 
            mtrl,
            branchE,
            branchD,
            CantitateE,
            CantitateD,
            MaxE,
            MinE
        FROM (
            SELECT
                a.mtrl,
                a.branchE,
                CantitateE,
                b.branchD,
                b.CantitateD,
                a.MaxE,
                a.MinE
            FROM (
                SELECT 
                    c.branch branchE,
                    a.mtrl,
                    ISNULL(SUM(ISNULL(a.qty1, 0)), 0) CantitateE,
                    bl.MaxLimit MaxE,
                    bl.MinLimit MinE
                FROM mtrfindata a
                INNER JOIN whouse b ON (b.whouse = a.whouse)
                INNER JOIN branch c ON (
                    c.branch = b.cccbranch
                    AND c.company = b.company
                    AND c.company = @company
                    AND c.isactive = 1
                )
                INNER JOIN mtrl d ON (d.mtrl = a.mtrl)
                INNER JOIN #BranchLimits bl ON (a.mtrl = bl.mtrl AND c.branch = bl.branch)
                WHERE 
                    a.company = @company
                    AND a.FISCPRD = @fiscalYear
                    AND d.sodtype = 51
                    AND c.branch IN (SELECT value FROM STRING_SPLIT(@branchesEmit, ','))
                GROUP BY 
                    c.BRANCH,
                    a.MTRL, 
                    bl.MaxLimit, 
                    bl.MinLimit
                HAVING SUM(a.qty1) > 0
            ) a
            LEFT JOIN (
                SELECT 
                    c.branch branchD,
                    a.mtrl,
                    ISNULL(SUM(ISNULL(a.qty1, 0)), 0) CantitateD
                FROM mtrfindata a
                INNER JOIN whouse b ON (b.whouse = a.whouse)
                INNER JOIN branch c ON (
                    c.branch = b.cccbranch
                    AND c.company = b.company
                    AND c.company = @company
                    AND c.isactive = 1
                )
                INNER JOIN mtrl d ON (d.mtrl = a.mtrl)
                WHERE 
                    a.company = @company
                    AND a.FISCPRD = @fiscalYear
                    AND d.sodtype = 51
                    AND c.branch IN (SELECT value FROM STRING_SPLIT(@branchesDest, ','))
                GROUP BY 
                    c.BRANCH,
                    a.MTRL
            ) b ON a.mtrl = b.mtrl
        ) t1
    ),
    br AS (
        SELECT 
            c.branch, 
            c.company, 
            c.isactive
        FROM whouse b
        INNER JOIN branch c ON (
            c.branch = b.cccbranch
            AND c.company = b.company 
            AND c.company = @company
            AND b.isactive = 1
        )
        WHERE branch IN (SELECT value FROM STRING_SPLIT(@branchesDest, ','))
    )
    
    -- Final selection with filters
    SELECT 
        CONCAT(dm.mtrl, dm.branchE, br.branch) keyField, 
        COUNT(dm.mtrl) OVER (ORDER BY dm.mtrl) grouper,
        dm.mtrl, 
        dm.branchE, 
        br.branch branchD, 
        m.Code Cod, 
        CASE WHEN LEN(m.Name) > 50 THEN CONCAT(LEFT(m.Name, 50), '...') ELSE m.Name END Descriere,
        dm.CantitateE stoc_emit, 
        dm.MinE min_emit, 
        dm.MaxE max_emit,
        ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0) disp_min_emit,
        ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0) disp_max_emit,
        brD.name Destinatie,
        CASE WHEN ml.cccisblacklisted IS NULL THEN '-' ELSE CASE WHEN ml.cccisblacklisted = 0 THEN ' Nu' ELSE 'Da' END END Blacklisted,
        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END stoc_dest,
        bl_dest.MinLimit min_dest,
        bl_dest.MaxLimit max_dest,
        ISNULL(po.qty, 0) comenzi,
        ISNULL(ut.qty, 0) transf_nerec,
        -- Calculate necessity based on min limit
        ISNULL(bl_dest.MinLimit, 0) - 
            CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
            ISNULL(po.qty, 0) - 
            ISNULL(ut.qty, 0) AS nec_min,
        -- Calculate necessity based on max limit
        ISNULL(bl_dest.MaxLimit, 0) - 
            CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
            ISNULL(po.qty, 0) - 
            ISNULL(ut.qty, 0) AS nec_max,
        -- Total company necessity for min limit
        (SELECT ISNULL(SUM(MinLimit), 0) FROM #BranchLimits WHERE mtrl = dm.mtrl) AS nec_min_comp,
        -- Total company necessity for max limit
        (SELECT ISNULL(SUM(MaxLimit), 0) FROM #BranchLimits WHERE mtrl = dm.mtrl) AS nec_max_comp,
        -- Calculate quantity that can be transferred (min)
        CASE 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) - 
                (ISNULL(bl_dest.MinLimit, 0) - 
                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) < 0 
            THEN 0 
            ELSE 
                CASE 
                    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) > 
                        (ISNULL(bl_dest.MinLimit, 0) - 
                        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                        ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) 
                    THEN 
                        CASE 
                            WHEN (ISNULL(bl_dest.MinLimit, 0) - 
                                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) > 0 
                            THEN (ISNULL(bl_dest.MinLimit, 0) - 
                                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0))
                            ELSE 0 
                        END
                    ELSE (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) - 
                        (ISNULL(bl_dest.MinLimit, 0) - 
                        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                        ISNULL(po.qty, 0) - ISNULL(ut.qty, 0))
                END
        END AS cant_min,
        -- Calculate quantity that can be transferred (max)
        CASE 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) - 
                (ISNULL(bl_dest.MaxLimit, 0) - 
                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) < 0 
            THEN 0 
            ELSE 
                CASE 
                    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) > 
                        (ISNULL(bl_dest.MaxLimit, 0) - 
                        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                        ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) 
                    THEN 
                        CASE 
                            WHEN (ISNULL(bl_dest.MaxLimit, 0) - 
                                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0)) > 0 
                            THEN (ISNULL(bl_dest.MaxLimit, 0) - 
                                CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                                ISNULL(po.qty, 0) - ISNULL(ut.qty, 0))
                            ELSE 0 
                        END
                    ELSE (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) - 
                        (ISNULL(bl_dest.MaxLimit, 0) - 
                        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
                        ISNULL(po.qty, 0) - ISNULL(ut.qty, 0))
                END
        END AS cant_max,
        0 AS transfer
    FROM br
    CROSS JOIN (
        SELECT DISTINCT 
            mtrl, 
            branchE, 
            CantitateE, 
            MaxE, 
            MinE
        FROM cte
    ) dm
    LEFT JOIN cte ON (
        dm.mtrl = cte.mtrl
        AND br.branch = cte.branchD
    )
    INNER JOIN mtrl m ON m.mtrl = dm.mtrl
    INNER JOIN branch brD ON (
        brD.branch = br.branch 
        AND br.company = brD.company 
        AND br.company = @company 
        AND br.isactive = 1
    )
    INNER JOIN MTRBRNLIMITS ml ON (
        ml.mtrl = dm.mtrl 
        AND ml.branch = br.branch 
        AND ml.company = br.company 
        AND ml.company = @company
    )
    INNER JOIN #BranchLimits bl_dest ON (
        bl_dest.mtrl = dm.mtrl 
        AND bl_dest.branch = br.branch
    )
    LEFT JOIN (
        SELECT mtrl, whouse, SUM(qty) AS qty
        FROM #PendingOrders
        GROUP BY mtrl, whouse
    ) po ON (po.mtrl = dm.mtrl AND po.whouse = br.branch)
    LEFT JOIN (
        SELECT mtrl, branchFrom, branchTo, SUM(qty) AS qty
        FROM #UnreceivedTransfers
        GROUP BY mtrl, branchFrom, branchTo
    ) ut ON (ut.mtrl = dm.mtrl AND ut.branchFrom = dm.branchE AND ut.branchTo = br.branch)
    WHERE (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0)
    AND (
        @setConditionForNecesar = 0
        OR (
            ISNULL(bl_dest.MinLimit, 0) - 
            CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
            ISNULL(po.qty, 0) - ISNULL(ut.qty, 0) > 0
            OR
            ISNULL(bl_dest.MaxLimit, 0) - 
            CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END -
            ISNULL(po.qty, 0) - ISNULL(ut.qty, 0) > 0
        )
    )
    ORDER BY dm.mtrl, dm.branchE, br.branch;

    -- Clean up temp tables
    DROP TABLE #PendingOrders;
    DROP TABLE #UnreceivedTransfers;
    DROP TABLE #BranchLimits;
END