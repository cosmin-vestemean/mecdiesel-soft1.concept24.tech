-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - dbo.sp_MinMaxEngine_RunPhases
-- Runs under SQL Server Agent (no AJS 60s ADO CommandTimeout applies here).
-- Resolves the sole OPEN session for @Company, then executes
-- Classify -> ClassifyGroup -> Compute -> FinishRun sequentially. On error
-- the session stays OPEN; phase procedures already persist their own
-- STATUS/ERRORMSG-style columns, so the generic CATCH below only fills in
-- ERRORMSG when none of them got the chance to (e.g. FinishRun's own
-- precondition THROW, which never touches those columns itself).
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_RunPhases
    @Company SMALLINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RunId INT;
    DECLARE @OpenCount INT;

    SELECT @OpenCount = COUNT(*)
    FROM CCCMINMAXRUN
    WHERE COMPANY = @Company
        AND SESSION_STATUS = 'OPEN';

    IF @OpenCount = 0
        THROW 50047, 'sp_MinMaxEngine_RunPhases: no OPEN session exists for this company.', 1;

    IF @OpenCount > 1
        THROW 50047, 'sp_MinMaxEngine_RunPhases: more than one OPEN session exists for this company.', 1;

    SELECT @RunId = RUNID
    FROM CCCMINMAXRUN
    WHERE COMPANY = @Company
        AND SESSION_STATUS = 'OPEN';

    BEGIN TRY
        EXEC dbo.sp_MinMaxEngine_Classify @Company = @Company, @Persist = 1, @RunId = @RunId OUTPUT;
        EXEC dbo.sp_MinMaxEngine_ClassifyGroup @Company = @Company, @Persist = 1, @RunId = @RunId;
        EXEC dbo.sp_MinMaxEngine_Compute @Company = @Company, @RunId = @RunId, @Persist = 1;
        EXEC dbo.sp_MinMaxEngine_FinishRun @Company = @Company, @RunId = @RunId,
            @RequireCompute = 1, @RequireGroup = 1;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() = 0 AND EXISTS (
            SELECT 1 FROM CCCMINMAXRUN
            WHERE RUNID = @RunId
                AND SESSION_STATUS = 'OPEN'
                AND COALESCE(ERRORMSG, '') = ''
                AND COALESCE(COMPUTE_ERRORMSG, '') = ''
                AND COALESCE(GROUP_ERRORMSG, '') = ''
        )
        BEGIN
            UPDATE CCCMINMAXRUN
            SET ERRORMSG = LEFT(ERROR_MESSAGE(), 500)
            WHERE RUNID = @RunId
                AND SESSION_STATUS = 'OPEN';
        END;

        THROW;
    END CATCH;
END;
