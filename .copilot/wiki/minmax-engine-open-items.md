# MIN/MAX Engine v5 — Întrebări deschise (business)

> Decizii de business neconfirmate încă de client. Fiecare rămâne aici până se închide; când se
> închide, mută rezumatul în `minmax-engine-model.md` sau `minmax-engine-formulas.md` și șterge de
> aici.

- **Șabloane de parametri.** Excelul `parametri_furnizori.xlsx` nu e o precondiție — una din trei
  căi de populare (Excel / UI manual / salvare ca șablon). Cheie agreată: un singur șablon per
  `(FURNIZOR, BRANCH, PREFIX)`. Gol de schemă: `CCCMINMAXTEMPLATE` are unicitate pe `NUME`, dar nu
  are coloană `BRANCH`. De decis: cum tratăm rândul HQ (branch 1000, nu e locație fizică) — șabloane
  proprii sau cădere pe `GLOBAL`. În afara iterației 1 a Fazei 5 (cere AJS nou + deploy).
- **`LT_ZILE`/`FRECVENTA_ZILE` per prefix:** override-ul per filială este implementat și validat
  live pe RUNID 9 prin `CCCMINMAXPARAMOVERRIDE`, snapshot și rezoluția `BRANCH > GLOBAL`. Rămâne blocată numai extensia
  `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`: lipsesc lista canonică N5, normalizarea și valorile
  DEFAULT (fallback-ul global este încă 30/14). `CCCMINMAXDET` păstrează valorile efective per rând.
- **D2a:** cele 25 linii `ORD_FURN` de pe depozitul 8002 „BONURI VALORICE" (`FPRMS 4500`, factură
  fără stoc) nu au `CCCBRANCH`. Azi incluse în rândul HQ, excluse de pe filiale. De decis dacă se
  exclud complet.
- **Filialele închise** (2300/2400/2600/2900) — **ÎNCHIS 08.09.2026, confirmat de beneficiar:**
  filialele inactive și cele cu depozite inactive **nu prezintă interes**. Cele 7,25 mil RON (5,7%
  valoare 52S) atribuite lor nu sunt o pierdere de corectat, ci o graniță de perimetru asumată;
  `INNER JOIN #ActiveBranches` din `sp_MinMaxEngine_Classify` este specificația, nu un defect.
  Consecința tehnică (`sp_MinMaxEngine_ClassifyGroup` construia `#ItemGroups` din `#SalesLines`
  nefiltrat, deci `NR_SKU_GRP` număra articole din afara perimetrului — 468/559 rânduri de grupă pe
  RUNID=5) a fost **remediată în Faza 6**: reverificarea invariantelor pe RUNID=7 (08.09.2026,
  `validate-minmax-invariants.cjs`) arată 0 abateri pe `NR_SKU_GRP`. Detalii în
  [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) Pasul 8.
- **Faza 2b — agregare ABC pe grupă:** formula exactă rămâne de confirmat (§3.3.1). Implementarea
  curentă partiționează cumulativul pe `BRANCH`, ordonare secundară deterministă pe
  `MTRGROUP_CODE`.
- **`MOD_ATRIBUIRE_FILIALA`** (DOC/AGENT/CLIENT) — selectorul este implementat per rulare, validat
  la `StartRun`, salvat în `CCCMINMAXRUNPARAM` și consumat de `Classify`/`ClassifyGroup`; rularea nouă de
  comparație cross-mode nu a fost încă executată. Default-ul rămâne `CLIENT`, cu impact estimat la
  ~35% din atribuirea liniilor.
- **`FLAGS_ZERO_LA_APPLY`** (E15) — spec zice informațional-only; default zerorește la scriere ERP.
- **`COV_MEDIU`** — fallback `MEDIU=MIC` până clientul completează (editabil în UI).
- **`CX=2.00 = BY=2.00 > BZ=1.75`** — comparația numerică este corectată; intenția matricei rămâne
  de confirmat.
- **σ_LT** (variabilitate lead-time, L1) absentă din formulă; disponibilitatea istoricului de
  recepții e necunoscută.
- **σ_WK pentru clasa NOU:** serie completă de 52 săptămâni vs. de la prima vânzare (E5) — default
  serie completă.
- **`00_params.sql` idempotency** — testat o singură dată pe tabele proaspete, de re-testat.
- **Faza 4 `applyToErp`:** contract închis (`FAZA4_CONTRACT.md`), amânat deliberat după Faza 5.
  `CCCMINMAXAPPLYRUN` propus acolo devine redundant sub modelul de sesiune — apply e încă o fază cu
  coloane `APPLY_*` pe antet, de actualizat la reluare.
