-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - dbo.sp_MinMaxEngine_PurgeRetention
-- Oldest-first retention executor: reads dbo.sp_MinMaxEngine_PurgeSelector,
-- picks up to @MaxRuns 'ELIGIBLE' RUNIDs (ascending, oldest first) and calls
-- ONLY dbo.sp_MinMaxEngine_PurgeRun for each - never a DELETE of its own,
-- never touches CCCMINMAXRUN/CCCMINMAXGRP/CCCMINMAXRUNPARAM. PurgeRun's own
-- guards (50042/50043/50044/50053) stay the final authority: a race that
-- changes a candidate's status between the selector read and the PurgeRun
-- call surfaces as a per-row error here, not as a thrown batch failure.
-- No transaction wraps the loop or the individual PurgeRun calls.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_PurgeRetention
    @Company SMALLINT,
    @MaxRuns INT = 2,
    @BatchSize INT = 10000
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF COALESCE(@MaxRuns, 0) < 1 OR @MaxRuns > 2 SET @MaxRuns = 2;
    IF COALESCE(@BatchSize, 0) < 1 OR @BatchSize > 50000 SET @BatchSize = 10000;

    CREATE TABLE #Selector (
        RUNID INT NOT NULL,
        SCOPE VARCHAR(10) NULL,
        SESSION_STATUS VARCHAR(10) NULL,
        ESTE_CURENT BIT NOT NULL,
        ESTE_REPER BIT NOT NULL,
        HAS_DET BIT NOT NULL,
        HAS_WEEK BIT NOT NULL,
        HAS_WINSOR BIT NOT NULL,
        HAS_SALES BIT NOT NULL,
        IS_RETENTION_PROTECTED BIT NOT NULL,
        PURGE_STATUS VARCHAR(20) NOT NULL
    );

    INSERT INTO #Selector (RUNID, SCOPE, SESSION_STATUS, ESTE_CURENT, ESTE_REPER, HAS_DET, HAS_WEEK, HAS_WINSOR, HAS_SALES, IS_RETENTION_PROTECTED, PURGE_STATUS)
    EXEC dbo.sp_MinMaxEngine_PurgeSelector @Company = @Company;

    DECLARE @Result TABLE (
        RUNID INT NOT NULL,
        DELETED_WEEK INT NULL,
        DELETED_WINSOR INT NULL,
        DELETED_DET INT NULL,
        DELETED_SALES INT NULL,
        ERRORMSG NVARCHAR(500) NULL
    );

    DECLARE @PurgeResult TABLE (RUNID INT, DELETED_WEEK INT, DELETED_WINSOR INT, DELETED_DET INT, DELETED_SALES INT);

    DECLARE @Counter INT = 0;
    DECLARE @RunId INT;

    WHILE @Counter < @MaxRuns
    BEGIN
        SET @RunId = NULL;

        SELECT TOP 1 @RunId = RUNID
        FROM #Selector
        WHERE PURGE_STATUS = 'ELIGIBLE'
            AND RUNID NOT IN (SELECT RUNID FROM @Result)
        ORDER BY RUNID ASC;

        IF @RunId IS NULL BREAK;

        DELETE FROM @PurgeResult;

        BEGIN TRY
            INSERT INTO @PurgeResult (RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES)
            EXEC dbo.sp_MinMaxEngine_PurgeRun @Company = @Company, @RunId = @RunId, @BatchSize = @BatchSize;

            INSERT INTO @Result (RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, ERRORMSG)
            SELECT RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, NULL FROM @PurgeResult;
        END TRY
        BEGIN CATCH
            DECLARE @PurgeError NVARCHAR(500) = LEFT(ERROR_MESSAGE(), 500);

            INSERT INTO @Result (RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, ERRORMSG)
            VALUES (@RunId, NULL, NULL, NULL, NULL, @PurgeError);

            RAISERROR(N'MIN/MAX retention purge failed for RUNID %d: %s', 10, 1, @RunId, @PurgeError);
        END CATCH;

        SET @Counter = @Counter + 1;
    END;

    DROP TABLE #Selector;

    SELECT RUNID, DELETED_WEEK, DELETED_WINSOR, DELETED_DET, DELETED_SALES, ERRORMSG
    FROM @Result
    ORDER BY RUNID ASC;
END;
