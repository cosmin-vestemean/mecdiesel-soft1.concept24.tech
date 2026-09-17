-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - dbo.sp_MinMaxEngine_PurgeSelector
-- Read-only classification of every CCCMINMAXRUN session for a company,
-- authoritative source for both the UI selector (via AJS purgeSelector)
-- and sp_MinMaxEngine_PurgeRetention's oldest-first candidate pick.
-- Never deletes anything; the only destructive predicate stays in
-- sp_MinMaxEngine_PurgeRun (50042/50043/50044/50053), which remains the
-- final authority even when PURGE_STATUS says ELIGIBLE.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_PurgeSelector
    @Company SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RetentionCount INT;

    SELECT @RetentionCount = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'RETENTIE_DET_SESIUNI'
        AND SCOPE = 'GLOBAL'
        AND SCOPEKEY = '';

    IF COALESCE(@RetentionCount, 0) < 1 SET @RetentionCount = 2;

    ;WITH Protected AS (
        SELECT TOP (@RetentionCount) RUNID
        FROM CCCMINMAXRUN
        WHERE COMPANY = @Company
            AND SCOPE = 'FULL'
            AND SESSION_STATUS = 'DONE'
        ORDER BY RUNID DESC
    )
    SELECT
        r.RUNID,
        r.SCOPE,
        r.SESSION_STATUS,
        COALESCE(r.ESTE_CURENT, 0) AS ESTE_CURENT,
        r.ESTE_REPER,
        CASE WHEN EXISTS (SELECT 1 FROM CCCMINMAXDET WHERE RUNID = r.RUNID) THEN 1 ELSE 0 END AS HAS_DET,
        CASE WHEN EXISTS (SELECT 1 FROM CCCMINMAXWEEK WHERE RUNID = r.RUNID) THEN 1 ELSE 0 END AS HAS_WEEK,
        CASE WHEN EXISTS (SELECT 1 FROM CCCMINMAXWINSOR WHERE RUNID = r.RUNID) THEN 1 ELSE 0 END AS HAS_WINSOR,
        CASE WHEN EXISTS (SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = r.RUNID) THEN 1 ELSE 0 END AS HAS_SALES,
        CASE WHEN p.RUNID IS NOT NULL THEN 1 ELSE 0 END AS IS_RETENTION_PROTECTED,
        CASE
            WHEN COALESCE(r.ESTE_CURENT, 0) = 1 THEN 'CURRENT'
            WHEN r.SESSION_STATUS = 'OPEN' THEN 'OPEN'
            WHEN r.ESTE_REPER = 1 THEN 'PINNED'
            WHEN p.RUNID IS NOT NULL THEN 'PROTECTED'
            WHEN r.SESSION_STATUS IN ('DONE', 'ABANDONED')
                AND NOT EXISTS (SELECT 1 FROM CCCMINMAXDET WHERE RUNID = r.RUNID)
                AND NOT EXISTS (SELECT 1 FROM CCCMINMAXWEEK WHERE RUNID = r.RUNID)
                AND NOT EXISTS (SELECT 1 FROM CCCMINMAXWINSOR WHERE RUNID = r.RUNID)
                AND NOT EXISTS (SELECT 1 FROM CCCMINMAXSALES WHERE RUNID = r.RUNID) THEN 'PURGED'
            WHEN r.SESSION_STATUS IN ('DONE', 'ABANDONED') THEN 'ELIGIBLE'
            ELSE 'OTHER'
        END AS PURGE_STATUS
    FROM CCCMINMAXRUN r
    LEFT JOIN Protected p ON p.RUNID = r.RUNID
    WHERE r.COMPANY = @Company
    ORDER BY r.RUNID ASC;
END;
