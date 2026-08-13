# MIN/MAX Engine v5 HYBRID — Sinteză cerințe & Clarificări necesare
**Client:** Dubhe Romania SRL · HQ + filiale · 45.848 SKU  
**Data analiză:** 22.06.2026  
**Baza documente:** prezentare MinMax_ERP_Implementation, email client, extract ERP branches

---

## 1. Sinteză cerințe

### 1.1 Obiectiv
Implementarea în ERP a unui engine automat de calcul MIN/MAX bazat pe matricea **ABC + XYZ**, care să înlocuiască calculul curent manual/simplu. Engine-ul calculează nivelurile MIN și MAX de stoc pentru fiecare SKU din fiecare locație, optimizând comenzile către furnizori — evitând suprastocul și rupturile de stoc.

---

### 1.2 Date de intrare necesare în ERP

| Tabel | Câmpuri cheie | Tip |
|---|---|---|
| Tranzacții vânzări | Data, SKU, Cantitate (incl. retururi), Valoare RON fără TVA, Cod client, Branch | DATE / VARCHAR / INT / DECIMAL |
| Stoc & comenzi | STOC_QTY, ORD_FURN (pe drum), LAST_RECEIPT, COST_MED_RON, STOC_VAL_EUR | INT / DATE / DECIMAL |
| Parametri furnizori | LT_zile, SSF (1.28–1.65), FRECVENTA_zile, COV_HQ, COV_BR per prefix SKU | INT / DECIMAL |
| ERP MIN/MAX curent | MIN_MANUAL, MAX_MANUAL, MIN_CALCULAT, MAX_CALCULAT per SKU/branch | INT |
| Flags externe | LICHIDARE, BLOCAT, EXCLUDE — fișier ~34K rânduri | BOOL/FLAG |

> ⚠️ **Excluderi obligatorii la procesare:**
> - Client `INTE79` (Dubhe S.R.L. — transfer intern HQ→filiale): 57.285 buc, 7.1M RON
> - Prefixe SKU: `DISC.` și `OTHER.`

---

### 1.3 Logica de calcul — 17 pași

#### Clasificare ciclu de viață (3 clase)

| Clasă | Condiție | SKU | Tratament |
|---|---|---|---|
| **STANDARD** | SAPT_VZ ≥ 3 AND SAPT_FARA ≤ 39 AND VZ_52S > 0 | ~12.502 (~27%) | Calcul complet MIN/MAX |
| **NOU/REACTIVAT** | SAPT_8S ≥ 2 AND VZ_26S > 0 | ~123 (0.3%) | AVG = VZ_13S/3, COV_TGT = 1.0 |
| **ON DEMAND** | Restul | ~33.223 (~72%) | MIN = MAX = BUY = 0 |

> `VZ_52S > 0` obligatoriu pentru STANDARD — produsele cu retururi care anulează net vânzările → ON DEMAND.

#### Clasificare ABC-XYZ (doar STANDARD)
- **ABC** — cumulativ pe VAL_52S: A = 0–80%, B = 80–95%, C = 95–100%
- **XYZ** — CV lunar pe 12 luni: X ≤ 0.5 (stabil), Y ≤ 1.0 (mediu), Z > 1.0 (volatil)
- Forțat Z dacă: lună dominantă > 60% din VZ_52S, sau < 2 luni cu vânzări

#### Tabel COV_TGT (luni acoperire) — HQ

| | X (CV≤0.5) | Y (CV≤1.0) | Z (CV>1.0) |
|---|---|---|---|
| **A** | 2.75 | 2.25 | 1.75 |
| **B** | 2.00 | 1.75 | 1.50 |
| **C** | 2.00 | 1.50 | 0 |
| **NOU** | — | 1.00 | — |
| **OD** | — | 0 | — |

#### Formula v5 HYBRID

