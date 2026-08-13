<!-- Slide number: 1 -->

45,848
MIN/MAX ENGINE v5 HYBRID
SKU în calcul
Specificații tehnice pentru implementare în ERP

14
Dubhe Romania SRL  ·  HQ + 13 Filiale  ·  45,848 SKU
Locații

17
Pași calcul

4
Reguli business
Versiunea curentă: run_minmax.py  ·  Iunie 2026

### Notes:

<!-- Slide number: 2 -->
Structura prezentării

01
Date de intrare

05
Parametri configurabili
Ce date trebuie să existe în ERP
LT, SSF, FRECVENTA, COV_TGT per furnizor

02
Eligibilitate & Clasificare

06
Output așteptat
STANDARD / NOU / ON DEMAND + ABC-XYZ
39 coloane per SKU, 16 sheet-uri

03
Formula MIN/MAX v5 HYBRID

07
Flags externe
Calculul pas cu pas
LICHIDARE / BLOCAT / EXCLUDE

04
Plafoane & Reguli Business

08
Arhitectura & Cerințe ERP
HQ CAP, Pack Rules, Buc 30%, flags
Flux date, frecvență, validare

### Notes:

<!-- Slide number: 3 -->
Date de intrare — Tranzacții & Stoc
01 · Tabelele necesare în ERP sau export

TRANZACȚII VÂNZĂRI

STOC & COMENZI

Data tranzacției
AZI = max(Data) — NU data sistemului!
SKU
Cheie unică

DATE

VARCHAR

Cod SKU
Cod produs unic
Stoc disponibil
Cantitate fizică disponibilă (STOC_QTY)

VARCHAR

INT

Cantitate
Include retururi (negative) — se face netting
Comenzi furnizor
ORD_FURN — pe drum, nerecepcionate

INT

INT

Valoare netă
RON fără TVA
Data ultimă recepție
LAST_RECEIPT — pentru DISC_FLAG

DECIMAL

DATE

Cod client
Excludem INTE79 (transfer intern HQ→filiale)
Cost mediu RON
COST_MED_RON

VARCHAR

DECIMAL

Branch
Locația vânzării — 13 filiale + HQ
Valoare stoc EUR
STOC_VAL_EUR

VARCHAR

DECIMAL
⚠ INTE79 = Dubhe S.R.L. (transfer intern HQ→filiale) = 57,285 buc, 7.1M RON — EXCLUS DIN CALCUL!

### Notes:

<!-- Slide number: 4 -->
Date de intrare — Parametri furnizori & ERP MIN/MAX
01 · Continuare

PARAMETRI FURNIZORI (per prefix SKU)

ERP MIN/MAX CURENT (referință comparație)

PREFIX
Primele caractere din cod SKU: "VL", "KNK", etc.
SKU / Cod
Cheie unică SKU

VARCHAR

VARCHAR

LT_zile
Lead Time în zile calendaristice (ex: 7, 14, 21, 30)
MIN_MANUAL
Min setat manual de PM

INT

INT

SSF
Safety Stock Factor — amplificator siguranță (1.28–1.65)
MAX_MANUAL
Max setat manual de PM

DECIMAL

INT

FRECVENTA_zile
Cât de des se face o comandă (ex: 7, 14, 30)
MIN_CALCULAT
Min calculat curent de ERP

INT

INT

COV_HQ
Coeficient acoperire HQ per clasă (AX=2.75 ... CZ=0)
MAX_CALCULAT
Max calculat curent de ERP

DECIMAL

INT

COV_BR
Coeficient acoperire filială per clasă
Filială
Locația — comparație per branch

DECIMAL

VARCHAR
ERP_MAX = max(MAX_MANUAL, MAX_CALCULAT) — Engine compară cu valoarea mai mare

### Notes:

<!-- Slide number: 5 -->
Eligibilitate SKU — 3 clase de ciclu de viață
02 · Pasul 4 — aplică netting înainte!

PRE-PROCESARE: Netting per (SKU, client, fereastră) → sum().clip(lower=0). AZI = max(Data vânzări) din fișier — NU data curentă sistem.

STANDARD

NOU / REACTIVAT

ON DEMAND

