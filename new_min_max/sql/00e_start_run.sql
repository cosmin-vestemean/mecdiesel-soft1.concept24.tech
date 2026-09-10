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
    @RunId INT = NULL OUTPUT,
    @BranchAssignmentMode VARCHAR(10) = NULL,
    @CalibrareMod VARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Scope = UPPER(LTRIM(RTRIM(COALESCE(@Scope, ''))));
    SET @BranchAssignmentMode = UPPER(LTRIM(RTRIM(COALESCE(@BranchAssignmentMode, ''))));
    SET @CalibrareMod = UPPER(LTRIM(RTRIM(COALESCE(@CalibrareMod, ''))));

    IF @BranchAssignmentMode = ''
        SELECT @BranchAssignmentMode = UPPER(LTRIM(RTRIM(PARAMVALUE)))
        FROM CCCMINMAXPARAMS
        WHERE PARAMKEY = 'MOD_ATRIBUIRE_FILIALA' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF @BranchAssignmentMode = '' OR @BranchAssignmentMode IS NULL
        SET @BranchAssignmentMode = 'CLIENT';

    IF @CalibrareMod = ''
        SELECT @CalibrareMod = UPPER(LTRIM(RTRIM(PARAMVALUE)))
        FROM CCCMINMAXPARAMS
        WHERE PARAMKEY = 'CALIBRARE_MOD' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF @CalibrareMod = '' OR @CalibrareMod IS NULL
        SET @CalibrareMod = 'C';

    IF @Scope NOT IN ('FULL', 'SKU', 'GROUP')
        THROW 50030, 'sp_MinMaxEngine_StartRun: @Scope must be FULL, SKU or GROUP.', 1;

    -- SCOPE separa testele de productie: fara el, un smoke test pe un
    -- singur articol devine "ultima rulare" pentru consumatori.
    IF @Scope = 'SKU' AND @Mtrl IS NULL
        THROW 50031, 'sp_MinMaxEngine_StartRun: @Scope = SKU requires @Mtrl.', 1;

    IF @Scope <> 'SKU' AND @Mtrl IS NOT NULL
        THROW 50032, 'sp_MinMaxEngine_StartRun: @Mtrl is only allowed when @Scope = SKU.', 1;

    IF @BranchAssignmentMode NOT IN ('DOC', 'AGENT', 'CLIENT')
        THROW 50052, 'sp_MinMaxEngine_StartRun: @BranchAssignmentMode must be DOC, AGENT or CLIENT.', 1;

    IF @CalibrareMod NOT IN ('A', 'B', 'C')
        THROW 50053, 'sp_MinMaxEngine_StartRun: @CalibrareMod must be A, B or C.', 1;

    -- P8 (defensiv): SIGMA_MIN absent/NULL -> 1.3, 0 explicit e valid
    -- (safety zero), negativ/nenumeric e o eroare de configurare, nu un
    -- fallback tacit. Aceeasi regula se reverifica in Classify/ClassifyGroup.
    DECLARE @SigmaMinRaw VARCHAR(255);
    DECLARE @SigmaMinCheck DECIMAL(28, 8);

    SELECT @SigmaMinRaw = PARAMVALUE
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'SIGMA_MIN' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF @SigmaMinRaw IS NOT NULL
    BEGIN
        SET @SigmaMinCheck = TRY_CONVERT(DECIMAL(28, 8), @SigmaMinRaw);
        IF @SigmaMinCheck IS NULL
            THROW 50054, 'sp_MinMaxEngine_StartRun: SIGMA_MIN must be numeric.', 1;
        IF @SigmaMinCheck < 0
            THROW 50055, 'sp_MinMaxEngine_StartRun: SIGMA_MIN must not be negative.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM CCCMINMAXPARAMOVERRIDE
        WHERE BRANCH > 0
            AND PREFIX = ''
            AND PARAMKEY IN ('LT_ZILE', 'FRECVENTA_ZILE')
            AND (TRY_CONVERT(INT, PARAMVALUE) IS NULL OR TRY_CONVERT(INT, PARAMVALUE) <= 0)
    )
        THROW 50056, 'sp_MinMaxEngine_StartRun: branch LT/FRECVENTA overrides must be positive integers.', 1;

    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM CCCMINMAXRUN WITH (UPDLOCK, HOLDLOCK)
        WHERE COMPANY = @Company
            AND SESSION_STATUS = 'OPEN'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50039, 'sp_MinMaxEngine_StartRun: a session is already OPEN for this company.', 1;
    END;

    INSERT INTO CCCMINMAXRUN (
        COMPANY, FAZA, STATUS, SESSION_STATUS, SCOPE, MTRL, STARTEDAT, CREATEDBY
    )
    VALUES (
        @Company, 'START', 'RUNNING', 'OPEN', @Scope, @Mtrl, GETDATE(), @CreatedBy
    );

    SET @RunId = CONVERT(INT, SCOPE_IDENTITY());

    -- Snapshot unic (CCCMINMAXRUNPARAM): copiaza valorile GLOBALe curente,
    -- apoi suprascrie MOD_ATRIBUIRE_FILIALA/CALIBRARE_MOD cu valorile
    -- rezolvate ale acestei rulari (pot veni din parametrul explicit al
    -- apelului, nu doar din CCCMINMAXPARAMS). BRANCH=0/PREFIX='' = GLOBAL;
    -- override-urile branch-only P6 sunt copiate separat mai jos.
    INSERT INTO CCCMINMAXRUNPARAM (RUNID, BRANCH, PREFIX, PARAMKEY, PARAMVALUE)
    SELECT @RunId, 0, '', p.PARAMKEY, p.PARAMVALUE
    FROM CCCMINMAXPARAMS p
    WHERE p.SCOPE = 'GLOBAL' AND p.SCOPEKEY = ''
        AND p.PARAMKEY NOT IN ('MOD_ATRIBUIRE_FILIALA', 'CALIBRARE_MOD');

    INSERT INTO CCCMINMAXRUNPARAM (RUNID, BRANCH, PREFIX, PARAMKEY, PARAMVALUE)
    VALUES
        (@RunId, 0, '', 'MOD_ATRIBUIRE_FILIALA', @BranchAssignmentMode),
        (@RunId, 0, '', 'CALIBRARE_MOD', @CalibrareMod);

    -- P6 etapa 1: ingheata numai override-urile per filiala. Randurile cu
    -- PREFIX nenul raman rezervate resolverului longest-prefix (N5).
    INSERT INTO CCCMINMAXRUNPARAM (RUNID, BRANCH, PREFIX, PARAMKEY, PARAMVALUE)
    SELECT @RunId, o.BRANCH, '', o.PARAMKEY, o.PARAMVALUE
    FROM CCCMINMAXPARAMOVERRIDE o
    WHERE o.BRANCH > 0
        AND o.PREFIX = ''
        AND o.PARAMKEY IN ('LT_ZILE', 'FRECVENTA_ZILE');

    COMMIT TRANSACTION;

    SELECT RUNID, COMPANY, SCOPE, SESSION_STATUS, MTRL,
        @BranchAssignmentMode AS MOD_ATRIBUIRE_FILIALA, @CalibrareMod AS CALIBRARE_MOD,
        STARTEDAT, CREATEDBY
    FROM CCCMINMAXRUN
    WHERE RUNID = @RunId;
END;