```
AVG_POND  = VZ_4S×0.30 + (VZ_13S/3)×0.40 + (VZ_26S/6)×0.15 + (VZ_52S/12)×0.15
ad        = AVG / 30
safety    = (AVG × 0.30 / 30) × SSF × sqrt(LT)
lt_stock  = ad × LT
slts      = lt_stock × (100/SL - 1)
buf       = safety + slts + lt_stock
cycle     = max(AVG × COV_TGT,  ad × FRECVENTA_zile)
MAX_raw   = ceil(buf + cycle)
MAX_inf   = ceil(MAX_raw × 1.30)   ← HQ ONLY, filialele NU primesc inflație!

ENG_MAX   = min(MAX_inf, AVG×6, VZ_26S)   ← 3 plafoane simultane, obligatorii
ENG_MIN   = min(max(ceil(buf), MIN_DOC), ENG_MAX)
BUY_QTY   = max(0, ENG_MAX - STOC_QTY - ORD_FURN)
```

Service Level: A = 95%, B = 85%, C = 75%

#### Reguli business speciale

| Regulă | Logică | SKU afectați |
|---|---|---|
| **HQ CAP** | `IF ENG_MAX_HQ > SUM_BR_MAX × 1.5 → ENG_MAX_HQ = ceil(SUM_BR_MAX × 1.5)` | ~4.208 (~9%) |
| **București 30%** | `IF ENG_MIN_BUC < ENG_MIN_HQ × 0.30 → ENG_MIN_BUC = ceil(ENG_MIN_HQ × 0.30)` | Re-aplicat după HQ CAP |
| **Pack Rules** | DISC FRÂNĂ: multiplu 2; BUCȘĂ/SILENTBLOC: min 4; INJECTOR: 0 dacă MAX<3 altfel min 4; PISTON/CĂMAȘĂ: multiplu 4/6 | — |

#### Flags externe (aplicate după calcul)

| Flag | Efect | SKU (Iunie 2026) |
|---|---|---|
| În lichidare | BUY_QTY = 0 (MIN/MAX se calculează ca referință) | 1.917 |
| Blocat furnizor | MIN = MAX = BUY = 0 | 7.813 |
| Exclus | MIN = MAX = BUY = 0 | 18.292 |

---

### 1.4 Output așteptat

- **Fișier:** `minmax_union.xlsx` (~16 MB)
- **Structură:** 39 coloane × 16 sheet-uri (HQ + 13/14 filiale + SUMMARY)
- **Header:** Row 0 = titlu cu metadata run, Row 1 = coloane, Row 2+ = date

| Grup coloane | Coloane |
|---|---|
| Identificare | SKU, GRUPA, DENUMIRE, FURNIZOR |
| Vânzări | VZ_52S, VZ_26S, VZ_13S, VZ_4S, SAPT_VZ, SAPT_12S, ULT_VANZ, SAPT_FARA |
| Clasificare | AVG_POND, ABC, XYZ, CLASA, LIFECYCLE, COV_TGT |
| Engine | ENG_MIN, ENG_MAX, STOC_QTY, ORD_FURN, ACOP_CUR, BUY_QTY, BUY_VALUE_RON |
| VS ERP | ERP_MIN_CALC, ERP_MAX_CALC, ERP_MIN_MAN, ERP_MAX_MAN |
| Status & Flags | TREND, STATUS, STOC_VAL_EUR, COST_MED_RON, FLAG, LAST_RECEIPT, DISC_FLAG, BLOCAT, EXCLUDE, IN_LICHIDARE |

**Coloana FLAG:** raport ENG_MAX/ERP_MAX → ✓ OK (0.77–1.30) / ↑ ENG>ERP / ↓ ENG<ERP / ⚠ ENG>>ERP / ⚠ ENG<<ERP  
**DISC_FLAG:** setat dacă (AZI − LAST_RECEIPT) > 365 zile

---

### 1.5 Cerințe tehnice