CONDIȚIE:
CONDIȚIE:
CONDIȚIE:
SAPT_VZ >= 3
AND SAPT_FARA <= 39
AND VZ_52S > 0
SAPT_8S >= 2
AND VZ_26S > 0
Restul
(nu îndeplinește
criteriile de sus)
Produs cu vânzări regulate. Calcul complet MIN/MAX.
VZ_52S > 0 obligatoriu — produse cu retururi care anulează net vânzările → ON DEMAND.
Produs nou introdus sau reactivat recent.
AVG simplificat: VZ_13S / 3. CLASA = "NOU" (nu ABC-XYZ).
Insuficient istoric. MIN = MAX = BUY_QTY = 0.
Rămâne în output cu fond gri. CLASA = "OD".
SAPT_VZ: săptămâni cu vânzări din 52
SAPT_8S: săptămâni cu vânzări din 8
~72% din SKU (33,223 din 45,848)

SAPT_FARA: săptămâni fără vânzări
VZ_26S: vânzări nete 26 săptămâni
Nu se setează niveluri automate

VZ_52S: vânzări nete ultimele 52 săptămâni
COV_TGT = 1.0 (mai conservator)
Se comandă doar la cerere client

### Notes:

<!-- Slide number: 6 -->
Clasificare ABC + XYZ → CLASA
02 · Pașii 5 & 6 — doar pentru SKU STANDARD

ABC — pe VAL_52S cumulativ (RON)

XYZ — CV real lunar, 12 buckets

Cumulativ: 0 – 80%
CV = StdDev(vânzări_lunare_12L) / Mean(vânzări_lunare_12L)
X: CV <= 0.5   cerere stabilă
Y: CV <= 1.0   cerere medie
Z: CV >  1.0   cerere volatilă

A

SL = 95%
Top produse — cheie

Cumulativ: 80 – 95%

B

SL = 85%

Forțat Z: lună dominantă > 60% VZ_52S, sau < 2 luni cu vânzări, sau NOU/OD
Produse medii
CLASA = concat(ABC, XYZ)  →  COV_TGT HQ

Cumulativ: 95 – 100%

C

SL = 75%

X (CV≤0.5)

Y (CV≤1.0)

Z (CV>1.0)
Rulaj mic

A

2.75

2.25

1.75

B

2.00

1.75

1.50

C

2.00

1.50

0
NOU/REACTIVAT → CLASA = "NOU"  |  ON DEMAND → CLASA = "OD"  (override ABC+XYZ)

### Notes:

<!-- Slide number: 7 -->
Formula MIN/MAX v5 HYBRID
03 · Calculul complet — HQ și filiale

Pasul 1 — AVG_POND (medie ponderată lunară)

STANDARD:     AVG = VZ_4S×0.30 + (VZ_13S/3)×0.40 + (VZ_26S/6)×0.15 + (VZ_52S/12)×0.15
NOU/REACTIV:  AVG = VZ_13S / 3

Pașii 2-3 — Componentele formulei

ad       = AVG / 30                                   (consum zilnic mediu)
safety   = (AVG × 0.30 / 30) × SSF × sqrt(LT)       (stoc siguranță; STD_L = AVG×30%)
lt_stock = ad × LT                                    (stoc pe lead time)
slts     = lt_stock × (100/SL - 1)                    (ajustare nivel serviciu)
buf      = safety + slts + lt_stock                   (buffer total)
cycle    = max(AVG × COV_TGT,  ad × FRECVENTA_zile)   (cantitate ciclu comandă)
MAX_raw  = ceil(buf + cycle)
MAX_inf  = ceil(MAX_raw × 1.30)                       ← INFLATIE HQ +30%  (HQ ONLY!)

Pasul 4 — 3 Plafoane obligatorii (se aplică simultan)

CAP6     = ceil(AVG × 6)                        (max 6 luni consum)
VZ26_CAP = VZ_26S  if VZ_26S > 0 else 9999      (realitate recentă)
ENG_MAX  = min(MAX_inf,  CAP6,  VZ26_CAP)       (MINIM DIN TOATE TREI!)
ENG_MIN  = min(max(ceil(buf), MIN_DOC),  ENG_MAX)
BUY_QTY  = max(0,  ENG_MAX - STOC_QTY - ORD_FURN)
SL: A=95%  B=85%  C=75%  |  HQ inflate ×1.30 — FILIALELE nu au inflație!

