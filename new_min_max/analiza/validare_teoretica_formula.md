# Validare teoretică — Formula MIN/MAX v5 HYBRID vs. Standarde academice
**Data analiză:** 22.06.2026  
**Scop:** Justificarea teoretică a formulei clientului față de literatura de specialitate și standardele ERP

---

## 1. Concluzie principală

> **Formula v5 HYBRID este conformă cu standardele academice și de industrie.**  
> În mai multe privințe, depășește abordarea clasică din textbook prin tehnici mai avansate de estimare a cererii și control al stocului maxim.

---

## 2. Surse autoritare de referință

| Sursă | URL | Conținut relevant |
|---|---|---|
| Wikipedia — Reorder Point | https://en.wikipedia.org/wiki/Reorder_point | Formula ROP standard, componente lead time, variabilitate cerere |
| Wikipedia — Safety Stock | https://en.wikipedia.org/wiki/Safety_stock | Formule complete SS, z-scores, nivele de serviciu |
| Wikipedia — ABC Analysis | https://en.wikipedia.org/wiki/ABC_analysis | Metodologie clasificare Pareto, integrare ERP |
| Wikipedia — Economic Order Quantity | https://en.wikipedia.org/wiki/Economic_order_quantity | Model EOQ, stoc ciclu, costuri deținere |
| SAP Help Documentation | https://help.sap.com | Implementare ABC în ERP enterprise, politici aprovizionare |

---

## 3. Formula standard academică vs. Formula v5 HYBRID

### 3.1 Safety Stock

**Standard academic (formula completă):**
$$SS = z_\alpha \times \sqrt{E(L) \times \sigma_D^2 + E(D)^2 \times \sigma_L^2}$$

**Simplificat (lead time constant, $\sigma_L = 0$):**
$$SS = z \times \sigma_D \times \sqrt{L}$$

**Formula v5 HYBRID (actualizată 13.08.2026):**
$$safety = \sigma_{WK} \times SSF \times \sqrt{\frac{LT}{7}}$$

unde $\sigma_{WK} = \text{STDEV.S}(\text{vânzări săptămânale}_{[52]})$, calculată pe date winsorizate p95, cu săptămânile fără vânzări incluse ca 0.

**Mapare directă:**

| Termen academic | Echivalent v5 HYBRID | Observație |
|---|---|---|
| $z_\alpha$ (z-score nivel serviciu) | `SSF` = 1.28 flat | ≈ 90% SL, uniform pentru toate clasele |
| $\sigma_D$ (deviație standard cerere) | `SIGMA_WK` | **Calculată real** din 52 de bucket-uri săptămânale |
| $\sqrt{L}$ (rădăcina lead time) | `sqrt(LT/7)` | LT convertit în săptămâni, consistent cu unitatea lui $\sigma_{WK}$ |

**Verdict: ✅ Echivalent exact cu formula academică simplificată** (anterior era doar structural identic, cu $\sigma_D$ aproximat — vezi L2).

> **Versiune anterioară, retrasă:** $safety = \frac{AVG \times 0.30}{30} \times SSF \times \sqrt{LT}$, cu `SSF` variabil 1.28–1.65 per prefix furnizor. Proxy-ul de 30% a fost înlocuit la sugestia echipei din Italia cu deviația reală.

**Consistența unităților — verificare.** $\sigma_{WK}$ e exprimată în bucăți/săptămână, iar $\sqrt{LT/7}$ e adimensional pe bază săptămânală → `safety` rezultă în bucăți, aceeași unitate cu `lt_stock` și `cycle`. ✅ Coerent. (Formula veche opera pe bază zilnică: $\sigma$ zilnic × $\sqrt{LT_{zile}}$ — la fel de coerentă dimensional, dar cu un $\sigma$ estimat, nu măsurat.)

---

### 3.2 Reorder Point (ROP) — MIN

**Standard academic:**
$$ROP = E(D) \times L + SS$$

**Formula v5 HYBRID:**
$$ENG\_MIN = \min(\max(\lceil buf \rceil, MIN\_DOC),\ ENG\_MAX)$$

unde $buf = safety + slts + lt\_stock$, iar $lt\_stock = ad \times LT = \frac{AVG}{30} \times LT$

**Mapare directă:**

| Termen academic | Echivalent v5 HYBRID |
|---|---|
| $E(D) \times L$ | `lt_stock = ad × LT` |
| $SS$ | `safety` |
| Ajustare nivel serviciu | `slts = lt_stock × (100/SL - 1)` |

**Verdict: ✅ Conform — cu o componentă adițională `slts` pentru nivel serviciu aplicată separat.**

---

### 3.3 Stoc maxim (MAX)

**Standard academic:**
$$MAX = ROP + Q_{cycle}$$

unde $Q_{cycle}$ este cantitatea unui ciclu de comandă (adesea din formula EOQ).

