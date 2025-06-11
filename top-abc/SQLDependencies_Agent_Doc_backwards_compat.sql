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
    pcswk DECIMAL(18,8),
    valuewk DECIMAL(18,8), -- Adăugat: valoarea vânzărilor
    wk INT,
    wkflag SMALLINT
) AS 
BEGIN
     -- Handle NULL values from UI by mapping to special sentinel values
    SET @supplier = ISNULL(@supplier, 72235)
    SET @mtrl = ISNULL(@mtrl, 2606178)
    
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
            COALESCE(SUM(COALESCE(a.LTRNVAL, 0)), 0) AS valuewk, -- Adăugat: valoarea vânzărilor
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
                COALESCE(SUM(COALESCE(a.LTRNVAL, 0)), 0) AS valuewk, -- Adăugat: valoarea vânzărilor
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
                COALESCE(SUM(COALESCE(a.LTRNVAL, 0)), 0) AS valuewk, -- Adăugat: valoarea vânzărilor
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

CREATE OR ALTER PROCEDURE dbo.sp_TopAbcAnalysis_CombinedJson
    @dataReferinta VARCHAR(max) = NULL,
    @nrSaptamani INT = 0,
    @seriesL VARCHAR(max) = '',
    @branch VARCHAR(max) = '',
    @supplier INT = NULL,
    @mtrl INT = NULL,
    @cod VARCHAR(max) = '',
    @searchType INT = 1,
    @modFiltrareBranch VARCHAR(10) = 'AGENT', -- 'AGENT' or 'DOCUMENT'
    @thresholdA DECIMAL(5,2) = 80.00,
    @thresholdB DECIMAL(5,2) = 15.00
