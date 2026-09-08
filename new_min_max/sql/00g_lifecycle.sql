-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - lifecycle sesiuni
-- AbandonRun inchide explicit o sesiune OPEN esuata.
-- PurgeRun elibereaza memoria de lucru, dar pastreaza registrul RUN/GRP.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_AbandonRun
    @Company SMALLINT,
    @RunId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    UPDATE CCCMINMAXRUN
    SET SESSION_STATUS = 'ABANDONED',
        STATUS = CASE WHEN STATUS = 'RUNNING' THEN 'ERROR' ELSE STATUS END,
        FINISHEDAT = COALESCE(FINISHEDAT, GETDATE()),
        ERRORMSG = COALESCE(ERRORMSG, 'Session abandoned explicitly.')
    WHERE RUNID = @RunId
        AND COMPANY = @Company
        AND SESSION_STATUS = 'OPEN';

    IF @@ROWCOUNT = 0
        THROW 50040, 'sp_MinMaxEngine_AbandonRun: RUNID does not exist for this company or is not OPEN.', 1;

    SELECT RUNID, COMPANY, SESSION_STATUS, STATUS, FINISHEDAT, ERRORMSG
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId
        AND COMPANY = @Company;
END;