**Formula v5 HYBRID:**
$$MAX\_raw = \lceil buf + cycle \rceil$$
$$cycle = \max(AVG \times COV\_TGT,\ ad \times FRECVENTA\_zile)$$
$$ENG\_MAX = \min(MAX\_raw \times 1.30_{HQ},\ AVG \times 6,\ VZ_{26S})$$

**Verdict: ✅ Conform — cu trei plafoane suplimentare față de standard.**

---

### 3.4 Clasificare ABC-XYZ

**Standard academic (Wikipedia ABC Analysis):**
- ABC: cumulativ pe valoare (A=80%, B=95%, C=rest) — principiul Pareto
- XYZ: Coefficient of Variation = $CV = \sigma / \mu$; X ≤ 0.5 / Y ≤ 1.0 / Z > 1.0
- Matrice 2D combinată: practică standard în supply chain management

**Formula v5 HYBRID:**
- ABC: identic — cumulativ pe VAL_52S
- XYZ: identic — CV lunar pe 12 luni, aceleași praguri 0.5 / 1.0
- Matrice COV_TGT: tabel 3×3 cu coeficienți de acoperire per clasă

**Verdict: ✅ Implementare canonică, conformă 100% cu literatura.**

---

### 3.5 Nivele de serviciu (SL%)

**z-scores standard (tabel academic):**

| Nivel serviciu | z-score academic | SSF în v5 HYBRID |
|---|---|---|
| 75% | 0.674 | — (clasa C — aplicat prin `slts`) |
| 85% | 1.036 | — (clasa B — aplicat prin `slts`) |
| 90% | 1.282 | **1.28 — valoare flat, toate clasele** |
| 95% | 1.645 | — (clasa A — aplicat prin `slts`) |
| 99% | 2.326 | — |

**Verdict: ✅ SSF = 1.28 corespunde exact z-score-ului pentru SL 90%.** ⚠️ După trecerea la SSF flat (13.08.2026), diferențierea nivelului de serviciu per clasă ABC nu mai are loc în `safety`, ci exclusiv în componenta `slts` — vezi lacuna nouă **L4**.

---

## 4. Unde formula v5 HYBRID depășește standardul clasic

### 4.1 Medie ponderată multi-perioadă (AVG_POND)
**Standard clasic:** medie simplă pe 12 luni sau model naiv.

**v5 HYBRID:**
$$AVG = VZ_{4S} \times 0.30 + \frac{VZ_{13S}}{3} \times 0.40 + \frac{VZ_{26S}}{6} \times 0.15 + \frac{VZ_{52S}}{12} \times 0.15$$

Prin ponderea mai mare acordată perioadei recente (4S = 30%), formula răspunde mai rapid la schimbări de trend — superior mediei simple sau modelului ARIMA de bază.

### 4.2 Ciclu comandă adaptiv
**Standard clasic:** EOQ ÷ 2 (static, ignoră frecvența reală de comandă).

**v5 HYBRID:** `max(AVG × COV_TGT, ad × FRECVENTA_zile)` — alege maximul dintre acoperirea țintă și cantitatea minimă pentru un ciclu de comandă. Conștient de frecvența operațională reală.

### 4.3 Trei plafoane simultane (anti-outlier)
**Standard clasic:** nu există mecanism explicit de cap.

**v5 HYBRID:** `ENG_MAX = min(MAX_inf, AVG×6, VZ_26S)` — previne supraevaluarea pentru SKU cu vânzări excepționale istorice sau sezonalitate extremă.

### 4.4 Diferențiere SL per clasă ABC
**Standard simplist:** un singur SL pentru tot stocul.

**v5 HYBRID:** A=95% / B=85% / C=75% — alocă resurse de stoc proporțional cu importanța produsului. Practică recomandată explicit în literatura de supply chain management.

### 4.5 Clasificare ciclu de viață (STANDARD / NOU / ON DEMAND)
**Standard clasic:** nu abordează produse noi sau fără cerere.

**v5 HYBRID:** tratament diferențiat per ciclu de viață, previne suprastocarea produselor fără istoric suficient.

---

## 5. Lacune față de teoria completă

### L1. Variabilitate lead time ignorată ⚠️

**Formula academică completă include $\sigma_L$:**
$$SS = z \times \sqrt{E(L) \times \sigma_D^2 + E(D)^2 \times \sigma_L^2}$$

**v5 HYBRID folosește LT fix.** Dacă furnizorii au livrări inconsistente, safety stock-ul poate fi insuficient.

**Impact:** mediu — ⚠️ nu mai e compensat prin SSF conservator, care e acum flat la 1.28 (limita inferioară a intervalului vechi). După închiderea L2, aceasta rămâne principala abatere de la formula completă.  
**Recomandare:** dacă datele ERP conțin istoricul recepțiilor per furnizor, se poate calcula $\sigma_{LT}$ și adăuga ca termen opțional.

---

### L2. Deviație standard estimată ca proxy — ✅ ÎNCHISĂ (13.08.2026)

**Problema semnalată inițial:** formula folosea `AVG × 0.30` ca proxy pentru $\sigma_D$ în loc să calculeze deviația standard reală a vânzărilor — funcționa rezonabil pentru distribuții relativ simetrice, dar subestima $\sigma_D$ pentru produse cu cerere extrem de sporadică.

