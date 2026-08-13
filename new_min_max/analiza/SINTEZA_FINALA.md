# MIN/MAX Engine v5 HYBRID — Sinteză Finală Consolidată

**Client:** Dubhe Romania SRL · HQ + filiale · 45.848 SKU
**Data compilare:** 21.07.2026 · **Ultima revizie:** 13.08.2026 (safety stock pe deviație reală — secțiunile 3.4 și 9.0)
**Surse consolidate:** [MinMax_ERP_Implementation.md](MinMax_ERP_Implementation.md) (prezentare inițială), [email_body.txt](email_body.txt), [sinteza_cerinte_clarificari.md](sinteza_cerinte_clarificari.md) (22.06.2026), [analiza_clarificari_primite.md](analiza_clarificari_primite.md) (21.07.2026 — răspuns client), [validare_teoretica_formula.md](validare_teoretica_formula.md), [evaluare_timesfm_tabfm.md](evaluare_timesfm_tabfm.md)
**Notă de metodologie:** documentul de mai jos reflectă **starea finală confirmată** de client (`Spec_ERP_MinMax_v5_FINAL.docx` + `Raspuns_Clarificari_MinMax.docx`). Valorile vechi/depășite din prezentarea inițială și din email sunt păstrate doar în secțiunea 8 (istoric) pentru trasabilitate.

---

## 1. Rezumat executiv

Obiectivul proiectului este implementarea în ERP a unui engine automat de calcul **MIN/MAX** bazat pe matricea **ABC + XYZ**, care înlocuiește calculul curent manual/simplu. Engine-ul calculează nivelurile MIN și MAX de stoc pentru fiecare SKU din fiecare locație (HQ + filiale), optimizând comenzile către furnizori — evitând suprastocul și rupturile de stoc.

Din procesul de clarificare cu clientul (2 runde: sinteză inițială 22.06.2026 → răspuns client 21.07.2026):

