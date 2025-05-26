--The data is retrieved from a stored procedure that is executed in the database by internal mechanisms of the ERP

CREATE OR ALTER PROCEDURE sp_GetMtrlsData
    @branchesEmit VARCHAR(100),
    @branchesDest VARCHAR(100),
    @company INT = 1000,
    @setConditionForNecesar BIT = 1,
    @setConditionForLimits BIT = 1,  -- New parameter
    @fiscalYear INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Set default fiscal year if not provided
    IF @fiscalYear IS NULL
        SET @fiscalYear = YEAR(GETDATE());

    -- Create temp tables for source and destination branches to avoid repeated STRING_SPLIT calls
    CREATE TABLE #EmitBranches (branch INT PRIMARY KEY);
    CREATE TABLE #DestBranches (branch INT PRIMARY KEY);

    INSERT INTO #EmitBranches (branch)
    SELECT CAST(value AS INT) FROM STRING_SPLIT(@branchesEmit, ',');

    INSERT INTO #DestBranches (branch)
    SELECT CAST(value AS INT) FROM STRING_SPLIT(@branchesDest, ',');

    -- Create temp table for pre-calculated pending orders
    CREATE TABLE #PendingOrders (
        mtrl INT,
        branchFrom INT,
        branchTo INT,
        qty DECIMAL(18,4)
    );

    -- Populate pending orders temp table once
    -- This replaces multiple calls to getPendingStr() function
    INSERT INTO #PendingOrders
    SELECT 
        A.mtrl, 
        C.BRANCH,
        B.BRANCHSEC,
        SUM((ISNULL(A.QTY1,0)) - (ISNULL(A.QTY1COV,0) + ISNULL(A.QTY1CANC,0)))
    FROM MTRLINES A 
    INNER JOIN findoc c ON (c.findoc=a.findoc AND c.company=a.company AND c.sosource=a.sosource)
    INNER JOIN MTRDOC B ON (A.FINDOC = B.FINDOC AND A.COMPANY = B.COMPANY)
    WHERE 
        A.COMPANY = @company
        AND a.pending = 1
        AND a.restmode IN (1,2) 
        AND c.FISCPRD = @fiscalYear
        AND c.iscancel = 0
        AND c.sosource = 1151
        AND c.FPRMS = 3130
        AND B.BRANCHSEC IN (SELECT branch FROM #DestBranches) -- Use temp table instead of STRING_SPLIT
    GROUP BY A.mtrl, C.BRANCH, B.BRANCHSEC;

    -- Create index on the pending orders temp table
    CREATE NONCLUSTERED INDEX IX_PendingOrders_MTRL_BRANCHTO 
    ON #PendingOrders(mtrl, branchTo);

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
        AND B.BRANCHSEC IN (SELECT branch FROM #DestBranches) -- Use temp table instead of STRING_SPLIT
    GROUP BY C.mtrl, A.BRANCH, B.BRANCHSEC;

    -- Create indexes on the unreceived transfers temp table
    CREATE NONCLUSTERED INDEX IX_UnreceivedTransfers_MTRL_BRANCH 
    ON #UnreceivedTransfers(mtrl, branchTo);
    CREATE NONCLUSTERED INDEX IX_UnreceivedTransfers_MTRL_BRANCHFROM_BRANCHTO 
    ON #UnreceivedTransfers(mtrl, branchFrom, branchTo);

    -- Create temp table for branch limits with calculated max values
    CREATE TABLE #BranchLimits (
        mtrl INT,
        branch INT,
        MinLimit DECIMAL(18,4),
        MaxLimit DECIMAL(18,4),
        -- Add columns to store precalculated values
        StockQty DECIMAL(18,4) NULL,
        PendingQty DECIMAL(18,4) NULL,
        TransferQty DECIMAL(18,4) NULL,
        MinNecessity DECIMAL(18,4) NULL,
        MaxNecessity DECIMAL(18,4) NULL
    );

    -- Populate branch limits temp table
    INSERT INTO #BranchLimits (mtrl, branch, MinLimit, MaxLimit)
    SELECT 
        mtrl, 
        branch,
        CASE WHEN ISNULL(RemainLimMin, 0) > ISNULL(cccminauto, 0) THEN ISNULL(RemainLimMin, 0) ELSE ISNULL(cccminauto, 0) END AS MinLimit,
        CASE WHEN ISNULL(RemainLimMax, 0) > ISNULL(cccmaxauto, 0) THEN ISNULL(RemainLimMax, 0) ELSE ISNULL(cccmaxauto, 0) END AS MaxLimit
    FROM MTRBRNLIMITS 
    WHERE company = @company;

    -- Create index on the branch limits temp table
    CREATE NONCLUSTERED INDEX IX_BranchLimits_MTRL_BRANCH 
    ON #BranchLimits(mtrl, branch);

    -- Update stock quantities in the branch limits table
    UPDATE bl
    SET StockQty = ISNULL(stock.qty, 0)
    FROM #BranchLimits bl
    LEFT JOIN (
        SELECT 
            c.branch,
            a.mtrl,
            ISNULL(SUM(ISNULL(a.qty1, 0)), 0) AS qty
        FROM mtrfindata a
        INNER JOIN whouse b ON (b.whouse = a.whouse)
        INNER JOIN branch c ON (
            c.branch = b.cccbranch
            AND c.company = b.company
            AND c.company = @company
            AND c.isactive = 1
        )
        WHERE 
            a.company = @company
            AND a.FISCPRD = @fiscalYear
        GROUP BY c.branch, a.mtrl
    ) stock ON (bl.mtrl = stock.mtrl AND bl.branch = stock.branch);

    -- Update pending orders in the branch limits table
    UPDATE bl
    SET PendingQty = ISNULL(pending.qty, 0)
    FROM #BranchLimits bl
    LEFT JOIN (
        SELECT mtrl, branchTo AS branch, SUM(qty) AS qty
        FROM #PendingOrders
        GROUP BY mtrl, branchTo
    ) pending ON (bl.mtrl = pending.mtrl AND bl.branch = pending.branch);

    -- Update transfers in the branch limits table
    UPDATE bl
    SET TransferQty = ISNULL(transfer.qty, 0)
    FROM #BranchLimits bl
    LEFT JOIN (
        SELECT mtrl, branchTo AS branch, SUM(qty) AS qty
        FROM #UnreceivedTransfers
        GROUP BY mtrl, branchTo
    ) transfer ON (bl.mtrl = transfer.mtrl AND bl.branch = transfer.branch);    -- Calculate necessity values
    UPDATE #BranchLimits
    SET 
        MinNecessity = CASE WHEN (MinLimit - StockQty - PendingQty - TransferQty) > 0 
                       THEN (MinLimit - StockQty - PendingQty - TransferQty)
                       ELSE 0 END,
        MaxNecessity = CASE WHEN (MaxLimit - StockQty - PendingQty - TransferQty) > 0 
                       THEN (MaxLimit - StockQty - PendingQty - TransferQty)
                       ELSE 0 END;

    -- Create temp table for ABC analysis data
    CREATE TABLE #LatestAbcData (
        mtrl INT,
        branch SMALLINT,
        salesperc FLOAT,
        abc CHAR(1)
    );

    -- Get the most recent ABC analysis for each branch
    INSERT INTO #LatestAbcData (mtrl, branch, salesperc, abc)
    SELECT 
        abc.MTRL,
        abc.BRANCH,
        abc.SALESPERC,
        abc.ABC
    FROM CCCTOPABC abc
    INNER JOIN (
        SELECT 
            abc_inner.MTRL,
            abc_inner.BRANCH,
            MAX(s.DATACALCUL) AS latest_date
        FROM CCCTOPABC abc_inner
        INNER JOIN CCCTOPABCSUMMARY s ON abc_inner.CCCTOPABCSUMMARYID = s.CCCTOPABCSUMMARYID
        WHERE abc_inner.ABC IN ('A', 'B', 'C')
        GROUP BY abc_inner.MTRL, abc_inner.BRANCH
    ) latest ON abc.MTRL = latest.MTRL 
                AND abc.BRANCH = latest.BRANCH
    INNER JOIN CCCTOPABCSUMMARY s2 ON abc.CCCTOPABCSUMMARYID = s2.CCCTOPABCSUMMARYID 
                                   AND s2.DATACALCUL = latest.latest_date;

    -- Create index for performance
    CREATE NONCLUSTERED INDEX IX_LatestAbcData_MTRL_BRANCH 
    ON #LatestAbcData(mtrl, branch);

    -- Main query using WITH clause
    -- Create a CTE for branch necessity calculations
    WITH BranchNecessities AS (
        SELECT 
            bl.mtrl,
            bl.branch,
            bl.MinNecessity,
            bl.MaxNecessity
        FROM #BranchLimits bl
        WHERE bl.branch NOT IN (SELECT branch FROM #EmitBranches)
    ),
    cte AS (
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
                    AND c.branch IN (SELECT branch FROM #EmitBranches)
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
                    AND c.branch IN (SELECT branch FROM #DestBranches)
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
        WHERE branch IN (SELECT branch FROM #DestBranches)
    )
    
    -- Final selection with filters
    SELECT 
        CONCAT(dm.mtrl, dm.branchE, br.branch) keyField, 
        COUNT(dm.mtrl) OVER (ORDER BY dm.mtrl) grouper,
        dm.mtrl, 
        dm.branchE, 
        br.branch branchD,        m.Code Cod, 
        CASE WHEN LEN(m.Name) > 30 THEN CONCAT(LEFT(m.Name, 30), '...') ELSE m.Name END Descriere,
        dm.CantitateE stoc_emit,
        dm.MinE min_emit, 
        dm.MaxE max_emit,
        ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0) disp_min_emit,
        ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0) disp_max_emit,
        brD.name Destinatie,
        CASE WHEN ml.cccisblacklisted IS NULL THEN '-' ELSE CASE WHEN ml.cccisblacklisted = 0 THEN 'Nu' ELSE 'Da' END END Blacklisted,
        CASE WHEN m.cccitemoutlet IS NULL THEN '-' ELSE CASE WHEN m.cccitemoutlet = 0 THEN 'Nu' ELSE 'Da' END END InLichidare,        CASE WHEN cte.CantitateD IS NULL THEN 0 ELSE cte.CantitateD END stoc_dest,
        bl_dest.MinLimit min_dest,
        bl_dest.MaxLimit max_dest,
        ISNULL(abc_data.salesperc, 0) AS salesperc,
        ISNULL(abc_data.abc, '') AS abc_class,
        ISNULL(po.qty, 0) comenzi,
        ISNULL(ut.qty, 0) transf_nerec,
        -- Calculate necessity based on min limit
        ISNULL(bl_dest.MinNecessity, 0) AS nec_min,
        -- Calculate necessity based on max limit
        ISNULL(bl_dest.MaxNecessity, 0) AS nec_max,
        -- Calculate total company necessity based on min limit using the BranchNecessities CTE
        (SELECT ISNULL(SUM(bn.MinNecessity), 0)
         FROM BranchNecessities bn WHERE bn.mtrl = dm.mtrl) AS nec_min_comp,
        -- Calculate total company necessity based on max limit using the BranchNecessities CTE
        (SELECT ISNULL(SUM(bn.MaxNecessity), 0)
         FROM BranchNecessities bn WHERE bn.mtrl = dm.mtrl) AS nec_max_comp,
        -- Calculate quantity that can be transferred (min)
        CASE 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) <= 0 
            THEN 0 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) - ISNULL(bl_dest.MinNecessity, 0) < 0 
            THEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0))  -- Return available if positive but not enough
            ELSE 
                CASE 
                    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) > 
                        ISNULL(bl_dest.MinNecessity, 0)
                    THEN 
                        CASE 
                            WHEN ISNULL(bl_dest.MinNecessity, 0) > 0 
                            THEN ISNULL(bl_dest.MinNecessity, 0)
                            ELSE 0 
                        END
                    ELSE (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0))
                END
        END AS cant_min,
        -- Calculate quantity that can be transferred (max)
        CASE 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) <= 0 
            THEN 0 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) - ISNULL(bl_dest.MaxNecessity, 0) < 0 
            THEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0))  -- Return available if positive but not enough
            ELSE 
                CASE 
                    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0)) > 
                        ISNULL(bl_dest.MaxNecessity, 0)
                    THEN 
                        CASE 
                            WHEN ISNULL(bl_dest.MaxNecessity, 0) > 0 
                            THEN ISNULL(bl_dest.MaxNecessity, 0)
                            ELSE 0 
                        END
                    ELSE (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MaxE, 0))
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
        SELECT mtrl, branchTo, SUM(qty) AS qty
        FROM #PendingOrders
        GROUP BY mtrl, branchTo
    ) po ON (po.mtrl = dm.mtrl AND po.branchTo = br.branch)    LEFT JOIN (
        SELECT mtrl, branchFrom, branchTo, SUM(qty) AS qty
        FROM #UnreceivedTransfers
        GROUP BY mtrl, branchFrom, branchTo
    ) ut ON (ut.mtrl = dm.mtrl AND ut.branchFrom = dm.branchE AND ut.branchTo = br.branch)
    LEFT JOIN #LatestAbcData abc_data ON (
        abc_data.mtrl = dm.mtrl 
        AND abc_data.branch = br.branch
    )
    WHERE (@setConditionForLimits = 0 OR (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0))
    AND (
        @setConditionForNecesar = 0
        OR (bl_dest.MinNecessity > 0 OR bl_dest.MaxNecessity > 0)
    )
    ORDER BY dm.mtrl, dm.branchE, br.branch
    OPTION (RECOMPILE);    -- Clean up temp tables
    DROP TABLE #PendingOrders;
    DROP TABLE #UnreceivedTransfers;
    DROP TABLE #BranchLimits;
    DROP TABLE #LatestAbcData;
    DROP TABLE #EmitBranches;
    DROP TABLE #DestBranches;
END