- Rulare **săptămânală** (recomandat luni)
- Date fresh din ERP: minim **1×/săptămână**
- **AZI = max(Data vânzări)** din tabel — NU data curentă sistem
- Minim **52 săptămâni** de istoric necesar
- Performanță țintă: ≤ ~80s (referință Python: calcul ~43s + write ~35s)
- Toți parametrii citiți din tabel configurabil — **nimic hardcodat în engine**
- Validare: rulare paralelă Python vs ERP (1-2 săptămâni), criteriu acceptanță: **>80% SKU cu FLAG = ✓ OK**

---

## 2. Inadvertențe identificate

### 🔴 Critice — impact direct asupra implementării

#### C1. STANDARD ↔ ON DEMAND inversate în prezentare (Slide 5 vs Slide 15)
| Sursă | STANDARD | ON DEMAND |
|---|---|---|
| Slide 5 | ~72% (33.223) — **GREȘIT** | — |
| Slide 15 + email | **12.502 (~27%)** | **33.223 (~72%)** |

Validare matematică: CZ(5.731) + BZ(4.222) + AZ(2.549) = 12.502 = STANDARD real.  
**➡️ De confirmat: cifrele corecte sunt STANDARD = 12.502, ON DEMAND = 33.223.**

---

#### C2. Număr filiale neclar: 13 vs 14 vs mai multe (confirm din extract ERP)

Prezentarea oscilează între „13 filiale" și „14 locații". Extractul ERP arată **mai multe branch-uri** decât cele din prezentare:

| Filiale din prezentare | Status în ERP |
|---|---|
| București | ✅ prezent |
| Cluj | ✅ prezent |
| Brașov | ✅ prezent |
| Craiova | ✅ prezent |
| Galați | ✅ prezent |
| Iași | ✅ prezent |
| Oradea | ✅ prezent |
| Arad | ✅ prezent |
| Pitești | ✅ prezent |
| Ploiești | ✅ prezent |
| Timișoara | ✅ prezent |
| Constanța | ✅ prezent |
| Alba | ❓ apare **Sibiu** în ERP — aceeași locație sau diferite? |
| Bacău | ❓ nu apare vizibil în extract |
| — | ⚠️ **Voluntari** — nouă, neplanificată |
| — | ⚠️ **Mihăilești** — nouă, neplanificată |
| — | ⚠️ **Târgu Mureș** — nouă, neplanificată |
| — | ⚠️ **Târgoviște** — nouă, neplanificată |
| — | ⚠️ **Râmnicu Vâlcea** — nouă, neplanificată |
| — | ⚠️ **București Automotive** — sub-branch sau entitate separată? |

Coloana `INACTIVE` din ERP determină care branch-uri intră în calcul.  
**➡️ De clarificat: lista exactă de branch-uri active + filtrare INACTIVE.**

---

#### C3. Trei valori diferite pentru COV_HQ clasa AX

| Sursă | Valoare AX |
|---|---|
| Slide 6 (tabel ABC-XYZ) | **2.75** |
| Slide 9 (parametri configurabili) | **2.75** |
| Slide 15 (modificări față de versiunea anterioară) | „AX COV_HQ: 2.25 → **2.50**" |

**➡️ Care este valoarea de producție pentru AX? (2.50 sau 2.75)**

---

#### C4. `MIN_DOC` nedefinit

Apare în formula: `ENG_MIN = min(max(ceil(buf), MIN_DOC), ENG_MAX)`  
Nu este definit nicăieri în documentație — nici sursă, nici valoare, nici semnificație.  
**➡️ Ce este MIN_DOC? De unde vine? Este un parametru ERP existent?**

---

#### C5. Formula pentru filiale incompletă — COV_BR nedefinit

`COV_BR` este listat ca input în Slide 4 dar **nu apare în nicio formulă**. Tabelul COV_TGT conține exclusiv valori HQ.  
**➡️ Filialele folosesc ce coeficienți de acoperire? Același tabel ca HQ sau valori diferite?**

---

### 🟠 Importante — logică și parametri

#### I1. Condiție eligibilitate STANDARD — posibil redundantă