### Notes:

<!-- Slide number: 8 -->
Reguli Business Speciale
04 · HQ CAP · București 30% · Pack Rules · Flags

R1
HQ CAP — ENG_MAX(HQ) ≤ Σ ENG_MAX(filiale) × 1.5
HQ nu are vânzări proprii — este agregator pur. Formula supraevaluează HQ (inflate ×1.3 + formulă).
Cap-ul corectează. SKU cu SUM_BR_MAX=0 nu se capează (filialele nu au stoc → HQ comandă liber).
Rezultat: 4,208 SKU reduse din 45,848 (~9%)

IF ENG_MAX_HQ > SUM_BR_MAX × 1.5:
    ENG_MAX_HQ = ceil(SUM_BR_MAX × 1.5)

R2
BUCUREȘTI — min 30% din ENG_MIN(HQ)
Cea mai mare filială (~29,408 SKU activi). Garant că Buc are minim 30% din nivelul HQ.
SKU lipsă din Buc cu HQ ENG_MIN > 0 → adăugate automat la 30%.

IF ENG_MIN_BUC < ENG_MIN_HQ × 0.30:
    ENG_MIN_BUC = ceil(ENG_MIN_HQ × 0.30)

⚠ Re-aplicat după HQ CAP!

R3
Pack Rules — praguri minime per tip produs
DISC FRÂNĂ: rot. multiplu 2
BUCȘĂ / SILENTBLOC: min 4 buc
INJECTOR: 0 dacă MAX<3; altfel min 4
PISTON / CĂMAȘĂ: multiplu pack 4/6

### Notes:

<!-- Slide number: 9 -->
Parametri configurabili în ERP
05 · Per furnizor/prefix · Nu sunt hardcodați!

Tabel COV_TGT — acoperire țintă (luni) per CLASA
Parametri cheie per prefix furnizor

CLASA

COV_HQ

Semnificație

LT_zile

7 – 90

AX

2.75

Produs A stabil — stoc maxim
Lead Time zile calendaristice. Impact direct pe lt_stock și safety.

AY

2.25

Produs A medie

AZ

1.75

Produs A volatil

SSF

1.28 – 1.65

BX

2.00

Produs B stabil
Safety Stock Factor. Amplificator pentru stocul de siguranță.

BY

1.75

Produs B mediu

BZ

1.50

Produs B volatil

CX

2.00

Produs C stabil
FRECVENTA_zile

7 – 30

CY

1.50

Produs C mediu
Frecvența comenzii. Influențează componenta cycle din formulă.

CZ

0

NU se stochează!

NOU

1.00

Conservator — produs nou

SL_A / B / C

95/85/75%

OD

—

Min=Max=0
Service Level per clasă ABC. Influențează componenta slts.
Toți parametrii sunt citiți din fișierul parametri_furnizori.xlsx la fiecare rulare — NU hardcodați în engine!

### Notes:

<!-- Slide number: 10 -->
Flags externe — LICHIDARE · BLOCAT · EXCLUDE
07 · Din fișier extern, aplicate după calcul

IN LICHIDARE

BLOCAT LA FURNIZOR

EXCLUS DIN STATISTICI

EFECT:
EFECT:
EFECT:
BUY_QTY = 0
ENG_MIN = ENG_MAX = BUY = 0
ENG_MIN = ENG_MAX = BUY = 0
Produs în lichidare stoc. Engine calculează MIN/MAX ca referință dar comanda = 0. Scopul: epuizare stoc fără reaprovizionare.
Produs blocat de furnizor (discontinuat, fără stoc la sursă). Nu se calculează și nu se comandă. Poate fi temporar.
Exclus din engine (promo, sezonier forțat). Nu participă la calcul. Rămâne în output cu valori 0 pentru trasabilitate.

1,917 SKU  (run Iunie 2026)

7,813 SKU  (run Iunie 2026)

18,292 SKU  (run Iunie 2026)

LOGICĂ: flag din ERP SAU din fișier extern = setat. Fișier: LICHIDARE_EXCLUDERE_SI_BLOCARE.xlsx (~34K rânduri). Aplicat pe HQ + toate filialele după HQ CAP.

