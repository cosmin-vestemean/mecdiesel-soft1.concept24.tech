--Cod specific S1 - SQL
--a fost creat pentru a adauga o noua optiune de filtrare: DOCUMENT, 
--astfel incat acum se poate filtra pe filiala agentului sau pe filiala documentului
--restul codului este similar cu cel original
CREATE OR ALTER FUNCTION dbo.ufn_vanzariWksOptimized (
    @dataReferinta VARCHAR(max) = NULL,
    @nrSaptamani INT = 0,
    @seriesL VARCHAR(max) = '',
    @branch VARCHAR(max) = '',
    @supplier INT = NULL,
    @mtrl INT = NULL,
    @cod VARCHAR(max) = '',
    @modFiltrareBranch VARCHAR(10) = 'AGENT' -- Valoarea implicită este 'AGENT' pentru compatibilitate cu codul existent
) RETURNS @sales TABLE (
    MTRL INT,
    MTRSUP INT,
    CODARTICOL VARCHAR(MAX),
    DENUMARTICOL VARCHAR(MAX),
    branch SMALLINT,
    pcswk INT,
    wk INT,
    wkflag SMALLINT
) AS 
BEGIN
    -- Pre-determine whether we're dealing with company or branch mode
    DECLARE @isCompanyMode BIT = 0;
    IF (CHARINDEX('1000', @branch) > 0)
        SET @isCompanyMode = 1;

    -- Parse the excluded series once, store in a table variable
    DECLARE @excludedSeries TABLE (series INT);
    INSERT INTO @excludedSeries
    SELECT COALESCE(value, 0)
    FROM STRING_SPLIT(@seriesL, ',')
    WHERE value IS NOT NULL AND value <> '';

    -- Parse branches once if in branch mode
    DECLARE @branchList TABLE (branchId INT);
    IF (@isCompanyMode = 0) 
    BEGIN
        INSERT INTO @branchList
        SELECT COALESCE(value, 0)
        FROM STRING_SPLIT(@branch, ',')
        WHERE value IS NOT NULL AND value <> '';
    END

    -- Company Mode Query
    IF (@isCompanyMode = 1)
    BEGIN
        INSERT @sales
        SELECT 
            a.MTRL,
            CASE WHEN COALESCE(D.MTRSUP, 0) = 0 THEN 72170 ELSE D.MTRSUP END AS MTRSUP,
            d.code AS CODARTICOL,
            d.name AS DENUMARTICOL,
            1000 AS branch,
            COALESCE(SUM(COALESCE((a.qty1 / CAST(d.MU41 AS DECIMAL(18, 8))), 0)), 0) AS pcswk,
            DATEDIFF(wk, b.trndate, @dataReferinta) AS wk,
            1 AS wkflag
        FROM mtrtrn a
        INNER JOIN findoc b ON a.findoc = b.findoc AND a.sosource = b.sosource AND a.company = b.company
        INNER JOIN TPRMS c ON a.company = c.company AND a.sodtype = c.sodtype AND a.tprms = c.tprms
        INNER JOIN MTRL D ON D.MTRL = A.MTRL AND D.SODTYPE = A.SODTYPE
        WHERE a.sosource = 1351
            AND b.iscancel = 0
            AND COALESCE(c.flg04, 0) = 1
            AND COALESCE(c.flg10, 0) = 1
            AND D.SODTYPE = 51
            AND D.MTRACN = 101
            AND ((@supplier <> 72235 AND D.MTRSUP = @supplier) OR (@supplier = 72235))
            AND ((@mtrl <> 2606178 AND A.MTRL = @mtrl) OR (@mtrl = 2606178))
            AND ((LTRIM(RTRIM(@cod)) <> '' AND d.code LIKE LTRIM(RTRIM(@cod))) OR (LTRIM(RTRIM(@cod)) = ''))
            AND NOT EXISTS (SELECT 1 FROM @excludedSeries WHERE series = A.SERIES)
            AND A.FPRMS NOT IN (1)
            AND DATEDIFF(wk, b.trndate, @dataReferinta) >= 0
            AND DATEDIFF(wk, b.trndate, @dataReferinta) <= @nrSaptamani
        GROUP BY 
            a.mtrl, 
            d.mtrsup, 
            d.name, 
            d.code, 
            DATEDIFF(wk, b.trndate, @dataReferinta);
    END
    -- Branch Mode Query
    ELSE
    BEGIN
        IF (@modFiltrareBranch = 'DOCUMENT')
        BEGIN
            -- Filtrare pe filiala documentului (folosind b.BRANCH din findoc)
            INSERT @sales
            SELECT 
                a.MTRL,
                CASE WHEN COALESCE(D.MTRSUP, 0) = 0 THEN 72170 ELSE D.MTRSUP END AS MTRSUP,
                d.code AS CODARTICOL,
                d.name AS DENUMARTICOL,
                b.BRANCH AS branch, -- Se folosește BRANCH-ul documentului
                COALESCE(SUM(COALESCE((a.qty1 / CAST(d.MU41 AS DECIMAL(18, 8))), 0)), 0) AS pcswk,
                DATEDIFF(wk, b.trndate, @dataReferinta) AS wk,
                1 AS wkflag
            FROM mtrtrn a
            INNER JOIN findoc b ON a.findoc = b.findoc AND a.sosource = b.sosource AND a.company = b.company
            INNER JOIN TPRMS c ON a.company = c.company AND a.sodtype = c.sodtype AND a.tprms = c.tprms
            INNER JOIN MTRL D ON D.MTRL = A.MTRL AND D.SODTYPE = A.SODTYPE
            WHERE a.sosource = 1351
                AND b.iscancel = 0
                AND COALESCE(c.flg04, 0) = 1
                AND COALESCE(c.flg10, 0) = 1
                AND D.SODTYPE = 51
                AND D.MTRACN = 101
                AND EXISTS (SELECT 1 FROM @branchList bl WHERE bl.branchId = b.BRANCH)
                AND ((@supplier <> 72235 AND D.MTRSUP = @supplier) OR (@supplier = 72235))
                AND ((@mtrl <> 2606178 AND A.MTRL = @mtrl) OR (@mtrl = 2606178))
                AND ((LTRIM(RTRIM(@cod)) <> '' AND d.code LIKE LTRIM(RTRIM(@cod))) OR (LTRIM(RTRIM(@cod)) = ''))
                AND NOT EXISTS (SELECT 1 FROM @excludedSeries WHERE series = A.SERIES)
                AND A.FPRMS NOT IN (1)
                AND DATEDIFF(wk, b.trndate, @dataReferinta) >= 0
                AND DATEDIFF(wk, b.trndate, @dataReferinta) <= @nrSaptamani
            GROUP BY 
                a.mtrl, 
                d.mtrsup, 
                d.name, 
                d.code, 
                b.BRANCH,
                DATEDIFF(wk, b.trndate, @dataReferinta);
        END
        ELSE -- Default case: @modFiltrareBranch = 'AGENT' or any other value
        BEGIN
            -- Filtrare pe filiala agentului (logica originală)
            INSERT @sales
            SELECT 
                a.MTRL,
                CASE WHEN COALESCE(D.MTRSUP, 0) = 0 THEN 72170 ELSE D.MTRSUP END AS MTRSUP,
                d.code AS CODARTICOL,
                d.name AS DENUMARTICOL,
                e.branch,
                COALESCE(SUM(COALESCE((a.qty1 / CAST(d.MU41 AS DECIMAL(18, 8))), 0)), 0) AS pcswk,
                DATEDIFF(wk, b.trndate, @dataReferinta) AS wk,
                1 AS wkflag
            FROM mtrtrn a
            INNER JOIN findoc b ON a.findoc = b.findoc AND a.sosource = b.sosource AND a.company = b.company
            INNER JOIN TPRMS c ON a.company = c.company AND a.sodtype = c.sodtype AND a.tprms = c.tprms
            INNER JOIN MTRL D ON D.MTRL = A.MTRL AND D.SODTYPE = A.SODTYPE
            LEFT JOIN PRSN E ON E.PRSN = B.SALESMAN
            WHERE a.sosource = 1351
                AND b.iscancel = 0
                AND COALESCE(c.flg04, 0) = 1
                AND COALESCE(c.flg10, 0) = 1
                AND D.SODTYPE = 51
                AND D.MTRACN = 101
                AND EXISTS (SELECT 1 FROM @branchList bl WHERE bl.branchId = e.branch)
                AND ((@supplier <> 72235 AND D.MTRSUP = @supplier) OR (@supplier = 72235))
                AND ((@mtrl <> 2606178 AND A.MTRL = @mtrl) OR (@mtrl = 2606178))
                AND ((LTRIM(RTRIM(@cod)) <> '' AND d.code LIKE LTRIM(RTRIM(@cod))) OR (LTRIM(RTRIM(@cod)) = ''))
                AND NOT EXISTS (SELECT 1 FROM @excludedSeries WHERE series = A.SERIES)
                AND A.FPRMS NOT IN (1)
                AND DATEDIFF(wk, b.trndate, @dataReferinta) >= 0
                AND DATEDIFF(wk, b.trndate, @dataReferinta) <= @nrSaptamani
            GROUP BY 
                a.mtrl, 
                d.mtrsup, 
                d.name, 
                d.code, 
                e.branch,
                DATEDIFF(wk, b.trndate, @dataReferinta);
        END
    END

    RETURN;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_TopAbcAnalysis
    @dataReferinta VARCHAR(max) = NULL,
    @nrSaptamani INT = 0,
    @seriesL VARCHAR(max) = '',
    @branch VARCHAR(max) = '',
    @supplier INT = NULL,           -- Will be mapped to 72235 if NULL (ALL suppliers)
    @mtrl INT = NULL,               -- Will be mapped to 2606178 if NULL (ALL products)
    @cod VARCHAR(max) = '',
    @searchType INT = 1,            -- 1-starts with, 2-contains, 3-ends with
    @modFiltrareBranch VARCHAR(10) = 'AGENT',
    @thresholdA DECIMAL(5,2) = 80.00,
    @thresholdB DECIMAL(5,2) = 15.00
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Handle NULL values from UI by mapping to special sentinel values
    SET @supplier = ISNULL(@supplier, 72235)
    SET @mtrl = ISNULL(@mtrl, 2606178)
    
    -- Format the search pattern based on searchType
    DECLARE @searchPattern VARCHAR(255) = @cod
    IF @searchType = 1 -- starts with
    BEGIN
        SET @searchPattern = @cod + '%'
    END
    ELSE IF @searchType = 2 -- contains
    BEGIN
        SET @searchPattern = '%' + @cod + '%'
    END
    ELSE IF @searchType = 3 -- ends with
    BEGIN
        SET @searchPattern = '%' + @cod
    END
    
    -- Get base sales data from the existing function
    DECLARE @salesData TABLE (
        MTRL INT,
        MTRSUP INT,
        CODARTICOL VARCHAR(MAX),
        DENUMARTICOL VARCHAR(MAX),
        branch SMALLINT,
        pcswk DECIMAL(18,4),
        wk INT,
        wkflag SMALLINT
    );
    
    -- Use the existing function
    INSERT INTO @salesData
    SELECT * FROM dbo.ufn_vanzariWksOptimized(
        @dataReferinta,
        @nrSaptamani,
        @seriesL,
        @branch,
        @supplier,
        @mtrl,
        @searchPattern,   -- Pass the formatted search pattern 
        @modFiltrareBranch
    );
    
    -- Create results table for ABC analysis
    DECLARE @abcResults TABLE (
        MTRL INT,
        MTRSUP INT,
        CODARTICOL VARCHAR(MAX),
        DENUMARTICOL VARCHAR(MAX),
        branch SMALLINT,
        totalSales DECIMAL(18,4),
        salesPercentage DECIMAL(8,4),
        cumulativePercentage DECIMAL(8,4),
        abcClass CHAR(1)
    );
    
    -- Group by product and sum quantities
    WITH ProductSales AS (
        SELECT
            MTRL,
            MTRSUP,
            CODARTICOL,
            DENUMARTICOL,
            branch,
            SUM(pcswk) AS totalSales
        FROM @salesData
        GROUP BY
            MTRL,
            MTRSUP,
            CODARTICOL,
            DENUMARTICOL,
            branch
    ),
    -- Calculate total positive sales
    Totals AS (
        SELECT SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS totalPositiveSales
        FROM ProductSales
    ),
    -- Calculate percentages and rankings
    RankedSales AS (
        SELECT
            p.MTRL,
            p.MTRSUP,
            p.CODARTICOL,
            p.DENUMARTICOL,
            p.branch,
            p.totalSales,
            CASE 
                WHEN p.totalSales > 0 THEN (p.totalSales / NULLIF(t.totalPositiveSales, 0)) * 100
                ELSE 0 
            END AS salesPercentage,
            ROW_NUMBER() OVER (ORDER BY 
                              CASE WHEN p.totalSales > 0 THEN p.totalSales ELSE 0 END DESC) AS salesRank
        FROM ProductSales p
        CROSS JOIN Totals t
    ),
    -- Add cumulative percentages
    CumulativeSales AS (
        SELECT
            MTRL,
            MTRSUP,
            CODARTICOL,
            DENUMARTICOL,
            branch,
            totalSales,
            salesPercentage,
            SUM(salesPercentage) OVER (ORDER BY salesRank ROWS UNBOUNDED PRECEDING) AS cumulativePercentage
        FROM RankedSales
    )
    -- Insert final result with ABC classification
    INSERT INTO @abcResults
    SELECT
        MTRL,
        MTRSUP,
        CODARTICOL,
        DENUMARTICOL,
        branch,
        totalSales,
        salesPercentage,
        cumulativePercentage,
        CASE
            WHEN cumulativePercentage <= @thresholdA THEN 'A'
            WHEN cumulativePercentage <= (@thresholdA + @thresholdB) THEN 'B'
            ELSE 'C'
        END AS abcClass
    FROM CumulativeSales
    ORDER BY salesPercentage DESC;
    
    -- Return the ABC analysis results
    SELECT * FROM @abcResults;
    
    -- Also return summary statistics in a second result set
    WITH AbcSummary AS (
        SELECT
            abcClass,
            COUNT(*) AS itemCount,
            SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS classTotal
        FROM @abcResults
        GROUP BY abcClass
    ),
    TotalItems AS (
        SELECT 
            COUNT(*) AS totalItems,
            SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS grandTotal
        FROM @abcResults
    )
    SELECT 
        ac.abcClass,
        ac.itemCount,
        ac.classTotal,
        (ac.itemCount * 100.0 / NULLIF(ti.totalItems, 0)) AS itemPercentage,
        (ac.classTotal * 100.0 / NULLIF(ti.grandTotal, 0)) AS valuePercentage
    FROM AbcSummary ac
    CROSS JOIN TotalItems ti
    ORDER BY ac.abcClass;
    
    -- Return the total sales number in a third result set
    -- This value can be displayed prominently in the UI
    SELECT SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS totalPositiveSales 
    FROM @abcResults;
END;
GO