Condiția: `SAPT_VZ >= 3 AND SAPT_FARA <= 39`  
Dacă ambele se măsoară pe 52 săptămâni: SAPT_VZ + SAPT_FARA = 52, deci:
- `SAPT_FARA ≤ 39` ⟺ `SAPT_VZ ≥ 13`
- Condiția `SAPT_VZ ≥ 3` devine inutilă (mai slabă decât ≥ 13)

**➡️ Se măsoară pe ferestre diferite? Altfel una din condiții este redundantă.**

---

#### I2. Anomalie în tabelul COV_TGT — CX > BY

`CX = 2.00` > `BY = 1.75`: un produs clasa C stabil primește acoperire mai mare decât un produs B cu cerere medie.  
**➡️ Este intenționat? De validat ca regulă de business.**

---

#### I3. Locații noi din ERP — Voluntari, Mihăilești, TG. Mureș, Târgoviște, Râmnicu Vâlcea

Aceste branch-uri nu apar în nicio descriere a engine-ului.  
**➡️ Intră în calculul MIN/MAX sau sunt excluse (similar HQ — agregator pur)?**  
**➡️ Dacă intră, regula „București 30%"  mai este relevantă ca cea mai mare filială?**

---

### 🟡 Minore — clarificări utile

#### M1. Versionare inconsistentă
Formula = „v5 HYBRID", output = `minmax_union_v9_1106.xlsx` (v9).  
De aliniat nomenclatura pentru comunicare cu echipa ERP.

#### M2. AVG_POND simplificat greșit în email
Emailul scrie `4S×30% + 13S×40% + 26S×15% + 52S×15%` — formula reală **normalizează** ferestrele:  
`VZ_4S×0.30 + (VZ_13S/3)×0.40 + (VZ_26S/6)×0.15 + (VZ_52S/12)×0.15`  
Riscă să inducă în eroare echipa ERP la implementarea formulei.

#### M3. ON DEMAND COV_TGT ambiguu
Slide 5 pare să atribuie `COV_TGT = 1.0` la ON DEMAND, dar acesta este pentru NOU (Slide 9: OD → MIN=MAX=0). Ambiguitate de layout în prezentare.

#### M4. Decalaj date
AZI din run = 2026-05-29, baza calcul = 11.06.2026, data curentă = 22.06.2026 → decalaj ~3 săptămâni.  
De confirmat că cerința „date fresh minim 1×/săptămână" este aplicată corect în noul flux ERP.

---

## 3. Checklist întâlnire echipă ERP

### Prioritate 1 — Blochează implementarea
- [ ] **C2** — Lista exactă de branch-uri active (filtrare coloana INACTIVE din ERP)
- [ ] **C4** — Definirea și sursa `MIN_DOC`
- [ ] **C5** — Tabel COV_TGT pentru filiale (același ca HQ sau valori separate `COV_BR`?)

### Prioritate 2 — Afectează rezultatele calculului
- [ ] **C1** — Confirmare cifre: STANDARD = 12.502, ON DEMAND = 33.223
- [ ] **C3** — Valoarea de producție pentru COV_HQ clasa AX (2.50 sau 2.75?)
- [ ] **I3** — Branch-urile noi (Voluntari, Mihăilești etc.) intră sau nu în engine?

### Prioritate 3 — Clarificări de logică/parametri
- [ ] **I1** — Ferestrele de măsurare pentru SAPT_VZ și SAPT_FARA (sunt pe 52S ambele?)
- [ ] **I2** — CX > BY în tabelul COV_TGT — intenționat?
- [ ] **C2** — Sibiu vs Alba: aceeași locație sau locații distincte?
- [ ] **C2** — București Automotive: sub-branch sau entitate separată cu stoc propriu?
- [ ] **M2** — Confirmare formulă AVG_POND corectă pentru documentația tehnică ERP

---

*Document generat: 22.06.2026 · Baza: MinMax_ERP_Implementation.md + email_body.txt + extract ERP branches*
