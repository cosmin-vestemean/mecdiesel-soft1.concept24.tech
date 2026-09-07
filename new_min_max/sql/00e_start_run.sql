-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — dbo.sp_MinMaxEngine_StartRun
-- Deschide o sesiune de calcul. Fazele (Classify / ClassifyGroup /
-- Compute) scriu numai intr-o sesiune OPEN; dupa FinishRun sesiunea
-- este imutabila. Recalcularea inseamna o sesiune noua, nu o rescriere.
-- ===================================================================

CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_StartRun
    @Company SMALLINT,
    @Scope VARCHAR(10) = 'FULL',
    @Mtrl INT = NULL,
    @CreatedBy INT = NULL,
    @RunId INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Scope = UPPER(LTRIM(RTRIM(COALESCE(@Scope, ''))));

    IF @Scope NOT IN ('FULL', 'SKU', 'GROUP')
        THROW 50030, 'sp_MinMaxEngine_StartRun: @Scope must be FULL, SKU or GROUP.', 1;

    -- SCOPE separa testele de productie: fara el, un smoke test pe un
    -- singur articol devine "ultima rulare" pentru consumatori.
    IF @Scope = 'SKU' AND @Mtrl IS NULL
        THROW 50031, 'sp_MinMaxEngine_StartRun: @Scope = SKU requires @Mtrl.', 1;

    IF @Scope <> 'SKU' AND @Mtrl IS NOT NULL
        THROW 50032, 'sp_MinMaxEngine_StartRun: @Mtrl is only allowed when @Scope = SKU.', 1;

    INSERT INTO CCCMINMAXRUN (
        COMPANY, FAZA, STATUS, SESSION_STATUS, SCOPE, MTRL, STARTEDAT, CREATEDBY
    )
    VALUES (
        @Company, 'START', 'RUNNING', 'OPEN', @Scope, @Mtrl, GETDATE(), @CreatedBy
    );

    SET @RunId = CONVERT(INT, SCOPE_IDENTITY());

    SELECT RUNID, COMPANY, SCOPE, SESSION_STATUS, MTRL, STARTEDAT, CREATEDBY
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId;
END;
