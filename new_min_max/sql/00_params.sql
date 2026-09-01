-- MIN/MAX Engine v5 HYBRID — Faza 0: fundatia de parametri
-- Ruleaza in baza S1 (DUBHE ROMANIA SRL, company 1000).
-- Idempotent: DDL cu IF NOT EXISTS, seed care NU suprascrie valorile editate de utilizator.
-- Referinta: new_min_max/PLAN_IMPLEMENTARE.md sectiunea 2.

--=====================================================================
-- 1. CCCMINMAXPARAMS — parametri globali, cheie-valoare tipizata cu scope
--=====================================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CCCMINMAXPARAMS' AND xtype='U')
CREATE TABLE CCCMINMAXPARAMS (
    ID INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    PARAMKEY VARCHAR(50) NOT NULL,
    PARAMVALUE VARCHAR(255) NOT NULL,
    PARAMTYPE VARCHAR(10) NOT NULL,
    SCOPE VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    SCOPEKEY VARCHAR(50) NOT NULL DEFAULT '',
    DESCRIERE VARCHAR(255) NULL,
    UPDATEDAT DATETIME NULL DEFAULT GETDATE(),
    UPDATEDBY INT NULL,
    CONSTRAINT UQ_CCCMINMAXPARAMS UNIQUE (PARAMKEY, SCOPE, SCOPEKEY)
);

--=====================================================================
-- 2. CCCMINMAXCOV — matricea de acoperire COV_TGT (clasa x marime filiala)
--=====================================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CCCMINMAXCOV' AND xtype='U')
CREATE TABLE CCCMINMAXCOV (
    ID INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    CLASA VARCHAR(3) NOT NULL,
    MARIME VARCHAR(6) NOT NULL,
    COV FLOAT NOT NULL,
    UPDATEDAT DATETIME NULL DEFAULT GETDATE(),
    UPDATEDBY INT NULL,
    CONSTRAINT UQ_CCCMINMAXCOV UNIQUE (CLASA, MARIME)
);

--=====================================================================
-- 3. CCCMINMAXBRANCH — configurare filiale
--=====================================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CCCMINMAXBRANCH' AND xtype='U')
CREATE TABLE CCCMINMAXBRANCH (
    BRANCH SMALLINT NOT NULL PRIMARY KEY,
    MARIME VARCHAR(6) NOT NULL DEFAULT 'MIC',
    INCLUS BIT NOT NULL DEFAULT 1,
    ESTE_HQ BIT NOT NULL DEFAULT 0,
    ESTE_PODEA BIT NOT NULL DEFAULT 0,
    UPDATEDAT DATETIME NULL DEFAULT GETDATE(),
    UPDATEDBY INT NULL
);

