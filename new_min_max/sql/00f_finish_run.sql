-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — dbo.sp_MinMaxEngine_FinishRun
-- Inchide sesiunea si o face imutabila. Doar sesiunile FULL complete
-- devin referinta consumatorilor (ESTE_CURENT), ca "ultima rulare" sa
-- nu poata cadea pe un smoke test sau pe o sesiune partiala.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_FinishRun
    @Company SMALLINT,
    @RunId INT,
    @RequireCompute BIT = 1,
    @RequireGroup BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RunCompany SMALLINT;
    DECLARE @Scope VARCHAR(10);
    DECLARE @SessionStatus VARCHAR(10);
    DECLARE @ClassifyStatus VARCHAR(10);
    DECLARE @ComputeStatus VARCHAR(10);
    DECLARE @GroupStatus VARCHAR(10);

    SELECT @RunCompany = COMPANY,
           @Scope = SCOPE,
           @SessionStatus = SESSION_STATUS,
           @ClassifyStatus = STATUS,
           @ComputeStatus = COMPUTE_STATUS,
           @GroupStatus = GROUP_STATUS
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId;

    IF @RunCompany IS NULL
        THROW 50033, 'sp_MinMaxEngine_FinishRun: the requested RUNID does not exist.', 1;

    IF @RunCompany <> @Company
        THROW 50034, 'sp_MinMaxEngine_FinishRun: RUNID belongs to a different company.', 1;

    IF COALESCE(@SessionStatus, '') <> 'OPEN'
        THROW 50035, 'sp_MinMaxEngine_FinishRun: the session is not OPEN.', 1;

    IF COALESCE(@ClassifyStatus, '') <> 'DONE'
        THROW 50036, 'sp_MinMaxEngine_FinishRun: classification has not completed.', 1;

    IF @RequireCompute = 1 AND COALESCE(@ComputeStatus, '') <> 'DONE'
        THROW 50037, 'sp_MinMaxEngine_FinishRun: computation has not completed.', 1;

    IF @RequireGroup = 1 AND COALESCE(@GroupStatus, '') <> 'DONE'
        THROW 50038, 'sp_MinMaxEngine_FinishRun: group classification has not completed.', 1;

    UPDATE CCCMINMAXRUN
    SET SESSION_STATUS = 'DONE',
        FINISHEDAT = GETDATE(),
        DURATA_SEC = DATEDIFF(SECOND, STARTEDAT, GETDATE())
    WHERE RUNID = @RunId;

    IF @Scope = 'FULL'
    BEGIN
        UPDATE CCCMINMAXRUN
        SET ESTE_CURENT = 0
        WHERE COMPANY = @Company
            AND SCOPE = 'FULL'
            AND COALESCE(ESTE_CURENT, 0) = 1
            AND RUNID <> @RunId;

        UPDATE CCCMINMAXRUN
        SET ESTE_CURENT = 1
        WHERE RUNID = @RunId;
    END;

    SELECT RUNID, COMPANY, SCOPE, SESSION_STATUS, ESTE_CURENT,
           STATUS, COMPUTE_STATUS, GROUP_STATUS,
           AZI, NR_RANDURI, STARTEDAT, FINISHEDAT, DURATA_SEC
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId;
END;
