-- OPTIMIZED: Diagnostic stored procedure for Branch Replenishment
-- Returns detailed information about why materials are excluded from the main result set
-- This procedure is called separately when debug mode is enabled in the UI
-- PERFORMANCE OPTIMIZATIONS:
--   1. Pre-calculated #MaterialStock to avoid expensive NOT EXISTS subqueries
--   2. #FilteredMaterials to apply material code filter once
--   3. TOP 1000 limit per scenario to prevent massive result sets
--   4. Index on #Diagnostics for faster duplicate checking
--   5. Increased timeout tolerance by reducing total processing time

CREATE OR ALTER PROCEDURE sp_GetMtrlsDiagnostics
    @branchesEmit VARCHAR(100),
    @branchesDest VARCHAR(100),
    @company INT = 1000,
    @setConditionForNecesar BIT = 1,
    @setConditionForLimits BIT = 1,
    @fiscalYear INT = NULL,
    @materialCodeFilter VARCHAR(100) = NULL,
    @materialCodeFilterExclude BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    -- Set default fiscal year if not provided
    IF @fiscalYear IS NULL
        SET @fiscalYear = YEAR(GETDATE());

    -- Create temp tables for source and destination branches
    CREATE TABLE #EmitBranches (branch INT PRIMARY KEY);
    CREATE TABLE #DestBranches (branch INT PRIMARY KEY);

    INSERT INTO #EmitBranches (branch)
    SELECT CAST(value AS INT) FROM STRING_SPLIT(@branchesEmit, ',');

    INSERT INTO #DestBranches (branch)
    SELECT CAST(value AS INT) FROM STRING_SPLIT(@branchesDest, ',');

    -- OPTIMIZATION 1: Pre-filter materials ONCE instead of in every scenario
    CREATE TABLE #FilteredMaterials (
        mtrl INT PRIMARY KEY,
        Code VARCHAR(50),
        Name NVARCHAR(200)
    );

    INSERT INTO #FilteredMaterials
    SELECT mtrl, Code, Name
    FROM mtrl
    WHERE sodtype = 51
    AND (@materialCodeFilter IS NULL OR (
        (@materialCodeFilterExclude = 0 AND Code LIKE @materialCodeFilter + '%') OR
        (@materialCodeFilterExclude = 1 AND Code NOT LIKE @materialCodeFilter + '%')
    ));

    -- OPTIMIZATION 2: Pre-calculate stock quantities ONCE for SCENARIO 1
    CREATE TABLE #MaterialStock (
        mtrl INT,
        branch INT,
        stockQty DECIMAL(18,4),
        PRIMARY KEY (mtrl, branch)
    );

    INSERT INTO #MaterialStock
    SELECT 
        a.mtrl,
        br.branch,
        SUM(a.qty1) AS stockQty
    FROM mtrfindata a
    INNER JOIN whouse w ON w.whouse = a.whouse
    INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = w.company AND br.company = @company
    WHERE a.company = @company
    AND a.FISCPRD = @fiscalYear
    AND br.isactive = 1
    AND br.branch IN (SELECT branch FROM #EmitBranches)  -- Only emit branches for SCENARIO 1
    GROUP BY a.mtrl, br.branch
    HAVING SUM(a.qty1) > 0;  -- Only positive stock

    -- Create temp table for branch limits (needed for some diagnostic scenarios)
    CREATE TABLE #BranchLimits (
        mtrl INT,
        branch INT,
        MinLimit DECIMAL(18,4),
        MaxLimit DECIMAL(18,4),
        StockQty DECIMAL(18,4) NULL,
        PendingQty DECIMAL(18,4) NULL,
        TransferQty DECIMAL(18,4) NULL,
        MinNecessity DECIMAL(18,4) NULL,
        MaxNecessity DECIMAL(18,4) NULL
    );

    INSERT INTO #BranchLimits (mtrl, branch, MinLimit, MaxLimit)
    SELECT 
        mtrl, 
        branch,
        CASE WHEN ISNULL(RemainLimMin, 0) > ISNULL(cccminauto, 0) THEN ISNULL(RemainLimMin, 0) ELSE ISNULL(cccminauto, 0) END AS MinLimit,
        CASE WHEN ISNULL(RemainLimMax, 0) > ISNULL(cccmaxauto, 0) THEN ISNULL(RemainLimMax, 0) ELSE ISNULL(cccmaxauto, 0) END AS MaxLimit
    FROM MTRBRNLIMITS 
    WHERE company = @company
    AND (branch IN (SELECT branch FROM #EmitBranches) OR branch IN (SELECT branch FROM #DestBranches));  -- Only relevant branches

    -- Update stock quantities in the branch limits table (for destination branches only - SCENARIO 5 & 6)
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
            AND c.branch IN (SELECT branch FROM #DestBranches)  -- Only dest branches
        GROUP BY c.branch, a.mtrl
    ) stock ON (bl.mtrl = stock.mtrl AND bl.branch = stock.branch);

    -- Calculate necessity values (simplified - only what we need for diagnostics)
    UPDATE #BranchLimits
    SET 
        MinNecessity = CASE WHEN (MinLimit - ISNULL(StockQty, 0)) > 0 
                       THEN (MinLimit - ISNULL(StockQty, 0))
                       ELSE 0 END,
        MaxNecessity = CASE WHEN (MaxLimit - ISNULL(StockQty, 0)) > 0 
                       THEN (MaxLimit - ISNULL(StockQty, 0))
                       ELSE 0 END;

    -- Create diagnostics table
    CREATE TABLE #Diagnostics (
        DiagnosticID INT IDENTITY(1,1) PRIMARY KEY,
        mtrl INT,
        materialCode VARCHAR(50),
        materialName NVARCHAR(200),
        reason VARCHAR(100),
        branchEmit INT NULL,
        branchEmitName NVARCHAR(100) NULL,
        branchDest INT NULL,
        branchDestName NVARCHAR(100) NULL,
        details NVARCHAR(500)
    );

    -- OPTIMIZATION 3: Add index for faster duplicate checking
    CREATE NONCLUSTERED INDEX IX_Diagnostics_MtrlBranch 
    ON #Diagnostics(mtrl, branchEmit, branchDest);

    -- ========================================
    -- SCENARIO 1: No stock in emitting branch (OPTIMIZED)
    -- ========================================
    INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchEmit, branchEmitName, details)
    SELECT TOP 1000  -- OPTIMIZATION 4: Limit results per scenario
        fm.mtrl,
        fm.Code,
        fm.Name,
        'LIPSA_STOC_EMIT',
        eb.branch,
        b.name,
        'Filiala emițătoare ' + CAST(eb.branch AS VARCHAR) + ' (' + b.name + ') nu are stoc pozitiv pentru acest material'
    FROM #FilteredMaterials fm
    CROSS JOIN #EmitBranches eb
    INNER JOIN branch b ON b.branch = eb.branch AND b.company = @company
    WHERE NOT EXISTS (
        -- OPTIMIZED: Use pre-calculated stock table instead of complex subquery
        SELECT 1 FROM #MaterialStock ms
        WHERE ms.mtrl = fm.mtrl
        AND ms.branch = eb.branch
    )
    AND NOT EXISTS (
        SELECT 1 FROM #Diagnostics d WHERE d.mtrl = fm.mtrl AND d.branchEmit = eb.branch
    )
    ORDER BY fm.Code;  -- Deterministic order for TOP

    -- ========================================
    -- SCENARIO 2: No limits defined for destination branch (OPTIMIZED)
    -- NOTE: Emit branches do NOT require limits (LEFT JOIN allows NULL limits)
    --       Available quantity = Stock - ISNULL(MinMax, 0) - Reservations
    -- ========================================
    INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchDest, branchDestName, details)
    SELECT TOP 1000
        fm.mtrl,
        fm.Code,
        fm.Name,
        'LIMITE_INEXISTENTE_DEST',
        db.branch,
        b.name,
        'Filiala destinatară ' + CAST(db.branch AS VARCHAR) + ' (' + b.name + ') nu are limite configurate în MTRBRNLIMITS'
    FROM #FilteredMaterials fm
    CROSS JOIN #DestBranches db
    INNER JOIN branch b ON b.branch = db.branch AND b.company = @company
    WHERE NOT EXISTS (
        SELECT 1 
        FROM MTRBRNLIMITS ml
        WHERE ml.mtrl = fm.mtrl
        AND ml.branch = db.branch
        AND ml.company = @company
    )
    AND NOT EXISTS (
        SELECT 1 FROM #Diagnostics d WHERE d.mtrl = fm.mtrl AND d.branchDest = db.branch
    )
    ORDER BY fm.Code;

    -- ========================================
    -- SCENARIO 4: Destination branch inactive (OPTIMIZED)
    -- ========================================
    INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchDest, branchDestName, details)
    SELECT TOP 1000
        fm.mtrl,
        fm.Code,
        fm.Name,
        'BRANCH_INACTIV_DEST',
        db.branch,
        b.name,
        'Filiala destinatară ' + CAST(db.branch AS VARCHAR) + ' (' + b.name + ') este inactivă în sistemul branch/whouse'
    FROM #FilteredMaterials fm
    CROSS JOIN #DestBranches db
    INNER JOIN branch b ON b.branch = db.branch AND b.company = @company
    WHERE NOT EXISTS (
        SELECT 1 
        FROM whouse w
        INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = w.company AND br.company = @company
        WHERE br.branch = db.branch
        AND br.isactive = 1
        AND w.isactive = 1
    )
    AND NOT EXISTS (
        SELECT 1 FROM #Diagnostics d WHERE d.mtrl = fm.mtrl AND d.branchDest = db.branch
    )
    ORDER BY fm.Code;

    -- ========================================
    -- SCENARIO 4: Filtered out by setConditionForLimits (limits are zero) (OPTIMIZED)
    -- ========================================
    IF @setConditionForLimits = 1
    BEGIN
        INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchDest, branchDestName, details)
        SELECT TOP 1000
            fm.mtrl,
            fm.Code,
            fm.Name,
            'LIMITE_ZERO_DEST',
            db.branch,
            b.name,
            'Filiala destinatară ' + CAST(db.branch AS VARCHAR) + ' (' + b.name + ') are limite = 0 și setConditionForLimits = 1'
        FROM #FilteredMaterials fm
        CROSS JOIN #DestBranches db
        INNER JOIN branch b ON b.branch = db.branch AND b.company = @company
        INNER JOIN #BranchLimits bl ON bl.mtrl = fm.mtrl AND bl.branch = db.branch
        WHERE ISNULL(bl.MaxLimit, 0) = 0
        AND ISNULL(bl.MinLimit, 0) = 0
        AND NOT EXISTS (
            SELECT 1 FROM #Diagnostics d WHERE d.mtrl = fm.mtrl AND d.branchDest = db.branch
        )
        ORDER BY fm.Code;
    END

    -- ========================================
    -- SCENARIO 5: Filtered out by setConditionForNecesar (no necessity) (OPTIMIZED)
    -- ========================================
    IF @setConditionForNecesar = 1
    BEGIN
        INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchDest, branchDestName, details)
        SELECT TOP 1000
            fm.mtrl,
            fm.Code,
            fm.Name,
            'NECESAR_ZERO_DEST',
            db.branch,
            b.name,
            'Filiala destinatară ' + CAST(db.branch AS VARCHAR) + ' (' + b.name + ') are necesar = 0 și setConditionForNecesar = 1'
        FROM #FilteredMaterials fm
        CROSS JOIN #DestBranches db
        INNER JOIN branch b ON b.branch = db.branch AND b.company = @company
        INNER JOIN #BranchLimits bl ON bl.mtrl = fm.mtrl AND bl.branch = db.branch
        WHERE ISNULL(bl.MinNecessity, 0) = 0
        AND ISNULL(bl.MaxNecessity, 0) = 0
        AND NOT EXISTS (
            SELECT 1 FROM #Diagnostics d WHERE d.mtrl = fm.mtrl AND d.branchDest = db.branch
        )
        ORDER BY fm.Code;
    END

    -- Return diagnostics sorted by reason and material
    SELECT 
        DiagnosticID,
        mtrl,
        materialCode AS Cod,
        materialName AS Denumire,
        reason AS Motiv,
        branchEmit AS FilEmit,
        branchEmitName AS NumeFilEmit,
        branchDest AS FilDest,
        branchDestName AS NumeFilDest,
        details AS Detalii
    FROM #Diagnostics
    ORDER BY reason, materialCode, branchEmit, branchDest;

    -- Cleanup temp tables
    DROP TABLE #EmitBranches;
    DROP TABLE #DestBranches;
    DROP TABLE #BranchLimits;
    DROP TABLE #Diagnostics;
    DROP TABLE #FilteredMaterials;  -- NEW
    DROP TABLE #MaterialStock;      -- NEW
END