--=====================================================================
-- 4. CCCMINMAXTEMPLATE — sabloane numite de parametri per prefix cod articol
--    (ecranul legacy "Scrie min MAX": Furnizor + "Cod, de la" + set parametri)
--=====================================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CCCMINMAXTEMPLATE' AND xtype='U')
CREATE TABLE CCCMINMAXTEMPLATE (
    TEMPLATEID INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    NUME VARCHAR(100) NOT NULL,
    PREFIX VARCHAR(50) NOT NULL,
    FURNIZOR INT NULL,
    PARAMSJSON NVARCHAR(MAX) NOT NULL,
    CREATEDBY INT NULL,
    CREATEDAT DATETIME NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_CCCMINMAXTEMPLATE UNIQUE (NUME)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CCCMINMAXTEMPLATE_PREFIX')
CREATE INDEX IX_CCCMINMAXTEMPLATE_PREFIX ON CCCMINMAXTEMPLATE(PREFIX);

--=====================================================================
-- 5. SEED — parametri globali
--    Insereaza doar cheile lipsa; valorile deja editate raman neatinse.
--=====================================================================

;WITH seed (PARAMKEY, PARAMVALUE, PARAMTYPE, SCOPE, SCOPEKEY, DESCRIERE) AS (
    SELECT * FROM (VALUES
        -- Formula bufferului
        ('SSF',                    '1.28',            'NUM',  'GLOBAL', '', 'Safety Stock Factor, flat pentru toate clasele (confirmat client 14.08.2026, L4)'),
        ('SIGMA_MIN',              '1.3',             'NUM',  'GLOBAL', '', 'Plancher pentru SIGMA_WK cand deviatia calculata este 0 (E3)'),
        ('SL_A',                   '95',              'NUM',  'GLOBAL', '', 'Service level clasa A, folosit in slts'),
        ('SL_B',                   '85',              'NUM',  'GLOBAL', '', 'Service level clasa B'),
        ('SL_C',                   '75',              'NUM',  'GLOBAL', '', 'Service level clasa C'),

        -- Pre-procesare
        ('WINSOR_PCT',             '0.95',            'NUM',  'GLOBAL', '', 'Percentila de winsorizare, aplicata per linie de vanzare'),
        ('WINSOR_MIN_LINII',       '8',               'NUM',  'GLOBAL', '', 'Prag de linii peste care se aplica winsorizarea p95'),
        ('WINSOR_SUB_PRAG',        'MEDIANA',         'STR',  'GLOBAL', '', 'Tratament SKU sub prag: NONE (spec) sau MEDIANA (plafon secundar) — E2'),
        ('NRSAPT',                 '52',              'NUM',  'GLOBAL', '', 'Fereastra de analiza, in saptamani'),

        -- Eligibilitate
        ('PRAG_REC_HQ',            '39',              'NUM',  'GLOBAL', '', 'Recenta maxima (saptamani fara vanzari) pentru STANDARD la HQ'),
        ('PRAG_REC_BR',            '26',              'NUM',  'GLOBAL', '', 'Recenta maxima pentru STANDARD la filiale (prag mai strict)'),

        -- Plafoane si reguli business
        ('INFLATIE_HQ',            '1.30',            'NUM',  'GLOBAL', '', 'Inflatie aplicata MAX_raw doar unde ESTE_HQ = 1'),
        ('HQ_CAP_FACTOR',          '1.5',             'NUM',  'GLOBAL', '', 'Plafon HQ raportat la suma ENG_MAX pe filiale'),
        ('CAP_LUNI',               '6',               'NUM',  'GLOBAL', '', 'Plafon de acoperire, in luni (CAP6)'),
        ('PROCENT_PODEA_BUC',      '0.30',            'NUM',  'GLOBAL', '', 'Procentul din ENG_MIN_HQ care devine podea pe filiala ESTE_PODEA'),
        ('CZ_CYCLE_ZERO',          '1',               'BOOL', 'GLOBAL', '', 'Clasa CZ are cycle = 0 strict, fara termenul ad x FRECVENTA (E7)'),

        -- Perimetru de date
        ('EXCLUDERI_CLIENTI',      'C.000003,MECDIS', 'LIST', 'GLOBAL', '', 'Coduri TRDR.CODE excluse (NU id-uri TRDR — codurile nu sunt unice). MECDI2 si INTE79 raman incluse'),
        ('EXCLUDERI_PREFIXE',      'DISC.,OTHER.',    'LIST', 'GLOBAL', '', 'Prefixe de cod articol excluse din calcul'),
        ('MOD_ATRIBUIRE_FILIALA',  'CLIENT',          'STR',  'GLOBAL', '', 'DOC (FINDOC.BRANCH) / AGENT (PRSN.BRANCH) / CLIENT (TRDBRANCH.BRANCH) — I7, de confirmat'),
        ('HQ_DIN_AGREGAT_COMPANIE','1',               'BOOL', 'GLOBAL', '', 'HQ se dimensioneaza pe vanzarile insumate ale filialelor; HQ nu are cerere proprie (I6)'),

        -- Scriere in ERP
        ('FLAGS_ZERO_LA_APPLY',    '1',               'BOOL', 'GLOBAL', '', 'Articolele cu LICHIDARE/BLOCAT/EXCLUDE se scriu cu MIN=MAX=0; in raport raman valorile calculate (E15)'),

        -- Fallback per prefix cod articol; randurile SCOPE='PREFIX' se adauga din UI
        ('LT_ZILE',                '30',              'NUM',  'GLOBAL', '', 'FALLBACK lead time (zile). De suprascris per prefix cod articol — valoare de confirmat cu clientul'),
        ('FRECVENTA_ZILE',         '14',              'NUM',  'GLOBAL', '', 'FALLBACK frecventa de comanda (zile). De suprascris per prefix cod articol — valoare de confirmat cu clientul')
    ) v (PARAMKEY, PARAMVALUE, PARAMTYPE, SCOPE, SCOPEKEY, DESCRIERE)
)
INSERT INTO CCCMINMAXPARAMS (PARAMKEY, PARAMVALUE, PARAMTYPE, SCOPE, SCOPEKEY, DESCRIERE)
SELECT s.PARAMKEY, s.PARAMVALUE, s.PARAMTYPE, s.SCOPE, s.SCOPEKEY, s.DESCRIERE
FROM seed s
WHERE NOT EXISTS (
    SELECT 1 FROM CCCMINMAXPARAMS p
    WHERE p.PARAMKEY = s.PARAMKEY AND p.SCOPE = s.SCOPE AND p.SCOPEKEY = s.SCOPEKEY
);

--=====================================================================
-- 6. SEED — matricea COV_TGT
--    MEDIU porneste egal cu MIC (fallback pana la completarea de catre client).
--=====================================================================

;WITH cov (CLASA, COV_MARE, COV_MIC) AS (
    SELECT * FROM (VALUES
        ('AX',  2.75, 1.25),
        ('AY',  2.50, 1.10),
        ('AZ',  2.00, 0.95),
        ('BX',  2.50, 1.25),
        ('BY',  2.00, 1.00),
        ('BZ',  1.75, 0.50),
        ('CX',  2.00, 0.75),
        ('CY',  1.50, 0.50),
        ('CZ',  0.00, 0.00),
        ('NOU', 0.75, 0.75)
    ) v (CLASA, COV_MARE, COV_MIC)
), expandat (CLASA, MARIME, COV) AS (
    SELECT CLASA, 'MARE',  COV_MARE FROM cov
    UNION ALL
    SELECT CLASA, 'MEDIU', COV_MIC  FROM cov
    UNION ALL
    SELECT CLASA, 'MIC',   COV_MIC  FROM cov
)
INSERT INTO CCCMINMAXCOV (CLASA, MARIME, COV)
SELECT e.CLASA, e.MARIME, e.COV
FROM expandat e
WHERE NOT EXISTS (
    SELECT 1 FROM CCCMINMAXCOV c
    WHERE c.CLASA = e.CLASA AND c.MARIME = e.MARIME
);

-- Clasa OD (ON DEMAND) nu primeste acoperire: MIN = MAX = BUY = 0.
INSERT INTO CCCMINMAXCOV (CLASA, MARIME, COV)
SELECT 'OD', m.MARIME, 0
FROM (VALUES ('MARE'), ('MEDIU'), ('MIC')) m (MARIME)
WHERE NOT EXISTS (SELECT 1 FROM CCCMINMAXCOV c WHERE c.CLASA = 'OD' AND c.MARIME = m.MARIME);

--=====================================================================
-- 7. SEED — configurare filiale
--    Cele 4 filiale cu INCLUS = 0 (ARAD 2300, VOLUNTARI 2400, MIHAILESTI 2600,
--    RM. VALCEA 2900) au WHOUSE.ISACTIVE = 0 — depozite inchise fizic, nu decizii
--    de business. BRANCH.ISACTIVE = 1 peste tot, dar nu exista depozit activ
--    in care sa se dimensioneze stocul. Sursa de adevar pentru motor este
--    WHOUSE.ISACTIVE = 1 AND CCCBRANCH IS NOT NULL, nu BRANCH.ISACTIVE.
--=====================================================================

;WITH br (BRANCH, MARIME, INCLUS, ESTE_HQ, ESTE_PODEA) AS (
    SELECT * FROM (VALUES
        (1000, 'MARE', 1, 1, 0),  -- HQ
        (1200, 'MARE', 1, 0, 0),  -- CLUJ
        (1300, 'MARE', 1, 0, 0),  -- CONSTANTA
        (1400, 'MARE', 1, 0, 0),  -- GALATI
        (1500, 'MIC',  1, 0, 0),  -- PLOIESTI
        (1600, 'MIC',  1, 0, 0),  -- IASI
        (1700, 'MIC',  1, 0, 0),  -- SIBIU
        (1800, 'MIC',  1, 0, 0),  -- CRAIOVA
        (1900, 'MIC',  1, 0, 0),  -- ORADEA
        (2000, 'MIC',  1, 0, 0),  -- PITESTI
        (2100, 'MIC',  1, 0, 0),  -- BRASOV
        (2200, 'MARE', 1, 0, 1),  -- BUCURESTI — tinta regulii de podea
        (2300, 'MIC',  0, 0, 0),  -- ARAD — WHOUSE inchis
        (2400, 'MIC',  0, 0, 0),  -- VOLUNTARI — WHOUSE inchis
        (2600, 'MIC',  0, 0, 0),  -- MIHAILESTI — WHOUSE inchis
        (2700, 'MIC',  1, 0, 0),  -- TG. MURES
        (2800, 'MARE', 1, 0, 0),  -- TIMISOARA
        (2900, 'MIC',  0, 0, 0)   -- RAMNICU VALCEA — WHOUSE inchis
    ) v (BRANCH, MARIME, INCLUS, ESTE_HQ, ESTE_PODEA)
)
INSERT INTO CCCMINMAXBRANCH (BRANCH, MARIME, INCLUS, ESTE_HQ, ESTE_PODEA)
SELECT b.BRANCH, b.MARIME, b.INCLUS, b.ESTE_HQ, b.ESTE_PODEA
FROM br b
WHERE NOT EXISTS (SELECT 1 FROM CCCMINMAXBRANCH x WHERE x.BRANCH = b.BRANCH);