### Notes:

<!-- Slide number: 11 -->
Format output — 39 coloane, 16 sheet-uri
06 · minmax_union.xlsx

Sheet-uri output
39 coloane per SKU

HQ
45,848 SKU

CRAIOVA
~3,900

IDENTIFICARE

VÂNZĂRI

CLASIFICARE

SKU

VZ_52S

AVG_POND

BUCURESTI
~29,408

GALATI
~3,700

GRUPA

VZ_26S

ABC

DENUMIRE

VZ_13S

XYZ

FURNIZOR

VZ_4S

CLASA

ALBA
~4,200

IASI
~4,200

SAPT_VZ

LIFECYCLE

SAPT_12S

COV_TGT

ARAD
~4,100

ORADEA
~3,600

ULT_VANZ

SAPT_FARA

BACAU
~4,000

PITESTI
~3,800

ENGINE

VS ERP

STATUS & FLAGS

ENG_MIN

ERP_MIN_CALC

TREND

BRASOV
~4,500

PLOIESTI
~4,000

ENG_MAX

ERP_MAX_CALC

STATUS

STOC_QTY

ERP_MIN_MAN

STOC_VAL_EUR

CLUJ
~5,100

TIMISOARA
~4,100

ORD_FURN

ERP_MAX_MAN

COST_MED_RON

ACOP_CUR

FLAG

BUY_VALUE_RON

CONSTANTA
~3,800

SUMMARY
Statistici run

BUY_QTY

LAST_RECEIPT

DISC_FLAG

BLOCAT

EXCLUDE

IN LICHIDARE
Header row 0: titlu cu metadata run  |  Row 1: coloane  |  Row 2+: date  |  Total: ~16 MB

### Notes:

<!-- Slide number: 12 -->
Coloana FLAG & STATUS
06 · Comparație Engine vs ERP + trend vânzări

FLAG — raportul ENG_MAX / ERP_MAX
STATUS — trendul vânzărilor

0.77 – 1.30
Engine și ERP aliniate

Trend VZ_13S vs VZ_26S > +10%

✓ OK

ACTIVE

1.30 – 2.0
Engine recomandă mai mult (30–100%)

↑ ENG > ERP

Variație -10% până la +10%

STABLE

0.50 – 0.77
Engine recomandă mai puțin (23–50%)

↓ ENG < ERP

Scădere -30% până la -10%

TREND DOWN

> 2.0
Diferență majoră — analiză necesară!

⚠ ENG >> ERP

Scădere > 30% sau VZ_13S = 0

DECLINE

< 0.50
ERP mult mai mare — posibil suprastoc

⚠ ENG << ERP

LIFECYCLE = NOU/REACTIVAT

—
Lipsă parametri în ERP

ERP=0, ENG>0

NOU

—
ON DEMAND sau flag — ERP are valori vechi

ENG=0, ERP>0

DISC_FLAG — "DISCONTINUAT?"

—
OK — ON DEMAND confirmat sau exclus
Setat dacă (AZI - LAST_RECEIPT_DATE) > 365 zile.
Fundal portocaliu în Excel. Semnalizează produse fără recepție de peste 1 an — posibil discontinuate la furnizor.

AMBELE 0
ACOP_CUR = STOC_QTY / AVG_POND  (luni de acoperire cu stocul curent)

### Notes:

<!-- Slide number: 13 -->
Arhitectura & Cerințe de implementare ERP
08 · Flux date, frecvență rulare, validare

INPUT
ERP
STEP 1-3
Prep
STEP 4-9
Clasif.
STEP 10-14
Formulă
STEP 15-17
Output
OUTPUT
ERP

vanzari, stoc
min max, param
Netting, AZI
excluderi
Lifecycle,ABC
XYZ, CLASA
AVG, v5 HYBRID
Pack Rules
Flags, FLAG
DISC_FLAG
39col×14loc
~16MB

Frecvență & Date

Volume de procesat
• Săptămânal (recomandat: luni)
• Date fresh din ERP: minim 1×/săpt.
• AZI = max(Data) — NU data sistem
• Minim 52 săptămâni istorice
• 45,848 SKU × 14 locații
• Input: ~60-80 MB (xlsx)
• Output: ~16 MB
• Calcul: ~80s (Python curent)