| Status | Puncte |
|---|---|
| ✅ Rezolvate | STANDARD/ON DEMAND (12.502 / 33.223), COV_HQ AX=2.75, ON DEMAND COV_TGT ambiguitate |
| 📋 Decizie client necesară | **Lista de filiale active** (blocaj #1), CX > BY (parametru), **`SSF` flat 1.28 vs. per clasă ABC** (item nou L4, 13.08.2026) |
| 💬 Clarificate (fără acțiune) | MIN_DOC, COV_BR, redundanța SAPT_VZ/SAPT_FARA, formula AVG_POND |
| 🔴 Corecții critice noi | Excluderea greșită a clientului `INTE79`; pas nou de **winsorizare p95**; **safety stock pe deviație REALĂ** (retractare proxy 30%, 13.08.2026) |
| 🔧 De aliniat | Nomenclatură versiune engine, decalaj date (rezolvat operațional) |

**Singurul blocaj real rămas deschis:** confirmarea listei finale de filiale active. Restul este rezolvat sau reprezintă decizii minore de parametru.

**Concluzie validare teoretică:** formula v5 HYBRID este conformă cu literatura academică (Reorder Point, Safety Stock, ABC-XYZ, EOQ) și compatibilă nativ cu ERP-uri enterprise (SAP, Dynamics 365, Oracle SCM). Trecerea la deviație standard reală (13.08.2026) închide singura abatere structurală față de formula clasică de safety stock.

**Concluzie evaluare ML (TimesFM/TabFM):** ambele sunt POC-uri utile doar ca instrumente auxiliare de benchmark/cold-start, nu justifică înlocuirea formulei actuale, care e deja transparentă și auditabilă.

---

## 2. Date de intrare necesare în ERP

| Tabel | Câmpuri cheie | Tip |
|---|---|---|
| Tranzacții vânzări | Data tranzacției (AZI = max(Data), NU data sistem), SKU, Cantitate (incl. retururi, netting), Valoare netă RON fără TVA, Cod client, Branch | DATE / VARCHAR / INT / DECIMAL |
| Stoc & comenzi | STOC_QTY (disponibil), ORD_FURN (pe drum, nerecepționate), LAST_RECEIPT (pentru DISC_FLAG), COST_MED_RON, STOC_VAL_EUR | INT / DATE / DECIMAL |
| Parametri furnizori (per prefix SKU) | LT_zile (7–90), SSF (**1.28 flat** — anterior 1.28–1.65), FRECVENTA_zile (7–30), COV_HQ, COV_BR | INT / DECIMAL |
| ERP MIN/MAX curent (referință) | MIN_MANUAL, MAX_MANUAL, MIN_CALCULAT, MAX_CALCULAT per SKU/branch | INT |
| Flags externe | LICHIDARE, BLOCAT, EXCLUDE — fișier `LICHIDARE_EXCLUDERE_SI_BLOCARE.xlsx` (~34K rânduri) | BOOL/FLAG |
| **🆕 Fișă articol — câmp `N_PACK`** | Multiplul de vânzare/ambalare al SKU-ului (unele articole se vând doar în grupuri de `n` bucăți). Completare manuală pe fișa articolului, cu **import Excel** pentru actualizare în masă (SKU + `n`). Default `n = 1` dacă necompletat. | INT |

> `ERP_MAX = max(MAX_MANUAL, MAX_CALCULAT)` — engine-ul compară mereu cu valoarea mai mare din ERP.

### 2.1 Excluderi obligatorii la procesare (CORECTATE — vezi secțiunea 8.1)

- Prefixe SKU: `DISC.` și `OTHER.`
- **🔧 Lista de clienți excluși devine parametru configurabil** (citit din tabelul de parametri, nu hardcodat în engine) — consistent cu principiul „nimic hardcodat" din cerințele tehnice (secțiunea 5).
  - Valoare implicită (default): `MECDIS` — client intern **Dubhe Italia** (nu Dubhe România).
  - Client intern `C.000003` (Dubhe S.R.L. / Dubhe România) — rămâne exclus, ca a doua intrare în listă.
  - Lista poate fi extinsă/editată ulterior de client fără modificarea codului engine-ului.
- ⚠️ Client `INTE79` este un **client extern real** — **NU se exclude** (corecție critică față de prezentarea inițială, care îl marca greșit ca transfer intern HQ→filiale de 57.285 buc / 7,1M RON).

---

## 3. Logica de calcul — pași

### 3.1 Pre-procesare

1. **AZI** = max(Data) din tranzacțiile de vânzări — **NU** data curentă a sistemului.
2. **Netting** per (SKU, client, fereastră): `sum().clip(lower=0)` — retururile se compensează, nu se contorizează separat.
3. Aplicarea excluderilor (secțiunea 2.1).
4. **🔴 Winsorizare p95 — tratamentul "tranzacțiilor bombă" (pas nou, obligatoriu)** — aplicată **după excluderi, înainte de calculul ferestrelor VZ**. O „tranzacție bombă" = linie de vânzare cu cantitate excepțional de mare provenită dintr-o comandă unică/de proiect (nu cerere recurentă), care ar umfla artificial media și deci MAX-ul:
   ```
   cap = quantile(Cantitate_SKU, 0.95)     # doar SKU cu ≥ 8 linii
   Cantitate = min(Cantitate, cap)          # doar liniile pozitive
   ```
   Scop: o comandă unică de proiect (ex. 180 buc la un client) nu trebuie să umfle media (AVG_POND) și deci MAX-ul → stoc mort. Nu modifică valoarea netă (ABC rămâne corect calculat pe valoare).
   **🔧 Pragul de winsorizare (percentila 0.95) devine parametru configurabil**, nu valoare fixă hardcodată — permite ajustare ulterioară per caz (ex. dacă p95 se dovedește prea agresiv/lax pentru anumite grupe de produs).
   ⚠️ **Dependență de ordine (13.08.2026):** acest pas este **prerechizit obligatoriu** pentru calculul lui `SIGMA_WK` (secțiunea 3.4), nu doar pentru ferestrele VZ. Deviația standard e pătratică în abateri, deci o singură tranzacție de proiect nefiltrată domină σ și umflă direct safety-ul. Ordinea corectă: **excluderi → winsorizare p95 → bucket-uri săptămânale → `SIGMA_WK` + ferestre VZ**.

### 3.2 Eligibilitate SKU — 3 clase de ciclu de viață

| Clasă | Condiție | SKU (run Iunie 2026) | Tratament |
|---|---|---|---|
| **STANDARD** | `SAPT_VZ ≥ 3 AND SAPT_FARA ≤ 39 AND VZ_52S > 0` | 12.502 (~27%) | Calcul complet MIN/MAX |
| **NOU/REACTIVAT** | `SAPT_8S ≥ 2 AND VZ_26S > 0` | 123 (0.3%) | `AVG = VZ_13S/3`, COV_TGT = 1.0 (conservator) |
| **ON DEMAND** | Restul (nu îndeplinește criteriile de mai sus) | 33.223 (~72%) | MIN = MAX = BUY_QTY = 0 |

- `VZ_52S > 0` obligatoriu pentru STANDARD — produsele cu retururi ce anulează net vânzările devin ON DEMAND.
- **SAPT_VZ** (frecvență = săptămâni distincte cu vânzări) și **SAPT_FARA** (recență = de la ultima vânzare) **nu sunt redundante**, deși însumate dau 52: un SKU cu vânzări grupate acum 45 săptămâni trece `SAPT_VZ≥3` dar pică `SAPT_FARA≤39`.
- ON DEMAND rămâne în output cu fond gri, `CLASA = "OD"`, nu se setează niveluri automate — se comandă doar la cererea clientului.

### 3.3 Clasificare ABC + XYZ (doar SKU STANDARD)

- **ABC** — cumulativ pe `VAL_52S` (RON): A = 0–80%, B = 80–95%, C = 95–100%. **Calculat în interiorul fiecărei grupe de produs (GRUPA), nu global.**
- **XYZ** — Coefficient of Variation (CV) pe vânzări lunare, 12 buckets: `CV = StdDev(vânzări_lunare_12L) / Mean(vânzări_lunare_12L)`. X ≤ 0.5 (stabil), Y ≤ 1.0 (mediu), Z > 1.0 (volatil).
- **Forțat Z** dacă: lună dominantă > 60% din VZ_52S, sau < 2 luni cu vânzări, sau clasă NOU/OD.
- `CLASA = concat(ABC, XYZ)` → determină COV_TGT.
- Override: NOU/REACTIVAT → `CLASA = "NOU"`; ON DEMAND → `CLASA = "OD"`.

### 3.3.1 Două niveluri de clasificare ABC-XYZ (clarificare 21.07.2026)

Se confirmă că există **două calcule ABC-XYZ distincte, cu scopuri diferite**:

1. **ABC-XYZ curent (per articol/SKU, per branch)** — cel descris în secțiunea 3.3, calculat per SKU în interiorul fiecărei grupe de produs. Acesta este cel care alimentează direct **formula MIN/MAX** (secțiunea 3.4) prin `COV_TGT`.
2. **🆕 ABC-XYZ nou, per grupă de produs (per branch) — pentru calculul Branch Replenishment.** Metodă separată, la o granularitate mai agregată: clasificarea ABC-XYZ se calculează **per „grupă" de produs** (câmpul confirmat: **`mtrl.mtrgroup`**) **per sucursală**, nu per SKU individual. Rezultatul (încadrarea A/B/C × X/Y/Z a grupei în sucursala respectivă) este consumat de un calcul distinct de **Branch Replenishment** (realocare/completare stoc între filiale), separat de engine-ul MIN/MAX per SKU.

**Implicații:**
- Confirmă și clarifică definiția câmpului `GRUPA` semnalată ca ambiguă în secțiunea 3.3 — este `mtrl.mtrgroup` (câmp standard din tabela de articole ERP).
- Cele două clasificări **nu trebuie confundate**: ABC-XYZ per SKU (secțiunea 3.3) rămâne neschimbată pentru MIN/MAX; ABC-XYZ per grupă/sucursală e un calcul suplimentar, cu output separat, dedicat Branch Replenishment.
- **De clarificat cu clientul:** formula exactă de agregare pentru ABC-XYZ per grupă (ex. cumulativ pe valoarea grupei per sucursală, analog secțiunii 3.3 dar la nivel de grupă) și cum se integrează output-ul Branch Replenishment cu `minmax_union.xlsx` (fișier/sheet separat sau coloane suplimentare).

### 3.4 Formula MIN/MAX v5 HYBRID


**Pasul 1 — AVG_POND (medie ponderată lunară):**
```
STANDARD:     AVG = VZ_4S×0.30 + (VZ_13S/3)×0.40 + (VZ_26S/6)×0.15 + (VZ_52S/12)×0.15
NOU/REACTIV:  AVG = VZ_13S / 3
```

**Pașii 2-3 — Componentele formulei:**
```
ad       = AVG / 30                                   (consum zilnic mediu)
SIGMA_WK = STDEV.S(vânzări_săptămânale[52])           (deviație REALĂ; zerourile incluse, date winsorizate p95)
safety   = SIGMA_WK × SSF × sqrt(LT/7)                (stoc siguranță; SSF = 1.28 flat, LT convertit în săptămâni)
lt_stock = ad × LT                                    (stoc pe lead time)
slts     = lt_stock × (100/SL - 1)                    (ajustare nivel serviciu)
buf      = safety + slts + lt_stock                   (buffer total)
cycle    = max(AVG × COV_TGT,  ad × FRECVENTA_zile)   (cantitate ciclu comandă)
MAX_raw  = ceil(buf + cycle)
MAX_inf  = ceil(MAX_raw × 1.30)                       ← INFLAȚIE HQ +30% (HQ ONLY! filialele NU)
```

**🔴 Modificare 13.08.2026 — safety stock pe deviație REALĂ (retractare a proxy-ului de 30%).** Propunerea anterioară folosea un proxy `STD_L = AVG × 0.30` (30% standard din medie). La sugestia echipei din Italia, deviația se **calculează real** din datele istorice:

| Element | Valoare veche (retrasă) | Valoare nouă (confirmată) |
|---|---|---|
| Estimator σ | `AVG × 0.30 / 30` (proxy, unitate zilnică) | `SIGMA_WK = STDEV.S(vânzări_săptămânale[52])` (calculat, unitate săptămânală) |
| Factor lead time | `sqrt(LT)` — LT în zile | `sqrt(LT/7)` — LT convertit în săptămâni, consistent cu unitatea lui σ |
| SSF | parametru per prefix furnizor, 1.28–1.65 | **1.28 flat** pentru toate SKU-urile |

Reguli de calcul pentru `SIGMA_WK`:
- Se folosesc cele **52 de bucket-uri săptămânale** din fereastra de un an, **inclusiv săptămânile cu 0 vânzări** — esențial pentru cererea sporadică (excluderea zerourilor ar subestima masiv variabilitatea).
- Se calculează pe **datele winsorizate p95** (secțiunea 3.1), nu pe cele brute — altfel „tranzacțiile bombă" umflă direct σ și, prin el, safety-ul.
- `STDEV.S` = deviație standard **de eșantion** (numitor `n−1`), nu de populație.
- Diferențierea pe nivel de serviciu per clasă ABC rămâne asigurată exclusiv de componenta `slts` (SL = 95/85/75%), pentru că SSF nu mai variază.

⚠️ **Impact de urmărit la validare:** înlocuirea proxy-ului cu σ real schimbă semnificativ safety-ul, în ambele sensuri — crește pentru SKU volatile (clasele Z, cerere intermitentă cu σ real ≫ 30% din medie) și scade pentru SKU stabile (clasele X). Trebuie recalibrat criteriul de acceptanță „>80% SKU cu FLAG = ✓ OK" (secțiunea 5) pe rularea paralelă.

**Pasul 4 — 3 plafoane obligatorii, aplicate simultan:**
```
CAP6     = ceil(AVG × 6)                        (max 6 luni consum)
VZ26_CAP = VZ_26S  if VZ_26S > 0 else 9999      (realitate recentă)
ENG_MAX  = min(MAX_inf,  CAP6,  VZ26_CAP)       (minim din toate trei!)
ENG_MIN  = min(max(ceil(buf), MIN_DOC),  ENG_MAX)
BUY_QTY  = max(0,  ENG_MAX - STOC_QTY - ORD_FURN)
```

- **Service Level (SL):** A = 95%, B = 85%, C = 75%. Singurul mecanism de diferențiere pe clasă ABC în `buf`, după trecerea SSF la valoare flat.
- **SSF = 1.28 flat** (≈ z-score pentru 90% SL) — nu mai este parametru variabil per prefix furnizor. Rămâne totuși citit din tabelul de parametri (valoare implicită 1.28), pentru a permite ajustare fără modificarea codului.
- **MIN_DOC** = cea mai mică cantitate de vânzare a SKU-ului din ultimele 52 săptămâni (unitate minimă tipică de livrare), default 1 — calculat din vânzări, nu e un parametru ERP separat.

### 3.5 Reguli business speciale

| Regulă | Logică | SKU afectați |
|---|---|---|
| **HQ CAP** | `IF ENG_MAX_HQ > SUM_BR_MAX × 1.5 → ENG_MAX_HQ = ceil(SUM_BR_MAX × 1.5)`. HQ e agregator pur (fără vânzări proprii); formula supraevaluează HQ (inflație ×1.3 + formulă). SKU cu `SUM_BR_MAX = 0` nu se capează. | ~4.208 (~9%) |
| **București — podea (floor) min. % din HQ** | Vezi mecanism detaliat în secțiunea 3.5.2 — generalizare a regulii „30%" ca „procent de podea" parametrizabil. | Re-aplicat după HQ CAP |
| **Pack Rules** | DISC FRÂNĂ: rotund la multiplu de 2; BUCȘĂ/SILENTBLOC: minim 4 buc; INJECTOR: 0 dacă MAX<3, altfel minim 4; PISTON/CĂMAȘĂ: multiplu pack 4/6. Re-aplicat după HQ CAP. | — |

### 3.5.2 Regula „podea" (floor) pentru București — clarificare secvență și logică (21.07.2026)

Regula „București 30%" (documentată anterior) este confirmată și clarificată ca o **„podea" (floor)**: un procent minim parametrizabil pe care Bucureștiul trebuie să îl absoarbă din nivelul HQ, aplicat **numai la finalul calculului**, după ce HQ și toate filialele au fost deja calculate independent.

**Secvența de calcul:**
1. Se calculează întâi **HQ** (formula v5 HYBRID + HQ CAP, secțiunea 3.4/3.5).
2. Se calculează apoi **toate filialele** (inclusiv București), independent, cu propria formulă.
3. **La final**, se aplică podeaua pe București:

```
procent_podea  = parametru configurabil (ex. 30% — valoare implicită actuală)

IF SKU există pe HQ (ENG_MIN_HQ > 0):

    IF SKU NU există în București (cod lipsă):
        → se introduce automat codul în București,
          cu ENG_MIN_BUC = ceil(ENG_MIN_HQ × procent_podea)

    ELSE (SKU există deja în București, cu ENG_MIN_BUC calculat independent):
        IF ENG_MIN_BUC ≥ ENG_MIN_HQ × procent_podea:
            → nu se modifică nimic (Bucureștiul e deja peste podea)
        ELSE (ENG_MIN_BUC < ENG_MIN_HQ × procent_podea):
            → ENG_MIN_BUC = ceil(ENG_MIN_HQ × procent_podea)
```

**Puncte cheie:**
- **`procent_podea` devine parametru configurabil** (nu hardcodat la 30%) — consistent cu principiul general de parametrizare (excluderi clienți, N_PACK, mărime filială, indice buffer HQ).
- Podeaua **nu scade niciodată** o valoare calculată independent pentru București — doar o ridică dacă e sub prag, sau adaugă codul lipsă direct la nivelul podelei.
- **Re-aplicată după HQ CAP** — folosește valoarea HQ deja capată (nu valoarea brută dinaintea capării).
- ⚠️ Presupune că Bucureștiul rămâne cea mai mare filială — de revizuit dacă se activează filiale mari noi (secțiunea 6).


### 3.5.1 Pack Rules — generalizare via câmpul `N_PACK` (decizie 21.07.2026)

Regulile de mai sus (DISC FRÂNĂ, BUCȘĂ/SILENTBLOC, INJECTOR, PISTON/CĂMAȘĂ) erau **hardcodate pe categorie de produs** — nu scalează la alte tipuri de articole care se vând tot în grupuri fixe. Decizie nouă: se generalizează mecanismul printr-un câmp configurabil per SKU:

- **Câmp nou `N_PACK`** pe fișa articolului (secțiunea 2) — multiplul de vânzare/ambalare (`n`). Completare **manuală**, cu **import Excel** pentru actualizare în masă (fișier cu coloane `SKU`, `N_PACK`).
- **Aplicare în formulă:** `BUY_QTY` (și, unde e cazul, `ENG_MIN`/`ENG_MAX`) se rotunjesc în sus la cel mai apropiat multiplu de `N_PACK`: `BUY_QTY_final = ceil(BUY_QTY / N_PACK) × N_PACK`.
- **Default:** `N_PACK = 1` pentru SKU-urile necompletate — comportament identic cu engine-ul actual (fără rotunjire).
- **Relație cu Pack Rules existente:** categoriile hardcodate (DISC ÷2, BUCȘĂ ≥4 etc.) devin **valori implicite sugerate** pentru `N_PACK`, dar clientul poate suprascrie manual sau prin import Excel per SKU, fără modificarea codului engine-ului — consistent cu principiul „nimic hardcodat" (secțiunea 5).
- **De confirmat cu clientul:** dacă `N_PACK` înlocuiește complet Pack Rules-urile hardcodate pe categorie, sau coexistă (ex. regula INJECTOR „0 dacă MAX<3" rămâne o excepție separată, necapturată doar de multiplu).

### 3.6 Parametri de coverage — tabele confirmate (versiune finală)

**🔧 Decizie nouă (21.07.2026) — clasificare filiale pe mărime.** Separarea binară HQ/filiale (COV_HQ vs. COV_BR) este înlocuită de o clasificare pe 3 niveluri la nivel de filială: câmp nou `MARIME_FILIALA` ∈ {**MARE**, **MEDIU**, **MIC**}, completat per filială, cu un tabel de coeficienți de acoperire distinct pentru fiecare nivel. Vezi tabelul unificat și secțiunea 3.6.1 pentru detalii și itemi deschiși.

**Tabel COV_HQ** (schimbări față de prezentarea inițială marcate ⚠️ — vezi secțiunea 8.2 pentru valorile vechi):

| Clasă | COV_HQ |
|---|---|
| AX | 2.75 |
| AY | 2.50 |
| AZ | 2.00 |
| BX | 2.50 |
| BY | 2.00 |
| BZ | 1.75 |
| CX | 2.00 |
| CY | 1.50 |
| CZ | 0 |
| NOU | 0.75 |

**Tabel COV_BR** (nou — coeficient de acoperire pentru filiale, nu exista în prezentarea inițială):

| Clasă | COV_BR |
|---|---|
| AX | 1.25 |
| AY | 1.10 |
| AZ | 0.95 |
| BX | 1.25 |
| BY | 1.00 |
| BZ | 0.50 |
| CX | 0.75 |
| CY | 0.50 |
| CZ | 0 |
| NOU | 0.75 |

**Alocare filiale → tabel de coeficienți:** HQ + filialele mari (București, Galați, Constanța, Timișoara, Cluj) → `COV_HQ`; restul filialelor → `COV_BR`.

**Alți parametri per prefix furnizor:** `LT_zile` (7–90), `SSF` = **1.28 flat** (nu mai variază per furnizor — vezi secțiunea 3.4), `FRECVENTA_zile` (7–30), `SL_A/B/C` = 95/85/75%. Toți parametrii sunt citiți din `parametri_furnizori.xlsx` la fiecare rulare — **nimic hardcodat în engine**.

### 3.6.1 Clasificare filiale pe mărime — MARE / MEDIU / MIC (decizie 21.07.2026)

Mecanismul actual (COV_HQ vs. COV_BR) tratează toate filialele „mici" identic, indiferent de volum real. Se introduce o a treia treaptă intermediară:

- **Câmp nou `MARIME_FILIALA`** pe fișa filialei — valori `MARE` / `MEDIU` / `MIC`, completat manual de client (similar principiului `N_PACK` din secțiunea 3.5.1: parametru configurabil, nu hardcodat).
- **Tabel de coeficienți per nivel** — se extinde structura COV_HQ/COV_BR la trei coloane:

| Clasă | COV_MARE (= actual COV_HQ, fără filialele agregate în HQ) | COV_MEDIU (🆕 de completat cu clientul) | COV_MIC (= actual COV_BR) |
|---|---|---|---|
| AX | 2.75 | *de stabilit* | 1.25 |
| AY | 2.50 | *de stabilit* | 1.10 |
| AZ | 2.00 | *de stabilit* | 0.95 |
| BX | 2.50 | *de stabilit* | 1.25 |
| BY | 2.00 | *de stabilit* | 1.00 |
| BZ | 1.75 | *de stabilit* | 0.50 |
| CX | 2.00 | *de stabilit* | 0.75 |
| CY | 1.50 | *de stabilit* | 0.50 |
| CZ | 0 | *de stabilit* | 0 |
| NOU | 0.75 | *de stabilit* | 0.75 |

- **Mapare propusă pe filialele existente** (de confirmat cu clientul, corelat cu blocajul din secțiunea 6):
  - **MARE:** București, Galați, Constanța, Timișoara, Cluj (identic cu alocarea actuală „HQ-like" din COV_HQ).
  - **MEDIU:** subset propus din restul filialelor active (ex. Iași, Brașov, Craiova, Tg. Mureș) — **de confirmat exact care filiale, plus valorile COV_MEDIU**.
  - **MIC:** restul filialelor mici (ex. Oradea, Pitești, Ploiești, Sibiu) — folosesc în continuare COV_BR (redenumit COV_MIC).
- **Impact asupra HQ CAP / București 30%:** regulile din secțiunea 3.5 rămân neschimbate — clasificarea pe mărime afectează doar coeficientul COV folosit în calculul `cycle`, nu regulile de capping.
- **Deschis:** valorile COV_MEDIU și maparea exactă filială→nivel trebuie confirmate de client înainte de implementare; până atunci engine-ul continuă să folosească alocarea binară actuală (COV_HQ/COV_BR) ca fallback.

> ⚠️ Decizie deschisă (I2, neblocantă): `CX = 2.00` > `BY = 1.75/2.00` — client confirmă că e valoare de parametru aleasă deliberat, dar cere confirmare finală înainte de a o considera definitivă.

### 3.7 Flags externe (aplicate după calcul, pe HQ + toate filialele, după HQ CAP)

| Flag | Efect | SKU (run Iunie 2026) |
|---|---|---|
| În lichidare | `BUY_QTY = 0` (MIN/MAX calculate ca referință) | 1.917 |
| Blocat furnizor | `MIN = MAX = BUY = 0` | 7.813 |
| Exclus | `MIN = MAX = BUY = 0` | 18.292 |

Logică: flag din ERP SAU din fișier extern `LICHIDARE_EXCLUDERE_SI_BLOCARE.xlsx` (~34K rânduri) = setat.

---

## 4. Output așteptat

- **Fișier:** `minmax_union.xlsx` (~16 MB)
- **Structură:** 39 coloane × 16 sheet-uri (HQ + 13 filiale + SUMMARY)
- **Header:** Row 0 = titlu cu metadata run, Row 1 = coloane, Row 2+ = date

| Grup coloane | Coloane |
|---|---|
| Identificare | SKU, GRUPA, DENUMIRE, FURNIZOR |
| Vânzări | VZ_52S, VZ_26S, VZ_13S, VZ_4S, SAPT_VZ, SAPT_12S, ULT_VANZ, SAPT_FARA |
| Clasificare | AVG_POND, ABC, XYZ, CLASA, LIFECYCLE, COV_TGT |
| Engine | ENG_MIN, ENG_MAX, STOC_QTY, ORD_FURN, ACOP_CUR, BUY_QTY, BUY_VALUE_RON |
| VS ERP | ERP_MIN_CALC, ERP_MAX_CALC, ERP_MIN_MAN, ERP_MAX_MAN |
| Status & Flags | TREND, STATUS, STOC_VAL_EUR, COST_MED_RON, FLAG, LAST_RECEIPT, DISC_FLAG, BLOCAT, EXCLUDE, IN_LICHIDARE |

**Coloana FLAG** — raportul `ENG_MAX / ERP_MAX`:

| Interval | Semnificație | Cod |
|---|---|---|
| 0.77 – 1.30 | Engine și ERP aliniate | ✓ OK |
| 1.30 – 2.0 | Engine recomandă mai mult (30–100%) | ↑ ENG > ERP |
| 0.50 – 0.77 | Engine recomandă mai puțin (23–50%) | ↓ ENG < ERP |
| > 2.0 | Diferență majoră — analiză necesară | ⚠ ENG >> ERP |
| < 0.50 | ERP mult mai mare — posibil suprastoc | ⚠ ENG << ERP |
| — | Lipsă parametri în ERP (ERP=0, ENG>0) | — |
| — | ON DEMAND/flag, ERP are valori vechi (ENG=0, ERP>0) | — |

**Coloana STATUS** — trend `VZ_13S` vs `VZ_26S`: > +10% ACTIVE · -10%..+10% STABLE · -30%..-10% TREND DOWN · < -30% sau VZ_13S=0 DECLINE · NOU/REACTIVAT → NOU · ON DEMAND confirmat/exclus → OK · ambele 0 → —

**DISC_FLAG:** setat dacă `(AZI − LAST_RECEIPT) > 365 zile` (fundal portocaliu în Excel — posibil discontinuat la furnizor).

`ACOP_CUR = STOC_QTY / AVG_POND` (luni de acoperire cu stocul curent).

---

## 5. Cerințe tehnice de implementare

- Rulare **săptămânală** (recomandat luni).
- Date fresh din ERP: minim **1×/săptămână**.
- **AZI = max(Data vânzări)** din tabel — NU data curentă a sistemului.
- Minim **52 săptămâni** de istoric necesar — devenit **obligatoriu strict** odată cu `SIGMA_WK` (secțiunea 3.4): engine-ul are nevoie de seria completă de 52 de bucket-uri săptămânale per SKU/locație (inclusiv săptămânile cu 0), nu doar de agregatele VZ_4S/13S/26S/52S.
- Volum: 45.848 SKU × 14 locații; input ~60-80 MB (xlsx); output ~16 MB.
- Performanță curentă (Python): calcul ~43s + write ~35s ≈ **~80s total**.
- Toți parametrii citiți din tabel configurabil — **nimic hardcodat în engine**.
- **Validare:** rulare paralelă Python vs ERP, 1-2 săptămâni; criteriu de acceptanță: **>80% SKU cu FLAG = ✓ OK**. ⚠️ **De recalibrat (13.08.2026):** pragul a fost stabilit pentru formula cu proxy σ = 30%; trecerea la `SIGMA_WK` real deplasează safety-ul în sus pentru SKU volatile (Z) și în jos pentru cele stabile (X), deci distribuția FLAG se schimbă structural. Pragul trebuie reconfirmat pe prima rulare cu formula nouă, înainte de a fi folosit ca criteriu de accept.

---

## 6. Blocaj rămas deschis — Lista de filiale active

Engine-ul calculează exact **13 filiale**. Situația completă (confirmată de client):

| Filială | În engine acum | În ERP | Decizie |
|---|---|---|---|
| București, Galați, Constanța, Timișoara, Cluj, Iași, Brașov, Oradea, Pitești, Ploiești, Sibiu, Craiova, Tg. Mureș | DA (13) | prezent | — |
| Arad | NU | prezent | exclus (de confirmat) |
| Voluntari, Mihăilești, Târgoviște, Rm. Vâlcea | NU | nou | exclus (de confirmat) |
| București Automotive | NU | necunoscut | exclus (de confirmat) |
| Bacău | NU | absent | exclus |

> Notă corectată: „Alba" din materialele vechi era de fapt **Sibiu**.

⚠️ Risc conex: regula „București 30%" presupune că Bucureștiul rămâne cea mai mare filială — dacă se activează filiale mari noi, regula trebuie revizuită.

**Acesta este singurul blocaj real de prioritate 1**, care oprește finalizarea structurii de coloane/sheet-uri per filială în `minmax_union.xlsx`.

---

## 7. Validare teoretică a formulei (rezumat)

> **Concluzie:** formula v5 HYBRID este conformă cu standardele academice și de industrie, și în mai multe privințe depășește abordarea clasică din textbook.

| Componentă | Standard academic | v5 HYBRID | Verdict |
|---|---|---|---|
| Safety Stock | $SS = z \times \sigma_D \times \sqrt{L}$ | `safety = SIGMA_WK × SSF × sqrt(LT/7)` — `SSF` = z-score (1.28), `SIGMA_WK` = σ_D real pe 52 săptămâni | ✅ Identic cu formula academică |
| Reorder Point (MIN) | $ROP = E(D) \times L + SS$ | `ENG_MIN = min(max(ceil(buf), MIN_DOC), ENG_MAX)` | ✅ Conform, cu `slts` adițional |
| Stoc maxim (MAX) | $MAX = ROP + Q_{cycle}$ | `ENG_MAX = min(MAX_inf×1.30_HQ, AVG×6, VZ_26S)` | ✅ Conform, cu 3 plafoane suplimentare |
| ABC-XYZ | Pareto + CV, praguri 0.5/1.0 | Identic | ✅ Implementare canonică |
| Nivele de serviciu | z: 90%→1.282, 95%→1.645 | `SSF` = 1.28 flat (≈ 90%); diferențierea per clasă A/B/C se face prin `slts` | ✅ Corespunde; vezi nota L4 |

**Unde formula depășește standardul clasic:** medie ponderată multi-perioadă (răspunde mai rapid la trend), ciclu comandă adaptiv (`max(AVG×COV_TGT, ad×FRECVENTA)`), 3 plafoane simultane anti-outlier, SL diferențiat per clasă ABC, tratament explicit al ciclului de viață produs.

**Lacune identificate (L1–L3):**
- **L1** — variabilitatea lead time-ului ($\sigma_L$) e ignorată; LT tratat ca fix. Impact mediu; nu mai e compensat prin SSF variabil (acum flat 1.28), deci rămâne lacuna cea mai relevantă.
- **L2 — ✅ ÎNCHISĂ (13.08.2026)** — deviația standard a cererii nu mai e proxy (`AVG × 0.30`), ci `SIGMA_WK = STDEV.S(vânzări_săptămânale[52])`, calculată din date reale winsorizate p95, cu zerourile incluse (secțiunea 3.4). Formula devine astfel echivalentul exact al $SS = z \times \sigma_D \times \sqrt{L}$.
- **L3** — componenta `slts` nu are echivalent direct în literatura clasică; validă, dar trebuie documentată explicit pentru echipa ERP. 🔴 Importă mai mult acum: după trecerea SSF la valoare flat, `slts` este **singurul** mecanism de diferențiere a nivelului de serviciu între clasele A/B/C.
- **🆕 L4 — nivel de serviciu efectiv uniform în `safety`.** Cu `SSF = 1.28` pentru toate SKU-urile, componenta de safety stock corespunde unui SL de ~90% indiferent de clasa ABC; clasa A nu mai primește un z-score mai mare (1.65 ≈ 95%). De confirmat cu clientul dacă e intenționat sau dacă SSF ar trebui să varieze per clasă ABC (1.65/1.28/0.67 pentru A/B/C) în loc de per prefix furnizor.

**Compatibilitate ERP enterprise:** ✅ SAP S/4HANA, ✅ Microsoft Dynamics 365, ✅ Oracle SCM Cloud — toate suportă nativ clasificare ABC-XYZ + parametri configurabili per segment.

Detalii complete: [validare_teoretica_formula.md](validare_teoretica_formula.md).

---

## 8. Evaluare modele foundation ML (TimesFM / TabFM) — rezumat

Evaluare exploratorie (nu blochează implementarea curentă) a aplicabilității a două modele Google Research:

| Model | Rol posibil | Recomandare |
|---|---|---|
| **TimesFM** (forecasting serii de timp) | Benchmark paralel pentru validarea preciziei de forecast pe SKU STANDARD clasa A/Z. ⚠️ Motivația „rafinarea proxy-ului σ_D" a devenit caducă — σ_D se calculează acum real (L2 închis) | POC izolat, offline — nu se introduce în producție acum |
| **TabFM** (date tabelare, zero-shot ICL) | Cold-start pentru estimarea cererii SKU **NOU/REACTIVAT** (123 SKU), ca alternativă informată la proxy-ul `AVG = VZ_13S/3` | POC limitat pe eșantion mascat — nu afectează restul formulei |

**Riscuri comune:** auditabilitate (contravin cerinței „nimic hardcodat, tot parametrizabil"), infrastructură nouă de inferență (Python/PyTorch, separată de stack-ul ERP), overhead operațional, lipsă de validare publică pe domeniul specific (distribuție piese auto B2B).

**Concluzie:** ambele sunt interesante ca instrumente auxiliare de validare/benchmark, dar nu se justifică înlocuirea formulei v5 HYBRID — deja conformă cu standardele academice și ERP enterprise — cu modele opace, într-un proiect al cărui obiectiv explicit e transparența și auditabilitatea.

Detalii complete: [evaluare_timesfm_tabfm.md](evaluare_timesfm_tabfm.md).

---

## 9. Istoric — corecții și evoluție față de versiunile inițiale

### 9.0 Retractare 13.08.2026 — safety stock calculat pe deviație standard reală

**Ce s-a retras:** propunerea de safety stock cu deviație standard aproximată la 30% din medie — `safety = (AVG × 0.30 / 30) × SSF × sqrt(LT)`, cu `SSF` variabil 1.28–1.65 per prefix furnizor.

**Ce se aplică în loc** (sugestie confirmată a echipei din Italia):
```
SIGMA_WK = STDEV.S(vânzări_săptămânale[52])   # zerourile incluse, pe date winsorizate p95
safety   = SIGMA_WK × SSF × sqrt(LT/7)          # SSF = 1.28 flat
```

**Ce NU se schimbă:** `AVG`, `ad`, `lt_stock`, `slts`, `buf`, `cycle`, cele 3 plafoane (`MAX_inf`, `AVG×6`, `VZ_26S`), inflația +30% doar pe HQ, `ENG_MIN`, `BUY_QTY` — toate rămân identice.

**Consecințe documentare:** lacuna L2 din validarea teoretică se închide (secțiunea 7); `SSF` încetează să mai fie parametru variabil per furnizor (secțiunile 2 și 3.6); apare itemul deschis L4 (nivel de serviciu uniform în safety); necesarul de date de intrare include explicit **bucket-urile săptămânale de vânzări pe 52 de săptămâni**, nu doar agregatele VZ_4S/13S/26S/52S.

### 9.1 Corecții critice noi (introduse în răspunsul client din 21.07.2026)

- **Excluderea clientului `INTE79` era greșită.** Prezentarea/sinteza inițială recomanda excluderea lui `INTE79` ca fiind clientul intern Dubhe S.R.L. (57.285 buc / 7,1M RON). Este incorect: `INTE79` e client extern real și **nu se exclude**; codurile corecte de exclus sunt `C.000003` (Dubhe S.R.L.) și `MECDIS`. Impact: excluderea greșită elimina ~7,2M RON de cerere reală din baza de calcul, afectând VZ_*, ABC și toate nivelurile MIN/MAX.
- **Winsorizare p95** — pas complet nou, lipsea din toată documentația anterioară (vezi secțiunea 3.1).
- **ABC calculat per grupă de produs** (nu global) — detaliu de metodologie nemenționat anterior (vezi secțiunea 3.3).

### 9.1.1 Decizie ulterioară de parametrizare (21.07.2026)

- **Lista de clienți excluși devine parametru configurabil** (nu mai e hardcodată în engine) — default: `MECDIS`, identificat acum explicit ca **Dubhe Italia** (nu Dubhe România/`C.000003`, care e o intrare separată în listă). Vezi secțiunea 2.1.
- **Tranzacțiile „bombă"** — termen introdus pentru fenomenul deja adresat de winsorizarea p95 (secțiunea 3.1): linii de vânzare cu cantitate mare provenită dintr-o tranzacție unică (nu cerere recurentă), care ar umfla artificial media/MAX-ul. Pragul de winsorizare (percentila 0.95) devine el însuși parametru configurabil, nu valoare fixă.
- **Pack Rules generalizate prin câmpul `N_PACK`** — unele articole se vând doar în grupuri de `n` bucăți; se adaugă un câmp nou pe fișa articolului, completat manual, cu posibilitate de **import Excel** pentru actualizare în masă (secțiunea 3.5.1). Generalizează regulile hardcodate pe categorie (DISC, BUCȘĂ, INJECTOR, PISTON/CĂMAȘĂ).
- **Clasificare filiale pe mărime (MARE/MEDIU/MIC)** — se adaugă câmp `MARIME_FILIALA` per filială, cu tabel de coeficienți COV distinct pentru fiecare nivel, în locul separării binare actuale HQ/filiale (secțiunea 3.6.1). Valorile pentru nivelul MEDIU rămân de completat cu clientul.
- **Două niveluri de clasificare ABC-XYZ** — pe lângă ABC-XYZ per SKU/branch existent (folosit de formula MIN/MAX), se confirmă un calcul separat de ABC-XYZ **per grupă de produs (`mtrl.mtrgroup`) per sucursală**, dedicat calculului **Branch Replenishment** (secțiunea 3.3.1). Clarifică și definiția câmpului `GRUPA`.
- **Regula „podea" (floor) pentru București** — clarificare a secvenței de calcul (HQ întâi, apoi filiale, podeaua aplicată la final) și a logicii exacte: procent minim parametrizabil absorbit din HQ, cu auto-creare a codului lipsă în București la nivelul podelei (secțiunea 3.5.2). Generalizează regula „București 30%" anterioară.

### 9.2 Mapare punct-cu-punct a clarificărilor (întrebări din sinteza 22.06.2026 → răspunsuri 21.07.2026)

| Punct | Întrebare | Răspuns/status |
|---|---|---|
| C1 | STANDARD/ON DEMAND inversate în prezentare? | ✅ Confirmat: STANDARD = 12.502, ON DEMAND = 33.223 (slide 5 avea numere vechi) |
| C2 | Câte filiale active? | 📋 Nerezolvat — vezi secțiunea 6 (blocaj #1) |
| C3 | COV_HQ AX: 2.50 sau 2.75? | ✅ 2.75 e valoarea de producție |
| C4 | Ce este MIN_DOC? | 💬 Cea mai mică cantitate de vânzare din ultimele 52S, default 1 — calculat din vânzări |
| C5 | COV_BR nedefinit | 💬 Există și se folosește — vezi tabel secțiunea 3.6 |
| I1 | SAPT_VZ + SAPT_FARA = 52 → redundant? | 💬 Nu — frecvență vs. recență, vezi secțiunea 3.2 |
| I2 | CX (2.00) > BY (1.75) — bug? | 📋 Valoare de parametru aleasă, confirmare finală necesară |
| I3 | Filialele noi intră în calcul? | 📋 Parte din decizia de listă filiale (= C2) |
| M1 | Nume engine inconsistent | 🔧 De standardizat la „v5 HYBRID" |
| M2 | AVG_POND simplificat greșit în email? | ✅ Corect semnalat — formula reală normalizează ferestrele |
| M3 | ON DEMAND cu COV_TGT=1.0 — ambiguu? | ✅ Ambiguitate de layout; ON DEMAND → MIN=MAX=0, COV_TGT=1.0 e pentru NOU |
| M4 | Decalaj date (~3 săptămâni) | 🔧 Era din rularea veche; rulările curente folosesc date proaspete |

### 9.3 Valori COV_HQ vechi (prezentare inițială) vs. confirmate final

| Clasă | COV_HQ vechi | COV_HQ confirmat | Diferență |
|---|---|---|---|
| AX | 2.75 | 2.75 | — |
| AY | 2.25 | 2.50 | ⚠️ schimbat |
| AZ | 1.75 | 2.00 | ⚠️ schimbat |
| BX | — (nedefinit) | 2.50 | nou |
| BY | 1.75 | 2.00 | ⚠️ schimbat |
| BZ | 1.50 | 1.75 | ⚠️ schimbat |
| CX | 2.00 | 2.00 | — |
| CY | 1.50 | 1.50 | — |
| CZ | 0 | 0 | — |
| NOU | 1.00 | 0.75 | ⚠️ schimbat |

### 9.4 Numere din runul de referință (Iunie 2026)

45.848 SKU total · 14 locații (HQ + 13 filiale) · 17 pași de calcul · 4 reguli business speciale.

Distribuție CLASA (eligibili STANDARD, 12.502): CZ 5.731 (12.5%) · BZ 4.222 (9.2%) · AZ 2.549 (5.6%) · NOU 123 (0.3%) · OD 33.223 (72.5%).

Versiune script: `run_minmax.py` · Output: `minmax_union_v9_1106.xlsx` (16 MB) · 7 bugs rezolvate.

---

## 10. Recomandări / pași următori

1. **Prioritate 1 (blocaj):** obțineți de la client lista finală de filiale active + confirmarea filtrului `INACTIVE` din ERP — fără asta nu se poate finaliza structura de sheet-uri/coloane din output (secțiunea 6).
2. **Corectați imediat** orice listă de excludere clienți existentă: `INTE79` rămâne în calcul; excludeți `C.000003` + `MECDIS` (secțiunea 9.1). **Implementați lista ca parametru configurabil** (nu hardcodat), cu `MECDIS` (Dubhe Italia) ca valoare implicită (secțiunea 2.1, 9.1.1).
3. **Implementați pasul de winsorizare p95** pentru tratamentul „tranzacțiilor bombă" înainte de calculul ferestrelor VZ — doar SKU cu ≥ 8 linii, doar cantități pozitive, cu pragul (percentila) configurabil ca parametru (secțiunea 3.1). ⚠️ Respectați ordinea **excluderi → winsorizare → bucket-uri săptămânale → `SIGMA_WK`**: winsorizarea e prerechizit al calculului de safety stock, nu un pas independent.
4. **🆕 Implementați noul calcul de safety stock** — `SIGMA_WK = STDEV.S(vânzări_săptămânale[52])` (zerourile incluse) și `safety = SIGMA_WK × SSF × sqrt(LT/7)`, cu `SSF = 1.28` flat; asigurați persistarea seriei săptămânale complete în sursa de date, nu doar a agregatelor VZ_* (secțiunile 3.4, 9.0).
5. **Actualizați tabelul COV_HQ** cu valorile confirmate (AY, AZ, BX, BY, BZ, NOU) și adăugați tabelul **COV_BR** pentru filialele mici (secțiunea 3.6).
6. **Confirmați cu clientul** definiția exactă a „grupei de produs" pentru calculul ABC per grupă (secțiunea 3.3) și decizia CX > BY (secțiunea 3.6).
7. **🆕 Confirmați cu clientul `SSF = 1.28` flat** (item L4, secțiunea 7): cu SSF uniform, clasa A nu mai primește protecție statistică suplimentară în `safety`, iar diferențierea rămâne doar prin `slts` — care funcționează invers intenției teoretice (clasa C primește multiplicatorul cel mai mare). Alternativa aliniată: `SSF` per clasă ABC = 1.645 / 1.036 / 0.674.
8. **🆕 Recalibrați criteriul de acceptanță** „>80% SKU cu FLAG = ✓ OK" (secțiunea 5) pe prima rulare cu `SIGMA_WK` — pragul actual a fost calibrat pe formula cu proxy 30% și nu mai e comparabil.
9. **Tratați `Spec_ERP_MinMax_v5_FINAL.docx` ca sursă unică de adevăr** de acum înainte — `MinMax_ERP_Implementation.md` și `email_body.txt` conțin cifre/tabele depășite (COV_HQ vechi, lista de excludere greșită, fără winsorizare); acest document (`SINTEZA_FINALA.md`) le înlocuiește ca referință curentă.
10. **Standardizați nomenclatura** — documentație și fișiere de output să folosească consecvent „v5 HYBRID".
11. **(Opțional, neblocant)** rulați POC-uri izolate TimesFM/TabFM conform recomandărilor din secțiunea 8, fără a afecta calendarul de implementare curent.
12. **Implementați câmpul `N_PACK`** pe fișa articolului (completare manuală, default 1) + fluxul de **import Excel** pentru actualizare în masă a multiplilor de vânzare; clarificați cu clientul dacă înlocuiește sau coexistă cu Pack Rules-urile hardcodate pe categorie (secțiunea 3.5.1).
13. **Stabiliți cu clientul** valorile tabelului **COV_MEDIU** și maparea exactă filială→nivel (MARE/MEDIU/MIC), pentru a finaliza clasificarea pe mărime a filialelor (secțiunea 3.6.1) — corelat cu blocajul de listă filiale (secțiunea 6).
14. **Clarificați cu clientul formula exactă și output-ul calculului Branch Replenishment** — ABC-XYZ per grupă de produs (`mtrl.mtrgroup`) per sucursală, separat de ABC-XYZ per SKU folosit în MIN/MAX (secțiunea 3.3.1); stabiliți dacă rezultatul intră în `minmax_union.xlsx` sau într-un fișier/sheet dedicat.
15. **Implementați regula „podea" pentru București** cu secvența corectă (HQ → filiale → podea la final) și `procent_podea` ca parametru configurabil (default 30%), inclusiv auto-crearea codurilor lipsă din București la nivelul podelei (secțiunea 3.5.2).