AS
BEGIN
    SET NOCOUNT ON;

    -- Handle NULL values from UI by mapping to special sentinel values
    SET @supplier = ISNULL(@supplier, 72235) -- Assuming 72235 means ALL suppliers
    SET @mtrl = ISNULL(@mtrl, 2606178)     -- Assuming 2606178 means ALL products

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

    -- Temporary table to store detailed results
    CREATE TABLE #DetailedRows (
        MTRL INT,
        MTRSUP INT,
        CODE VARCHAR(MAX),
        DESCRIPTION VARCHAR(MAX),
        BRANCH SMALLINT,
        VALUE FLOAT,
        SUMQTY FLOAT,
        SALESPERC FLOAT,
        CUMULATIVEPERC FLOAT,
        ABC CHAR(1)
    );

    -- Temporary table to store summary results
    CREATE TABLE #SummaryRows (
        ABC CHAR(1),
        ITEMCOUNT INT,
        CLASSTOTAL FLOAT,
        ITEMSPERC FLOAT,
        VALUEPERC FLOAT
    );
    
    -- Get base sales data using the function that supports @modFiltrareBranch
    DECLARE @salesData TABLE (
        MTRL INT,
        MTRSUP INT,
        CODARTICOL VARCHAR(MAX),
        DENUMARTICOL VARCHAR(MAX),
        branch SMALLINT,
        pcswk DECIMAL(18,8), -- Cantitatea
        valuewk DECIMAL(18,8), -- Valoarea vânzărilor
        wk INT,
        wkflag SMALLINT
    );
    
    INSERT INTO @salesData
    SELECT * FROM dbo.ufn_vanzariWksOptimized( -- This is the version from SQLDependencies_Agent_Doc_backwards_compat.sql
        @dataReferinta,
        @nrSaptamani,
        @seriesL,
        @branch,
        @supplier,
        @mtrl,
        @searchPattern,
        @modFiltrareBranch -- Pass the new parameter
    );

    -- Perform ABC Analysis
    DECLARE @abcResults TABLE (
        MTRL INT, MTRSUP INT, CODARTICOL VARCHAR(MAX), DENUMARTICOL VARCHAR(MAX), branch SMALLINT,
        totalSales FLOAT, totalQty FLOAT, salesPercentage FLOAT, cumulativePercentage FLOAT, abcClass CHAR(1)
    );

    WITH ProductSales AS (
        SELECT MTRL, MTRSUP, CODARTICOL, DENUMARTICOL, branch, 
               SUM(valuewk) AS totalSales, -- Modificat: folosim valoarea
               SUM(pcswk) AS totalQty      -- Adaugat: folosim cantitatea
        FROM @salesData GROUP BY MTRL, MTRSUP, CODARTICOL, DENUMARTICOL, branch
    ),
    Totals AS (
        SELECT SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS totalPositiveSales FROM ProductSales
    ),
    RankedSales AS (
        SELECT p.*, 
               CASE WHEN p.totalSales > 0 THEN (p.totalSales / NULLIF(t.totalPositiveSales,0)) * 100 ELSE 0 END AS salesPercentage,
               ROW_NUMBER() OVER (ORDER BY CASE WHEN p.totalSales > 0 THEN p.totalSales ELSE 0 END DESC) AS salesRank
        FROM ProductSales p CROSS JOIN Totals t
    ),
    CumulativeSales AS (
        SELECT *, SUM(salesPercentage) OVER (ORDER BY salesRank ROWS UNBOUNDED PRECEDING) AS cumulativePercentage
        FROM RankedSales
    )
    INSERT INTO @abcResults
    SELECT MTRL, MTRSUP, CODARTICOL, DENUMARTICOL, branch, totalSales, totalQty, salesPercentage, cumulativePercentage,
           CASE 
               WHEN cumulativePercentage <= @thresholdA THEN 'A'
               WHEN cumulativePercentage <= (@thresholdA + @thresholdB) THEN 'B'
               ELSE 'C' 
           END
    FROM CumulativeSales ORDER BY salesPercentage DESC, totalSales DESC;

    -- Populate #DetailedRows
    INSERT INTO #DetailedRows (MTRL, MTRSUP, CODE, DESCRIPTION, BRANCH, VALUE, SUMQTY, SALESPERC, CUMULATIVEPERC, ABC)
    SELECT MTRL, MTRSUP, CODARTICOL, DENUMARTICOL, branch, totalSales, totalQty, salesPercentage, cumulativePercentage, abcClass
    FROM @abcResults ORDER BY salesPercentage DESC;

    -- Populate #SummaryRows
    WITH AbcSummary AS (
        SELECT abcClass, COUNT(*) AS ITEMCOUNT, SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS CLASSTOTAL
        FROM @abcResults GROUP BY abcClass
    ),
    TotalCounts AS (
        SELECT COUNT(*) AS totalItems, SUM(CASE WHEN totalSales > 0 THEN totalSales ELSE 0 END) AS grandTotal
        FROM @abcResults
    )
    INSERT INTO #SummaryRows (ABC, ITEMCOUNT, CLASSTOTAL, ITEMSPERC, VALUEPERC)
    SELECT ac.abcClass, ac.ITEMCOUNT, ac.CLASSTOTAL,
           (ac.ITEMCOUNT * 100.0 / NULLIF(tc.totalItems,0)),
           (ac.CLASSTOTAL * 100.0 / NULLIF(tc.grandTotal,0))
    FROM AbcSummary ac CROSS JOIN TotalCounts tc ORDER BY ac.abcClass;

    -- Prepare JSON output
    DECLARE @jsonOutput NVARCHAR(MAX);
    SET @jsonOutput = (
        SELECT 
            (SELECT * FROM #DetailedRows ORDER BY SALESPERC DESC FOR JSON PATH) AS DetailedRows,
            (SELECT * FROM #SummaryRows ORDER BY ABC FOR JSON PATH) AS SummaryRows,
            (SELECT SUM(CASE WHEN VALUE > 0 THEN VALUE ELSE 0 END) FROM #DetailedRows) AS TotalPositiveSales
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    SELECT @jsonOutput AS CombinedJsonOutput;

    DROP TABLE #DetailedRows;
    DROP TABLE #SummaryRows;
END;
GO

-- Combined JSON version for load saved data
CREATE OR ALTER PROCEDURE dbo.sp_LoadSavedAbcAnalysis_CombinedJson
    @branch VARCHAR(max) = ''
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Validate required parameters
    IF (@branch IS NULL OR LTRIM(RTRIM(@branch)) = '')
    BEGIN
        SELECT '{"error": "Branch parameter is required"}' AS CombinedJsonOutput;
        RETURN;
    END
    
    -- Parse the branch parameter
    DECLARE @branchId INT;
    SET @branchId = TRY_CAST(@branch AS INT);
    
    IF (@branchId IS NULL)
    BEGIN
        SELECT '{"error": "Invalid branch parameter"}' AS CombinedJsonOutput;
        RETURN;
    END
    
    -- Find the most recent saved analysis
    DECLARE @latestSummaryId INT;
    DECLARE @latestDate DATE;
    
    SELECT TOP 1 
        @latestSummaryId = CCCTOPABCSUMMARYID,
        @latestDate = DATACALCUL
    FROM CCCTOPABCSUMMARY 
    WHERE BRANCH = @branchId
        AND EXISTS (
            SELECT 1 FROM CCCTOPABC 
            WHERE CCCTOPABCSUMMARYID = CCCTOPABCSUMMARY.CCCTOPABCSUMMARYID 
            AND ABC IN ('A', 'B', 'C')
        )
    ORDER BY DATACALCUL DESC, CCCTOPABCSUMMARYID DESC;
    
    -- Check if we found any saved data
    IF (@latestSummaryId IS NULL)
    BEGIN
        SELECT '{"error": "No saved ABC analysis found for branch ' + @branch + '"}' AS CombinedJsonOutput;
        RETURN;
    END
    
    -- Create temp tables for JSON generation
    CREATE TABLE #DetailedRows (
        MTRL INT,
        MTRSUP INT,
        CODE VARCHAR(MAX),
        DESCRIPTION VARCHAR(MAX),
        BRANCH SMALLINT,
        VALUE FLOAT,
        SUMQTY FLOAT,
        SALESPERC FLOAT,
        CUMULATIVEPERC FLOAT,
        ABC CHAR(1)
    );

    CREATE TABLE #SummaryRows (
        ABC CHAR(1),
        ITEMCOUNT INT,
        CLASSTOTAL FLOAT,
        ITEMSPERC FLOAT,
        VALUEPERC FLOAT
    );
    
    -- Populate detailed rows from saved data
    INSERT INTO #DetailedRows (MTRL, MTRSUP, CODE, DESCRIPTION, BRANCH, VALUE, SUMQTY, SALESPERC, CUMULATIVEPERC, ABC)
    SELECT 
        d.MTRL,
        ISNULL(m.MTRSUP, 0) as MTRSUP,
        ISNULL(m.code, '') as CODE,
        ISNULL(m.name, '') as DESCRIPTION,
        d.BRANCH,
        ISNULL(d.VALUE, 0) as VALUE, -- Use saved VALUE data
        ISNULL(d.SUMQTY, 0) as SUMQTY, -- Use saved SUMQTY data
        ISNULL(d.SALESPERC, 0) as SALESPERC,
        ISNULL(d.CUMULATIVEPERC, 0) as CUMULATIVEPERC, -- Use saved CUMULATIVEPERC data
        ISNULL(d.ABC, '') as ABC
    FROM CCCTOPABC d
    LEFT JOIN MTRL m ON d.MTRL = m.MTRL AND m.SODTYPE = 51
    WHERE d.CCCTOPABCSUMMARYID = @latestSummaryId
        AND d.ABC IN ('A', 'B', 'C')
        AND d.BRANCH = @branchId
    ORDER BY d.SALESPERC DESC;
    
    -- Populate summary rows from saved data with calculated totals and percentages
    WITH SavedDataSummary AS (
        SELECT 
            ABC,
            COUNT(*) AS ITEMCOUNT,
            SUM(CASE WHEN VALUE > 0 THEN VALUE ELSE 0 END) AS CLASSTOTAL
        FROM #DetailedRows 
        WHERE ABC IN ('A', 'B', 'C')
        GROUP BY ABC
    ),
    TotalCounts AS (
        SELECT 
            SUM(ITEMCOUNT) AS totalItems,
            SUM(CLASSTOTAL) AS grandTotal
        FROM SavedDataSummary
    )
    INSERT INTO #SummaryRows (ABC, ITEMCOUNT, CLASSTOTAL, ITEMSPERC, VALUEPERC)
    SELECT 
        sds.ABC,
        sds.ITEMCOUNT,
        sds.CLASSTOTAL,
        (sds.ITEMCOUNT * 100.0 / NULLIF(tc.totalItems, 0)) AS ITEMSPERC,
        (sds.CLASSTOTAL * 100.0 / NULLIF(tc.grandTotal, 0)) AS VALUEPERC
    FROM SavedDataSummary sds 
    CROSS JOIN TotalCounts tc
    ORDER BY sds.ABC;
    
    -- Get period parameters from the summary record
    DECLARE @nrSaptVal INT, @modSucVal VARCHAR(10), @seriiExclVal VARCHAR(MAX);
    
    SELECT 
        @nrSaptVal = NRSAPT, 
        @modSucVal = MODSUC,
        @seriiExclVal = SERIIEXCL
    FROM CCCTOPABCSUMMARY 
    WHERE CCCTOPABCSUMMARYID = @latestSummaryId;

    -- Generate JSON using proper SQL Server JSON functions
    DECLARE @jsonOutput NVARCHAR(MAX);
    SET @jsonOutput = (
        SELECT 
            (SELECT * FROM #DetailedRows ORDER BY SALESPERC DESC FOR JSON PATH) AS DetailedRows,
            (SELECT * FROM #SummaryRows ORDER BY ABC FOR JSON PATH) AS SummaryRows,
            (SELECT SUM(CASE WHEN VALUE > 0 THEN VALUE ELSE 0 END) FROM #DetailedRows) AS TotalPositiveSales,
            (SELECT 
                CONVERT(VARCHAR, @latestDate, 23) AS Date,
                @branchId AS Branch,
                'Loaded from saved analysis' AS Message
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS LoadedAnalysis,
            (SELECT 
                CONVERT(VARCHAR, @latestDate, 23) AS dataReferinta,
                @nrSaptVal AS nrSaptamani,
                @modSucVal AS modFiltrareBranch,
                ISNULL(@seriiExclVal, '') AS seriesL
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS PeriodParameters
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    SELECT @jsonOutput AS CombinedJsonOutput;

    DROP TABLE #DetailedRows;
    DROP TABLE #SummaryRows;
END;
GO
create table CCCTOPABC (
    CCCTOPABCID INT IDENTITY(1,1) PRIMARY KEY,
    CCCTOPABCSUMMARYID INT,
    MTRL INT,
    BRANCH SMALLINT,
    SALESPERC FLOAT,
    CUMULATIVEPERC FLOAT,
    VALUE FLOAT,
    SUMQTY FLOAT,
    ABC CHAR(1),
    CONSTRAINT FK_CCCTOPABC_CCCTOPABCSUMMARY FOREIGN KEY (CCCTOPABCSUMMARYID) REFERENCES CCCTOPABCSUMMARY(CCCTOPABCSUMMARYID),
);
GO
--DATA	BRANCH	PERIOADA	NR SAPTAMANI	SELECTIE MOD.SUC	SERII EXCLUSE	A	B	C
CREATE TABLE CCCTOPABCSUMMARY (
    CCCTOPABCSUMMARYID INT IDENTITY(1,1) PRIMARY KEY,
    DATACALCUL DATE,
    BRANCH SMALLINT,
    NRSAPT INT,
    MODSUC VARCHAR(10),
    SERIIEXCL VARCHAR(MAX),
    A INT,
    B INT,
    C INT
);