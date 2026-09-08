-- ===================================================================
-- MIN/MAX Engine v5 HYBRID - dbo.sp_MinMaxEngine_EnsureAgentJob
-- Idempotently creates OR aligns the fixed SQL Server Agent job that runs
-- dbo.sp_MinMaxEngine_RunPhases for one company: MEC_MinMaxEngine_RunPhases_<company>,
-- enabled, no schedule, local server, single TSQL step in the current DB.
-- No arbitrary caller-provided job names or SQL - everything here is fixed
-- shape, derived only from @Company.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_EnsureAgentJob
    @Company SMALLINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @JobName sysname = N'MEC_MinMaxEngine_RunPhases_' + CONVERT(NVARCHAR(10), @Company);
    DECLARE @DbName sysname = DB_NAME();
    DECLARE @Command NVARCHAR(MAX) = N'EXEC dbo.sp_MinMaxEngine_RunPhases @Company = '
        + CONVERT(NVARCHAR(10), @Company) + N';';
    DECLARE @Owner sysname = SUSER_SNAME(0x01);
    DECLARE @JobId UNIQUEIDENTIFIER;
    DECLARE @JobIsValid BIT = 0;

    SELECT @JobId = job_id FROM msdb.dbo.sysjobs WHERE name = @JobName;

    IF @JobId IS NOT NULL AND EXISTS (
        SELECT 1
        FROM msdb.dbo.sysjobs j
        INNER JOIN msdb.dbo.sysjobsteps s ON s.job_id = j.job_id
        INNER JOIN msdb.dbo.sysjobservers js ON js.job_id = j.job_id AND js.server_id = 0
        WHERE j.job_id = @JobId
            AND j.enabled = 1
            AND j.start_step_id = 1
            AND s.step_id = 1
            AND s.step_name = N'RunPhases'
            AND s.subsystem = N'TSQL'
            AND s.database_name = @DbName
            AND s.command = @Command
            AND s.on_success_action = 1
            AND s.on_fail_action = 2
            AND s.retry_attempts = 0
            AND (SELECT COUNT(*) FROM msdb.dbo.sysjobsteps sx WHERE sx.job_id = j.job_id) = 1
            AND NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobschedules sc WHERE sc.job_id = j.job_id)
    )
        SET @JobIsValid = 1;

    IF @JobIsValid = 1
    BEGIN
        SELECT @JobName AS JOB_NAME, @JobId AS JOB_ID;
        RETURN;
    END;

    IF @JobId IS NOT NULL AND EXISTS (
        SELECT 1
        FROM msdb.dbo.sysjobactivity
        WHERE job_id = @JobId
            AND session_id = (SELECT MAX(session_id) FROM msdb.dbo.syssessions)
            AND run_requested_date IS NOT NULL
            AND stop_execution_date IS NULL
    )
        THROW 50051, 'sp_MinMaxEngine_EnsureAgentJob: the Agent job is running and cannot be aligned by setup.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @JobId IS NOT NULL
        BEGIN
            EXEC msdb.dbo.sp_delete_job
                @job_id = @JobId,
                @delete_unused_schedule = 1;
        END;

        EXEC msdb.dbo.sp_add_job
            @job_name = @JobName,
            @enabled = 1,
            @description = N'MEC MIN/MAX engine phase runner for one company. No schedule; started explicitly via sp_start_job from AJS runPhases.',
            @owner_login_name = @Owner,
            @job_id = @JobId OUTPUT;

        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @JobId,
            @step_name = N'RunPhases',
            @subsystem = N'TSQL',
            @command = @Command,
            @database_name = @DbName,
            @on_success_action = 1,
            @on_fail_action = 2,
            @retry_attempts = 0,
            @step_id = 1;

        EXEC msdb.dbo.sp_update_job @job_id = @JobId, @start_step_id = 1;

        EXEC msdb.dbo.sp_add_jobserver
            @job_id = @JobId,
            @server_name = N'(LOCAL)';

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT @JobName AS JOB_NAME, @JobId AS JOB_ID;
END;
