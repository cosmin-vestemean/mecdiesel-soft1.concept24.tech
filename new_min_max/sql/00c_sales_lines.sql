-- ===================================================================
-- MIN/MAX Engine v5 HYBRID — Faza 1a: dbo.ufn_MinMaxSalesLines
-- Linii de vanzare eligibile, cu atribuirea filialei conform MOD_ATRIBUIRE_FILIALA.
-- Fereastra este derivata din MAX(TRNDATE) pe date vii, deci populatia creste in cursul zilei.
-- ===================================================================

CREATE OR ALTER FUNCTION dbo.ufn_MinMaxSalesLines (@Company SMALLINT)
RETURNS @SalesLines TABLE (
    COMPANY SMALLINT NOT NULL,
    FINDOC INT NOT NULL,
    MTRTRN INT NOT NULL,
    LINENUM INT NOT NULL,
    TRNDATE DATETIME NOT NULL,
    AZI DATE NOT NULL,
    TRDR INT NOT NULL,
    TRDRCODE VARCHAR(30) NULL,
    MTRL INT NOT NULL,
    MTRSUP INT NULL,
    CODE VARCHAR(50) NOT NULL,
    BRANCH SMALLINT NULL,
    QTY DECIMAL(28, 8) NOT NULL,
    LTRNVAL DECIMAL(28, 8) NOT NULL
)
AS
BEGIN
    DECLARE @Azi DATE;
    DECLARE @ModAtribuire VARCHAR(10);
    DECLARE @ExcluderiClienti VARCHAR(MAX);
    DECLARE @ExcluderiPrefixe VARCHAR(MAX);
    DECLARE @NrSaptamani INT;

    -- ---------------------------------------------------------------
    -- 1. Citire parametri din CCCMINMAXPARAMS
    -- ---------------------------------------------------------------
    SELECT @ModAtribuire = UPPER(LTRIM(RTRIM(PARAMVALUE)))
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'MOD_ATRIBUIRE_FILIALA' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @ExcluderiClienti = PARAMVALUE
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'EXCLUDERI_CLIENTI' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @ExcluderiPrefixe = PARAMVALUE
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'EXCLUDERI_PREFIXE' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    SELECT @NrSaptamani = TRY_CONVERT(INT, PARAMVALUE)
    FROM CCCMINMAXPARAMS
    WHERE PARAMKEY = 'NRSAPT' AND SCOPE = 'GLOBAL' AND SCOPEKEY = '';

    IF @ModAtribuire NOT IN ('DOC', 'AGENT', 'CLIENT') OR @ModAtribuire IS NULL
        SET @ModAtribuire = 'CLIENT';
    SET @ExcluderiClienti = COALESCE(@ExcluderiClienti, '');
    SET @ExcluderiPrefixe = COALESCE(@ExcluderiPrefixe, '');
    IF COALESCE(@NrSaptamani, 0) <= 0 SET @NrSaptamani = 52;

    -- ---------------------------------------------------------------
    -- 2. Data de referinta = ultima vanzare eligibila
    -- ---------------------------------------------------------------
    SELECT @Azi = MAX(CONVERT(DATE, f.TRNDATE))
    FROM MTRTRN mt
    INNER JOIN FINDOC f
        ON f.COMPANY = mt.COMPANY AND f.FINDOC = mt.FINDOC AND f.SOSOURCE = mt.SOSOURCE
    INNER JOIN TPRMS tp
        ON tp.COMPANY = mt.COMPANY AND tp.SODTYPE = mt.SODTYPE AND tp.TPRMS = mt.TPRMS
    INNER JOIN MTRL m
        ON m.MTRL = mt.MTRL AND m.SODTYPE = mt.SODTYPE
    INNER JOIN TRDR customer
        ON customer.COMPANY = f.COMPANY AND customer.SODTYPE = 13 AND customer.TRDR = f.TRDR
    WHERE mt.COMPANY = @Company
        AND mt.SOSOURCE = 1351
        AND f.ISCANCEL = 0
        AND COALESCE(tp.FLG04, 0) = 1
        AND COALESCE(tp.FLG10, 0) = 1
        AND m.SODTYPE = 51
        AND m.MTRACN = 101
        AND mt.FPRMS NOT IN (1)
        AND NOT EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@ExcluderiClienti, ',') excludedCustomer
            WHERE LTRIM(RTRIM(excludedCustomer.value)) = customer.CODE
        )
        AND NOT EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@ExcluderiPrefixe, ',') excludedPrefix
            WHERE LTRIM(RTRIM(excludedPrefix.value)) <> ''
                AND m.CODE LIKE LTRIM(RTRIM(excludedPrefix.value)) + '%'
        );

    -- ---------------------------------------------------------------
    -- 3. Liniile din fereastra de NRSAPT saptamani
    -- ---------------------------------------------------------------
    INSERT INTO @SalesLines (
        COMPANY, FINDOC, MTRTRN, LINENUM, TRNDATE, AZI, TRDR, TRDRCODE,
        MTRL, MTRSUP, CODE, BRANCH, QTY, LTRNVAL
    )
    SELECT
        mt.COMPANY,
        mt.FINDOC,
        mt.MTRTRN,
        mt.LINENUM,
        f.TRNDATE,
        @Azi,
        f.TRDR,
        customer.CODE,
        mt.MTRL,
        m.MTRSUP,
        m.CODE,
        CASE @ModAtribuire
            WHEN 'DOC' THEN f.BRANCH
            WHEN 'AGENT' THEN agent.BRANCH
            ELSE COALESCE(customerBranch.BRANCH, f.BRANCH)
        END,
        CONVERT(DECIMAL(28, 8), COALESCE(mt.QTY1 / NULLIF(CONVERT(DECIMAL(28, 8), m.MU41), 0), 0)),
        CONVERT(DECIMAL(28, 8), COALESCE(mt.LTRNVAL, 0))
    FROM MTRTRN mt
    INNER JOIN FINDOC f
        ON f.COMPANY = mt.COMPANY AND f.FINDOC = mt.FINDOC AND f.SOSOURCE = mt.SOSOURCE
    INNER JOIN TPRMS tp
        ON tp.COMPANY = mt.COMPANY AND tp.SODTYPE = mt.SODTYPE AND tp.TPRMS = mt.TPRMS
    INNER JOIN MTRL m
        ON m.MTRL = mt.MTRL AND m.SODTYPE = mt.SODTYPE
    INNER JOIN TRDR customer
        ON customer.COMPANY = f.COMPANY AND customer.SODTYPE = 13 AND customer.TRDR = f.TRDR
    LEFT JOIN PRSN agent
        ON agent.COMPANY = f.COMPANY AND agent.PRSN = f.SALESMAN
    LEFT JOIN TRDBRANCH customerBranch
        ON customerBranch.COMPANY = f.COMPANY
        AND customerBranch.TRDR = f.TRDR
        AND customerBranch.SODTYPE = 13
        AND customerBranch.TRDBRANCH = f.TRDBRANCH
    WHERE mt.COMPANY = @Company
        AND mt.SOSOURCE = 1351
        AND f.ISCANCEL = 0
        AND COALESCE(tp.FLG04, 0) = 1
        AND COALESCE(tp.FLG10, 0) = 1
        AND m.SODTYPE = 51
        AND m.MTRACN = 101
        AND mt.FPRMS NOT IN (1)
        AND DATEDIFF(WEEK, f.TRNDATE, @Azi) >= 0
        AND DATEDIFF(WEEK, f.TRNDATE, @Azi) < @NrSaptamani
        AND NOT EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@ExcluderiClienti, ',') excludedCustomer
            WHERE LTRIM(RTRIM(excludedCustomer.value)) = customer.CODE
        )
        AND NOT EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@ExcluderiPrefixe, ',') excludedPrefix
            WHERE LTRIM(RTRIM(excludedPrefix.value)) <> ''
                AND m.CODE LIKE LTRIM(RTRIM(excludedPrefix.value)) + '%'
        );

    RETURN;
END;
