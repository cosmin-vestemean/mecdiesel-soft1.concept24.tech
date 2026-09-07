# MIN/MAX Engine v5 — Întrebări deschise (business)

> Decizii de business neconfirmate încă de client. Fiecare rămâne aici până se închide; când se
> închide, mută rezumatul în `minmax-engine-model.md` sau `minmax-engine-formulas.md` și șterge de
> aici.

- **Șabloane de parametri.** Excelul `parametri_furnizori.xlsx` nu e o precondiție — una din trei
  căi de populare (Excel / UI manual / salvare ca șablon). Cheie agreată: un singur șablon per
  `(FURNIZOR, BRANCH, PREFIX)`. Gol de schemă: `CCCMINMAXTEMPLATE` are unicitate pe `NUME`, dar nu
  are coloană `BRANCH`. De decis: cum tratăm rândul HQ (branch 1000, nu e locație fizică) — șabloane
  proprii sau cădere pe `GLOBAL`. În afara iterației 1 a Fazei 5 (cere AJS nou + deploy).
- **`LT_ZILE`/`FRECVENTA_ZILE`** ar trebui să varieze per prefix, dar sunt citiți doar
  `SCOPE='GLOBAL'` (fallback marcat explicit în seed: 30 și 14, „de confirmat cu clientul").
  Consecință: calibrarea `FLAG` nu poate fi validată definitiv cât timp `LT` e presupus — intră
  liniar în `LT_STOCK` și sub radical în `SAFETY`. `CCCMINMAXDET` are deja `LT_ZILE`/`FRECVENTA_ZILE`
  per rând, deci urma de audit există; cablarea pe șabloane e aditivă.
- **D2a:** cele 25 linii `ORD_FURN` de pe depozitul 8002 „BONURI VALORICE" (`FPRMS 4500`, factură
  fără stoc) nu au `CCCBRANCH`. Azi incluse în rândul HQ, excluse de pe filiale. De decis dacă se
  exclud complet.
- **Filialele închise** (2300/2400/2600/2900) pierd 7,25 mil RON (5,7% valoare 52S) din ambele
  agregate. De decis: reatribuire către filiala care servește azi, sau măcar includere în agregatul
  de companie.
- **Faza 2b — agregare ABC pe grupă:** formula exactă rămâne de confirmat (§3.3.1). Implementarea
  curentă partiționează cumulativul pe `BRANCH`, ordonare secundară deterministă pe
  `MTRGROUP_CODE`.
- **`MOD_ATRIBUIRE_FILIALA`** (DOC/AGENT/CLIENT) — default `CLIENT`, schimbă ~35% din atribuirea de
  linii. Comparație cross-mode blocată cât timp `S1_WRITE_MODE=off` la nivel de proiect (mod
  `CLIENT` complet validat read-only).
- **`FLAGS_ZERO_LA_APPLY`** (E15) — spec zice informațional-only; default zerorește la scriere ERP.
- **`COV_MEDIU`** — fallback `MEDIU=MIC` până clientul completează (editabil în UI).
- **`CX=2.00 > BY=2.00`** — deliberat? Valorile din spec au fost păstrate ca atare.
- **σ_LT** (variabilitate lead-time, L1) absentă din formulă; disponibilitatea istoricului de
  recepții e necunoscută.
- **σ_WK pentru clasa NOU:** serie completă de 52 săptămâni vs. de la prima vânzare (E5) — default
  serie completă.
- **`00_params.sql` idempotency** — testat o singură dată pe tabele proaspete, de re-testat.
- **Faza 4 `applyToErp`:** contract închis (`FAZA4_CONTRACT.md`), amânat deliberat după Faza 5.
  `CCCMINMAXAPPLYRUN` propus acolo devine redundant sub modelul de sesiune — apply e încă o fază cu
  coloane `APPLY_*` pe antet, de actualizat la reluare.
