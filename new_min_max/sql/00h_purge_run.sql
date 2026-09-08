-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - dbo.sp_MinMaxEngine_PurgeRun
-- Elibereaza memoria de lucru, dar pastreaza registrul RUN/GRP.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_PurgeRun
    @Company SMALLINT,
    @RunId INT,
    @BatchSize INT = 10000
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @SessionStatus VARCHAR(10);
    DECLARE @EsteCurent BIT;
    DECLARE @DeletedWeek INT = 0;
    DECLARE @DeletedWinsor INT = 0;
    DECLARE @DeletedDet INT = 0;
    DECLARE @Affected INT = 1;
    DECLARE @RetentionCount INT;

    IF NOT EXISTS (
        SELECT 1 FROM CCCMINMAXRUN WHERE RUNID = @RunId AND COMPANY = @Company
    )
        THROW 50041, 'sp_MinMaxEngine_PurgeRun: RUNID does not exist for this company.', 1;

    SELECT @SessionStatus = SESSION_STATUS,
           @EsteCurent = ESTE_CURENT
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId
        AND COMPANY = @Company;

    IF COALESCE(@EsteCurent, 0) = 1
        THROW 50042, 'sp_MinMaxEngine_PurgeRun: the current session cannot be purged.', 1;

    IF @SessionStatus = 'OPEN'
        THROW 50043, 'sp_MinMaxEngine_PurgeRun: an OPEN session cannot be purged.', 1;

    SELECT @RetentionCount = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'RETENTIE_DET_SESIUNI'
        AND SCOPE = 'GLOBAL'
        AND SCOPEKEY = '';

    IF COALESCE(@RetentionCount, 0) < 1 SET @RetentionCount = 2;

    IF @RunId IN (
        SELECT RUNID
        FROM (
            SELECT TOP (@RetentionCount) RUNID
            FROM CCCMINMAXRUN
            WHERE COMPANY = @Company
                AND SCOPE = 'FULL'
                AND SESSION_STATUS = 'DONE'
            ORDER BY RUNID DESC
        ) protected
    )
        THROW 50044, 'sp_MinMaxEngine_PurgeRun: RUNID is protected by RETENTIE_DET_SESIUNI.', 1;

    IF COALESCE(@BatchSize, 0) < 1 OR @BatchSize > 50000
        SET @BatchSize = 10000;

    SET @Affected = 1;
    WHILE @Affected > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM CCCMINMAXWEEK
        WHERE RUNID = @RunId;

        SET @Affected = @@ROWCOUNT;
        SET @DeletedWeek = @DeletedWeek + @Affected;
    END;

    SET @Affected = 1;
    WHILE @Affected > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM CCCMINMAXWINSOR
        WHERE RUNID = @RunId;

        SET @Affected = @@ROWCOUNT;
        SET @DeletedWinsor = @DeletedWinsor + @Affected;
    END;

    SET @Affected = 1;
    WHILE @Affected > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM CCCMINMAXDET
        WHERE RUNID = @RunId;

        SET @Affected = @@ROWCOUNT;
        SET @DeletedDet = @DeletedDet + @Affected;
    END;

    SELECT @RunId AS RUNID,
           @DeletedWeek AS DELETED_WEEK,
           @DeletedWinsor AS DELETED_WINSOR,
           @DeletedDet AS DELETED_DET;
END;