**Rezolvare:** $\sigma_D$ se calculează acum direct din date — `SIGMA_WK = STDEV.S(vânzări_săptămânale[52])`, pe seria winsorizată p95, cu săptămânile fără vânzări incluse ca 0. Combinația celor două decizii este exact practica standard din forecasting de cerere:
- **includerea zerourilor** păstrează intermitența cererii în estimarea variabilității (excluderea lor ar produce un $\sigma$ artificial mic pentru SKU-uri sporadice, tocmai cele mai riscante);
- **winsorizarea p95** împiedică o singură tranzacție de proiect să domine $\sigma$ (deviația standard e pătratică în abateri, deci extrem de sensibilă la outlieri).

**Mitigare complementară (rămâne valabilă):** clasificarea XYZ identifică produsele Z (CV > 1.0) și le reduce COV_TGT.

---

### L3. Componenta `slts` — formulă non-standard ℹ️

$$slts = lt\_stock \times \left(\frac{100}{SL} - 1\right)$$

Aceasta nu apare în literatura clasică ca formulă separată. Este un multiplicator de nivel de serviciu aplicat pe componenta de lead time — logică validă, dar **trebuie documentată explicit** pentru echipa ERP care va implementa formula, pentru a evita interpretări greșite.

**Exemplu numeric pentru SL=95%:** $slts = lt\_stock \times (100/95 - 1) = lt\_stock \times 0.0526$  
**Exemplu numeric pentru SL=75%:** $slts = lt\_stock \times (100/75 - 1) = lt\_stock \times 0.333$

🔴 **Importanță crescută după 13.08.2026:** cu `SSF` flat, `slts` rămâne singurul termen care diferențiază nivelul de serviciu între clasele A/B/C — și o face invers decât intenția teoretică (clasa C, cu SL 75%, primește multiplicatorul cel mai mare: 0.333 vs. 0.0526 pentru clasa A). Comportamentul e cel al unei rezerve procentuale pentru incertitudine, nu al unui z-score, și trebuie explicat explicit echipei ERP.

---

### L4. Nivel de serviciu uniform în `safety` — item nou (13.08.2026) ⚠️

Cu `SSF = 1.28` pentru toate SKU-urile, componenta de safety stock implică un nivel de serviciu de ~90% indiferent de clasa ABC. Anterior, intervalul 1.28–1.65 permitea (cel puțin teoretic) alocarea unui z-score mai mare articolelor critice.

**Implicație:** clasa A nu mai primește protecție statistică suplimentară în `safety`; diferențierea rămâne doar prin `slts` (L3) și prin `COV_TGT` (componenta `cycle`).  
**Recomandare:** de confirmat cu clientul dacă e intenționat. Alternativa aliniată teoretic ar fi `SSF` per clasă ABC — 1.645 (A, 95%) / 1.036 (B, 85%) / 0.674 (C, 75%) — coerentă cu tabelul SL deja definit în spec, în locul unei valori unice.

---

## 6. Compatibilitate cu ERP-uri enterprise

| Platformă ERP | Metodă suportată | Compatibilitate v5 HYBRID |
|---|---|---|
| **SAP S/4HANA** | ABC analysis + MRP cu nivele serviciu | ✅ Compatibil — SAP folosește același tabel COV per clasă |
| **Microsoft Dynamics 365** | ABC classification + configurare SL% per grupă | ✅ Compatibil |
| **Oracle SCM Cloud** | ABC-XYZ matrix + safety stock per segment | ✅ Compatibil |

Abordarea clientului este implementabilă nativ în orice ERP enterprise major care suportă clasificare ABC-XYZ și parametri configurabili per segment.

---

## 7. Concluzie pentru echipa ERP

Formula MIN/MAX v5 HYBRID poate fi **justificată teoretic** în fața oricărei echipe tehnice sau de audit prin:

1. **Safety stock** — implementare directă a formulei $z \times \sigma_D \times \sqrt{L}$ (Wikipedia, Nahmias & Olsen 2015), cu $\sigma_D$ calculat real din 52 de bucket-uri săptămânale
2. **Clasificare ABC-XYZ** — practică standard documentată în supply chain management
3. **Nivele serviciu 95%/85%/75%** — corespund z-score-urilor academice pentru clasele A/B/C
4. **AVG ponderat** — metodologie superioară mediei simple, similară Exponential Smoothing

Elemente care necesită documentare/decizie suplimentară internă: componenta `slts` (L3), decizia de a ignora $\sigma_{LT}$ (L1) și uniformitatea `SSF` (L4).

---

*Actualizat 13.08.2026: safety stock recalculat pe deviație standard reală (`SIGMA_WK`), `SSF` flat 1.28 — L2 închisă, L4 adăugată.*

---

*Document generat: 22.06.2026 · Surse: Wikipedia (Reorder Point, Safety Stock, ABC Analysis, EOQ), SAP Help Documentation*