Criterii acceptanță

Validare paralelă
• ENG_MAX = min(MAX_inf, CAP6, VZ26_CAP)
• Pack Rules re-aplicat după HQ CAP
• CLASA "NOU"/"OD" → override ABC+XYZ
• VZ_52S > 0 obligatoriu pt STANDARD
• Rulare paralelă 1-2 săpt: Python vs ERP
• Verificare FLAG: >80% trebuie ✓ OK
• Testare HQ CAP pe 4,208 SKU
• Verificare Pack Rules (DISC, BUCSA)
Performanță implementare Python curent: Etapa calc ~43s  |  Etapa write ~35s  |  Total ~80s

### Notes:

<!-- Slide number: 14 -->
Referință — Cei 17 pași ai calculului
03 · Referință completă implementare ERP

1
AZI
max(Data) din vânzări — NU data sistem

10
Formula
ad, safety, lt_stock, slts, buf, cycle

2
Ferestre
VZ_4S / 13S / 26S / 52S cu netting per SKU-client

11
Plafoane
min(MAX_inf, CAP6, VZ26_CAP) — toate trei!

3
Excluderi
Prefix DISC./OTHER., client INTE79

12
Pack Rules
DISC÷2, BUCSA≥4, INJECTOR, PISTON/CAMASA

4
Eligibil.
STANDARD / NOU/REACTIVAT / ON DEMAND

13
HQ CAP
ENG_MAX_HQ ≤ SUM_BR×1.5; re-apply pack!

5
ABC
Ranking cumulativ VAL_52S: A=80%, B=95%

14
Buc 30%
ENG_MIN_BUC ≥ ENG_MIN_HQ × 0.30

6
XYZ
CV real lunar 12L; forțat Z: sezon/NOU/< 2L

15
Flags ext.
LICHIDARE→BUY=0; BLOCAT/EXCLUDE→0

7
CLASA
concat(ABC,XYZ); override NOU→NOU, OD→OD

16
FLAG
ratio ENG/ERP: ✓OK / ↑↓ / ⚠ (5 categorii)

8
COV_TGT
Din tabel param (AX=2.75 ... CZ=0)

17
DISC_FLAG
(AZI-LAST_RECEIPT) > 365 → DISCONTINUAT?

9
AVG_POND
STD ponderare 30/40/15/15%; NOU=VZ_13S/3

### Notes:

<!-- Slide number: 15 -->
Rezultate run curent — Iunie 2026
v9 · baza calcul 11.06.2026 · AZI = 2026-05-29

45,848
12,502
123
33,223
SKU total HQ
STANDARD
NOU/REACTIVAT
ON DEMAND

4,208
1,917
7,813
18,292
Reduse de HQ CAP
În LICHIDARE
BLOCATE
EXCLUSE
Distribuție CLASA — eligibili STANDARD:

Modificări față de versiunea anterioară:

LEMA SSF: 1.28 → 1.65
OD
CZ
BZ
AZ
NOU

AX COV_HQ: 2.25 → 2.50

33,223
5,731
4,222
2,549
123
AZ COV_HQ: 1.50 → 1.75

72.5%
12.5%
9.2%
5.6%
0.3%
Engine v5 HYBRID · run_minmax.py · 7 bugs rezolvate · minmax_union_v9_1106.xlsx (16 MB)

### Notes:

<!-- Slide number: 16 -->

Întrebări & Pași următori
Script
run_minmax.py
Output
Confirmare specificații input/output cu echipa ERP

1
minmax_union.xlsx
Identificare tabele ERP: vânzări, stoc, parametri furnizori

2
Versiune
Mapare câmpuri ERP → 39 coloane output engine
v5 HYBRID

3
Planificare job-uri: calc săptămânal + write Excel/tabel

4
SKU
45,848 total
Validare: rulare paralelă Python vs ERP (1-2 săptămâni)

5
Locații
14 (HQ + 13)
Dubhe Romania SRL  ·  MIN/MAX Engine v5 HYBRID  ·  run_minmax.py  ·  Iunie 2026

### Notes: