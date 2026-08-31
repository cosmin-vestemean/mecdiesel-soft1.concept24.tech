# MIN/MAX Engine v5 HYBRID — Sumar teoretic pentru confirmare

**Destinatar:** Dubhe Romania SRL
**Data:** 14.08.2026
**Scop:** consolidarea într-un singur document a **ipotezelor**, **formulelor** și **cazurilor-limită** rezultate din documentația de analiză, pentru confirmare formală înainte de începerea implementării în ERP.

**Documente-sursă, în ordinea autorității:**

1. `Spec_ERP_MinMax_v5_FINAL.docx` și `Raspuns_Clarificari_MinMax.docx` — documentele dumneavoastră
2. Email-uri și discuții în ședințe, consemnate de noi
3. [analiza/SINTEZA_FINALA.md](analiza/SINTEZA_FINALA.md), [analiza/validare_teoretica_formula.md](analiza/validare_teoretica_formula.md) — analizele și deducțiile noastre

---

## Cum se folosește acest document

Fiecare element are un identificator (`I` = ipoteză, `F` = formulă, `E` = caz-limită, `L` = lacună metodologică), un **status** și o **sursă**.

| Status | Semnificație |
|---|---|
| ✅ | Apare **textual** în documentele dumneavoastră — se implementează ca atare |
| ⚠️ | **Necesită confirmare** — avem o propunere, dar decizia vă aparține |
| 🔴 | **Verificare în ERP** care schimbă o ipoteză din specificație |

| Sursă | Proveniență |
|---|---|
| `[S]` | Specificația sau răspunsul dumneavoastră la clarificări |
| `[E]` | Email sau discuție în ședință, consemnate de noi |
| `[D]` | **Deducția noastră** — nu a fost confirmată de dumneavoastră |

> Marcajul de sursă contează mai mult decât statusul. Tot ce este `[D]` sau `[E]` există **doar în documentele noastre de analiză**. Dacă nu vă recunoașteți într-un punct marcat astfel, acolo este exact locul unde așteptăm corectura dumneavoastră.

Vă rugăm să răspundeți punctual, pe identificator (ex. „I7 — Document", „E12 — varianta B").

---

# PARTEA I — IPOTEZE

## 1. Perimetru și date de intrare

### I1 ✅ `[S]` Fereastra de analiză — confirmată implicit (14.08.2026)
52 de săptămâni de istoric — acest lucru este din specificație (§5). Ce **nu** este din specificație: cerința ca motorul să dispună de **seria săptămânală integrală** (52 de valori per SKU per locație), nu doar de agregatele `VZ_4S`/`VZ_13S`/`VZ_26S`/`VZ_52S`. Această cerință devine obligatorie odată ce clientul a confirmat calculul deviației standard reale (F5) — seria trebuie păstrată winsorizată p95, cu zerourile incluse.

### I2 ✅ `[S]` Definiția lui „AZI"
`AZI = max(data tranzacției)` din vânzări — **nu** data curentă a sistemului. Elimină distorsiunea dată de decalajul de import. (Specificația §3.1.)

### I3 ✅ `[S]` Netting retururi
Retururile compensează vânzările per (SKU, client, fereastră), cu rezultatul limitat inferior la zero: `max(0, Σ cantități)`. Nu se contorizează separat. (Specificația §3.3.)

### I4 ✅ `[S]` Excluderi de prefix
Se exclud SKU-urile cu prefixele `DISC.` și `OTHER.`. (Specificația §2.)

### I5 ⚠️ `[D]` Excluderi de clienți — listă extinsă

Specificația indică `C.000003` și `MECDIS`, plus corecția explicită că `INTE79` **nu** se exclude. Lista devine parametru configurabil. Am verificat codurile în ERP, pe ultimele 52 de săptămâni:

| Cod | Denumire în ERP | Linii de vânzare | Propunere |
|---|---|---|---|
| `C.000003` | DUBHE ROMANIA S.R.L. | 0 | exclus (intern) |
| `MECDIS` | DUBHE S.R.L. | 269 | exclus (intern, Italia) |
| `MECDI2` | **DUBHE BULGARIA EOOD** | 414 | **NU se exclude** — confirmat de client (14.08.2026) |
| `INTE79` | INTER CARS ROMANIA | 930 | **NU se exclude** — client extern real |

> **Atenție tehnică:** niciunul dintre aceste coduri nu este unic în ERP. `MECDIS`, `MECDI2` și `INTE79` au **câte două înregistrări** de partener fiecare (de exemplu `MECDIS` = 53900 și 61167). Excluderea se va face pe **cod**, nu pe un identificator intern, altfel o parte din tranzacții ar rămâne în calcul.

> **Confirmat (14.08.2026):** `MECDI2` (Dubhe Bulgaria) este tratată comercial, nu ca transfer intern — **rămâne în calcul**, nu se adaugă la lista de excluderi.

### I6 ✅ `[S]` HQ este agregator — verificat în ERP și **confirmat**

Specificația justifică plafonul HQ CAP prin afirmația: *„HQ e agregator pur (fără vânzări proprii); formula supraevaluează HQ"*. Am verificat-o direct în baza de date și **se susține**.

HQ (1000) are 26.128 de linii în ultimele 52 de săptămâni. Defalcate pe tipul documentului:

| Tip document | Intră în statistici | Linii |
|---|---|---|
| `9999` — Fara tranzactie | nu | **26.030** |
| `7090` — Factura vanzari (Servicii) | da | 88 |
| `9902` — Fara tranzactie | nu | 5 |
| `7471` — Factura promo & vouchere | da | 4 |

Doar **92 de linii** (0,4%) sunt vânzări care intră în statistici, iar acelea sunt servicii și vouchere, nu marfă. HQ nu are cerere proprie de piesă.

> **Consecință de implementare — nu o întrebare:** cererea HQ **nu poate fi calculată** din liniile atribuite locației 1000. Ar rezulta `AVG ≈ 0`, deci `MIN`, `MAX` și `BUY_QTY` zero pe întreg portofoliul HQ. HQ trebuie dimensionat pe **vânzările agregate la nivel de companie**, exact cum procedează deja raportul Top ABC existent în modul „companie". Inflația de +30% și HQ CAP își păstrează justificarea.

### I7 ⚠️ `[D]` Atribuirea vânzării pe filială — decizie cu impact pe o treime din date

O linie de vânzare are **două** filiale posibile: cea a documentului (`FINDOC.BRANCH`) și cea a agentului (`PRSN.BRANCH`). Raportul Top ABC existent are ambele moduri, ca parametru. **Specificația nu precizează care se folosește.**

Verificare pe ultimele 52 de săptămâni, pe cele 241.285 de linii care intră în statistici:

| Situație | Linii | Pondere |
|---|---|---|
| Agent = filiala documentului | 157.672 | 65,3% |
| **Agent ≠ filiala documentului** | **83.613** | **34,7%** |

Pe setul brut, fără filtrul de tip document (669.756 linii), proporția este similară: 216.993 de nepotriviri, adică 32,4%.

**O treime din liniile de vânzare se atribuie unei filiale diferite** în funcție de modul ales. Aceasta nu este o nuanță tehnică: schimbă direct `VZ_*`, `ABC`, variabilitatea și, în final, MIN/MAX-ul fiecărei filiale.

> **De confirmat:** care este definiția corectă a „vânzării unei filiale" pentru dimensionarea stocului?
> - **Varianta A — filiala documentului:** stocul se dimensionează acolo unde marfa a ieșit fizic. Recomandarea noastră, fiind coerentă cu scopul (reaprovizionarea unui depozit).
> - **Varianta B — filiala agentului:** stocul urmărește portofoliul comercial, indiferent de unde s-a livrat.
> - **🆕 Varianta C — filiala clientului (`FINDOC.TRDBRANCH` → tabela `TRDBRANCH`), propusă de client (14.08.2026):** clienții cu mai multe puncte de livrare au o filială proprie mapată manual de utilizatori în S1, pe tabela `TRDBRANCH` (cheie `TRDR` + `SODTYPE=13` + `TRDBRANCH`, coloană `BRANCH` completată manual). Diferă de A (unde a ieșit marfa fizic) și de B (portofoliul agentului): C urmărește **unde e efectiv punctul de consum/livrare al clientului**, indiferent cine a preluat comanda sau din ce depozit s-a onorat.

**Validare pe date (14.08.2026)**, aceleași 241.486 linii statistice / 52 săptămâni:

| Comparație | Rezultat |
|---|---|
| Acoperire `TRDBRANCH` (linii cu maparea completată) | 241.458 / 241.486 — **99,99%**, practic universală |
| Filiala documentului = filiala agentului | 157.815 — **65,3%** (confirmă tabelul de mai sus) |
| Filiala documentului = filiala clientului (`TRDBRANCH`) | 146.135 / 241.458 — **60,5%** |
| **Filiala agentului = filiala clientului (`TRDBRANCH`)** | **211.740 / 241.458 — 87,7%** |

**Concluzie:** `TRDBRANCH` (C) e mult mai aproape de filiala agentului (B) — 87,7% suprapunere — decât de filiala documentului (A) — doar 60,5%. Altfel spus, filiala documentului e semnalul „zgomotos" (reflectă din ce depozit s-a onorat fizic comanda, posibil cross-shipping), în timp ce agentul și maparea manuală a clientului converg spre același răspuns: „a cui e cererea", aproape independent de depozitul care a livrat efectiv.

**Exemplu concret — TRDR `57761` (GEODEL, cod `MCDSEE CONSTANTA`)**, unic punct de livrare mapat pe `TRDBRANCH.BRANCH = 1300` (CONSTANTA), agent fix pe 1300: din 20 documente recente, filiala documentului a variat între **1000 (HQ)**, **1300 (CONSTANTA)** și **2200 (BUCUREȘTI)**, în timp ce agentul și maparea `TRDBRANCH` au rămas constant 1300 pe toate liniile. Ilustrează exact tiparul de mai sus.

> **Recomandare actualizată, sub rezerva confirmării clientului:** varianta B (agent) sau C (`TRDBRANCH`) par mai stabile pentru atribuirea cererii decât A (document); între B și C rămâne de ales, dat fiind că se suprapun în 87,7% din cazuri. Recomandăm C, fiind maparea explicită de business a clientului pe filială, nu un proxy (portofoliul agentului se poate schimba fără să reflecte o mutare reală a clientului).

### I8 ⚠️ `[D]` Lista de filiale — se reduce la 4 poziții

Motorul actual calculează 13 filiale. În ERP sunt **18 locații active** (HQ + 17). Diferența este exact 4. Am verificat dacă au vânzări:

| Filială | Cod | Linii care intră în statistici | Total linii | Propunere |
|---|---|---|---|---|
| ARAD | 2300 | **0** | 0 | excludere — fără impact |
| MIHĂILEȘTI | 2600 | **0** | 0 | excludere — fără impact |
| VOLUNTARI | 2400 | **1.161** | 2.911 | **de inclus** — are cerere reală |
| RÂMNICU VÂLCEA | 2900 | **1.611** | 5.205 | **de inclus** — are cerere reală |

„Târgoviște" și „București Automotive" din documentație **nu există** ca locații în ERP. „Bacău" este confirmat absent. „Alba" era, într-adevăr, Sibiu.

> **De confirmat:** excluderea VOLUNTARI și RM. VÂLCEA înseamnă că cererea lor reală — circa 2.770 de linii de vânzare — nu generează niciun nivel de stoc, iar acele filiale rămân aprovizionate exclusiv manual. Este intenționat?

### I9 ✅ `[S]` Universul de articole
Articole de tip marfă, active, cu cont de gestiune standard. Rezultă **52.842 SKU** cu activitate de vânzare în ultimele 52 de săptămâni (documentația menționa 45.848 — diferența provine din perioada de referință diferită).

### I10 ⚠️ `[E]` Definiția „grupei de produs"
Câmpul `MTRGROUP` din fișa articolului. Această precizare provine dintr-o discuție, nu din specificația scrisă, care spune doar „grupă de produs". În ERP există **46 de grupe**, dintre care 42 au vânzări. Cea mai mare grupă (`LOCALE`) conține 22.159 SKU, adică ~42% din portofoliul activ.

> **De confirmat:** clasificarea ABC se face cumulativ **în interiorul fiecărei grupe**. Într-o grupă de 22.159 de articole, pragul de 80% selectează un număr foarte mare de articole „A"; într-o grupă de 50 de articole, „A" înseamnă câteva unități. Este acceptabil ca importanța unui articol să fie relativă la grupa lui, nu la portofoliu? (Acesta este efectul dorit al metodologiei, dar are consecințe asupra `COV_TGT`.)

---

## 2. Ipoteze metodologice

### I11 ✅ `[S]` Ordinea de pre-procesare — confirmată (14.08.2026)
Specificația fixează winsorizarea **după excluderi și înainte de calculul ferestrelor** (§3.2), iar nettingul imediat după (§3.3):

```
excluderi → winsorizare p95 → netting → bucket-uri săptămânale → ferestre VZ
```

Ordinea contează practic: winsorizarea este definită **per linie de vânzare**. Dacă nettingul se aplică primul, liniile individuale nu mai există și percentila 95 nu mai are pe ce să fie calculată.

> **Confirmat de client (14.08.2026):** rămâne ordinea din specificație, exact cum e redată mai sus. Documentele noastre anterioare care inversau pașii (`netting → winsorizare`) sunt corectate — nu se mai folosesc.

### I12 ✅ `[S]` Zerourile intră în deviația standard — confirmat (14.08.2026)
Cele 52 de bucket-uri săptămânale trebuie să includă și săptămânile **fără** vânzări. Excluderea lor ar produce un `σ` artificial mic tocmai pentru articolele sporadice — cele mai riscante. Confirmat explicit de client prin e-mail, odată cu F5: „zerourile incluse, pe date winsorizate p95".

### I13 ✅ `[S]` Winsorizarea nu afectează valoarea
Se plafonează doar cantitățile, nu și valoarea netă. Prin urmare clasificarea ABC (bazată pe valoare) rămâne neafectată. (Specificația §3.2.)

### I14 ⚠️ `[D]` Lead time tratat ca fix
Formula folosește `LT` constant per prefix de furnizor. Variabilitatea reală a livrărilor (`σ_LT`) este ignorată — vezi lacuna L1.

> **De confirmat:** dispuneți de istoricul recepțiilor per furnizor? Dacă da, `σ_LT` poate fi calculat și adăugat ca termen opțional, apropiind formula de varianta academică completă.

**Clarificare client (14.08.2026):** `LT` și restul parametrilor (`SSF`, `FRECVENTA_zile`/RP, `SL`, overmax factor) trebuie mapați pe **prefix de cod articol** (ex. `FEBI%`, `MEC%`), nu doar per furnizor — exact ca ecranul legacy „Scrie min MAX" din S1 (Furnizor + „Cod, de la" prefix + set complet de parametri), care are deja și un mecanism de **salvare ca șablon** pentru seturi de parametri reutilizabile. Confirmă design-ul `SCOPE=PREFIX` din `CCCMINMAXPARAMS` (secțiunea 2 din Plan), dar adaugă o cerință UI nouă: **șabloane numite**, nu doar o singură valoare activă per prefix — vezi Faza 0/Faza 5 din [PLAN_IMPLEMENTARE.md](../PLAN_IMPLEMENTARE.md).

---

# PARTEA II — FORMULE

## 3. Fluxul complet de calcul

### F1 — Eligibilitate (ciclu de viață)

$$
\text{LIFECYCLE} =
\begin{cases}
\text{STANDARD} & \text{dacă } \mathrm{SAPT\_VZ} \geq 3 \ \wedge\ \mathrm{SAPT\_FARA} \leq \mathrm{PRAG\_REC} \ \wedge\ \mathrm{VZ_{52S}} > 0 \\[4pt]
\text{NOU/REACTIVAT} & \text{dacă } \mathrm{SAPT\_8S} \geq 2 \ \wedge\ \mathrm{VZ_{26S}} > 0 \\[4pt]
\text{ON DEMAND} & \text{altfel}
\end{cases}
$$

`SAPT_VZ` = **frecvență** (număr de săptămâni distincte cu vânzări din 52).
`SAPT_FARA` = **recență** (săptămâni scurse de la ultima vânzare).

**`PRAG_REC` diferă pe locație:** `39` pentru HQ, `26` pentru filiale — conform specificației §3.5. Documentele noastre de analiză au folosit, din eroare, `39` peste tot; pragul mai strict la filiale reduce populația `STANDARD` acolo.

Cele două condiții nu sunt redundante: un articol cu vânzări grupate acum 45 de săptămâni trece de `SAPT_VZ ≥ 3`, dar cade la pragul de recență.

### F2 — Clasificare ABC (în interiorul grupei)

$$
\mathrm{ABC} = \begin{cases}
A & \text{cumulativ}(\mathrm{VAL_{52S}}) \leq 80\% \\
B & 80\% < \text{cumulativ} \leq 95\% \\
C & \text{cumulativ} > 95\%
\end{cases}
$$

Cumulativul se calculează **partiționat pe (filială, grupă de produs)**.

### F3 — Clasificare XYZ

$$\mathrm{CV} = \frac{\text{StdDev}(\text{vânzări lunare}_{[12]})}{\text{Mean}(\text{vânzări lunare}_{[12]})}$$

$$\mathrm{XYZ} = \begin{cases} X & \mathrm{CV} \leq 0{,}5 \\ Y & 0{,}5 < \mathrm{CV} \leq 1{,}0 \\ Z & \mathrm{CV} > 1{,}0 \end{cases}$$

**Forțare la Z** dacă: o lună concentrează > 60% din `VZ_52S`, **sau** există < 2 luni cu vânzări, **sau** clasa este `NOU`/`OD`.

$$\mathrm{CLASA} = \mathrm{ABC} \oplus \mathrm{XYZ} \quad \text{(ex. } \mathrm{AX},\ \mathrm{BZ},\ \mathrm{CY}\text{)}$$

Override: `NOU/REACTIVAT` → `CLASA = "NOU"`; `ON DEMAND` → `CLASA = "OD"`.

### F4 — Cerere medie ponderată

$$
\mathrm{AVG} =
\begin{cases}
\mathrm{VZ_{4S}} \cdot 0{,}30 + \dfrac{\mathrm{VZ_{13S}}}{3} \cdot 0{,}40 + \dfrac{\mathrm{VZ_{26S}}}{6} \cdot 0{,}15 + \dfrac{\mathrm{VZ_{52S}}}{12} \cdot 0{,}15 & \text{STANDARD} \\[10pt]
\dfrac{\mathrm{VZ_{13S}}}{3} & \text{NOU/REACTIVAT}
\end{cases}
$$

Ferestrele sunt **normalizate la lună** (împărțite la 3, 6, respectiv 12) — ponderile se aplică unor mărimi comparabile. Rezultatul este o cerere lunară.

### F5 — Componentele bufferului

> ✅ **`[D]` Confirmat de client prin e-mail (14.08.2026, Constantin Oprea).**
> `Spec_ERP_MinMax_v5_FINAL.docx` §3.9 folosea o **aproximare** a variabilității cererii:
> `safety = (AVG × 0,30 / 30) × SSF × sqrt(LT)`, cu `SSF` între 1,28 și 1,65 per prefix de furnizor.
> Clientul confirmă înlocuirea ei cu deviația standard reală `σ_WK`, prezentată mai jos — propunerea provine dintr-o revizie internă din 13.08.2026, pe baza sugestiei echipei din Italia, și este acum **metoda confirmată**, nu doar propunerea noastră.
>
> **Precizare din e-mail:** `σ_WK` se calculează pe seria de **vânzări săptămânale winsorizate la percentila 95** (aceleași date plafonate ca la restul motorului, nu o serie brută separată), iar **săptămânile fără vânzări (zero) intră în calcul** — vezi și I12 mai jos.
>
> Diferența nu este cosmetică: cu `σ` real, stocul de siguranță **crește** pentru articolele volatile (clasa Z) și **scade** pentru cele stabile (clasa X). Rămâne opțiunea implementării ambelor variante, comutabile printr-un parametru, dacă se dorește o rulare paralelă de validare (Partea VI) — dar formula implicită este acum cea reală.

$$\mathrm{ad} = \frac{\mathrm{AVG}}{30} \qquad \text{(consum zilnic mediu)}$$

$$\sigma_{\mathrm{WK}} = \text{STDEV.S}\big(\text{vânzări săptămânale winsorizate p95}_{[52]},\ \text{zerouri incluse}\big)$$

$$\mathrm{safety} = \sigma_{\mathrm{WK}} \times \mathrm{SSF} \times \sqrt{\frac{\mathrm{LT}}{7}} \qquad \text{(}\mathrm{SSF} = 1{,}28\ \text{flat)}$$

$$\mathrm{lt\_stock} = \mathrm{ad} \times \mathrm{LT}$$

$$\mathrm{slts} = \mathrm{lt\_stock} \times \left(\frac{100}{\mathrm{SL}} - 1\right)$$

$$\mathrm{buf} = \mathrm{safety} + \mathrm{slts} + \mathrm{lt\_stock}$$

**Coerență dimensională:** `σ_WK` este în bucăți/săptămână, iar `√(LT/7)` este adimensional pe bază săptămânală → `safety` rezultă în bucăți, aceeași unitate cu `lt_stock` și `cycle`.

`STDEV.S` = deviație standard **de eșantion** (numitor `n−1`), nu de populație.

### F6 — Cantitatea de ciclu

$$\mathrm{cycle} = \max\big(\mathrm{AVG} \times \mathrm{COV\_TGT},\ \ \mathrm{ad} \times \mathrm{FRECVENTA\_zile}\big)$$

**Excepție confirmată de client (14.08.2026, vezi E7):** pentru clasa **CZ** (`COV_TGT = 0`), `cycle = 0` strict — nu se aplică termenul `ad × FRECVENTA_zile`. `ENG_MAX` pentru CZ se reduce astfel la componenta de buffer (`MAX_raw = buf`).

### F7 — Stoc maxim, cu trei plafoane simultane

$$\mathrm{MAX\_raw} = \lceil \mathrm{buf} + \mathrm{cycle} \rceil$$

$$\mathrm{MAX\_inf} = \lceil \mathrm{MAX\_raw} \times 1{,}30 \rceil \qquad \text{(doar HQ; filialele nu se inflatează)}$$

$$\mathrm{CAP6} = \lceil \mathrm{AVG} \times 6 \rceil$$

$$\mathrm{VZ26\_CAP} = \begin{cases} \mathrm{VZ_{26S}} & \text{dacă } \mathrm{VZ_{26S}} > 0 \\ 9999 & \text{altfel} \end{cases}$$

$$\boxed{\mathrm{ENG\_MAX} = \min\big(\mathrm{MAX\_inf},\ \mathrm{CAP6},\ \mathrm{VZ26\_CAP}\big)}$$

### F8 — Stoc minim și cantitate de comandă

$$\boxed{\mathrm{ENG\_MIN} = \min\big(\max(\lceil \mathrm{buf} \rceil,\ \mathrm{MIN\_DOC}),\ \ \mathrm{ENG\_MAX}\big)}$$

$$\boxed{\mathrm{BUY\_QTY} = \max\big(0,\ \mathrm{ENG\_MAX} - \mathrm{STOC\_QTY} - \mathrm{ORD\_FURN}\big)}$$

`MIN_DOC` = cea mai mică cantitate de vânzare a articolului din ultimele 52 de săptămâni (unitatea minimă tipică de livrare), default 1. Se calculează din vânzări, nu este parametru separat.

### F9 — Reguli business, aplicate strict în această ordine

**Pasul 1 — Plafon HQ:**

$$\text{dacă } \mathrm{ENG\_MAX_{HQ}} > \Big(\sum_{\text{filiale}} \mathrm{ENG\_MAX}\Big) \times 1{,}5 \ \Rightarrow\ \mathrm{ENG\_MAX_{HQ}} = \Big\lceil \Big(\sum \mathrm{ENG\_MAX_{BR}}\Big) \times 1{,}5 \Big\rceil$$

Articolele cu `Σ ENG_MAX_BR = 0` **nu** se plafonează.

**Pasul 2 — Podea București** (aplicată pe valoarea HQ **deja plafonată**):

```
dacă ENG_MIN_HQ > 0:
    dacă articolul NU există în București:
        → se creează, cu ENG_MIN_BUC = ⌈ENG_MIN_HQ × procent_podea⌉
    altfel dacă ENG_MIN_BUC < ENG_MIN_HQ × procent_podea:
        → ENG_MIN_BUC = ⌈ENG_MIN_HQ × procent_podea⌉
    altfel:
        → nemodificat
```

Podeaua **nu scade niciodată** o valoare calculată independent.

**Pasul 3 — Multiplu de ambalare:**

$$\mathrm{BUY\_QTY_{final}} = \left\lceil \frac{\mathrm{BUY\_QTY}}{\mathrm{N\_PACK}} \right\rceil \times \mathrm{N\_PACK}$$

**Pasul 4 — Flag-uri externe:**

Specificația (§3.11) le tratează explicit ca **informative**: coloanele `BLOCAT`, `EXCLUDE` și `IN LICHIDARE` se populează din fișierul extern și se afișează în output, dar **nu modifică** `ENG_MIN`, `ENG_MAX` sau `BUY_QTY`.

| Flag | Conform specificației §3.11 | Varianta din analizele noastre |
|---|---|---|
| În lichidare | niciun efect — doar marcare | `BUY_QTY = 0` |
| Blocat furnizor | niciun efect — doar marcare | `MIN = MAX = BUY = 0` |
| Exclus | niciun efect — doar marcare | `MIN = MAX = BUY = 0` |

> ⚠️ **De confirmat:** documentele noastre de analiză au preluat varianta cu zero-uire, care **contrazice** §3.11. Vă rugăm să confirmați care variantă se implementează. Vezi și E15 pentru riscul concret al variantei „doar marcare".

### F10 — Indicatori de raportare

$$\mathrm{ACOP\_CUR} = \frac{\mathrm{STOC\_QTY}}{\mathrm{AVG}} \qquad \text{(luni de acoperire cu stocul curent)}$$

$$\mathrm{FLAG} = \frac{\mathrm{ENG\_MAX}}{\mathrm{ERP\_MAX}}, \qquad \mathrm{ERP\_MAX} = \mathrm{MAX\_MANUAL}$$

> **Confirmat de client (14.08.2026):** `ERP_MAX` este strict `MAX_MANUAL` (valoarea introdusă manual în ERP), **nu** `max(MAX_MANUAL, MAX_CALCULAT)` cum propuneau analizele noastre anterioare. Comparația `FLAG` se face deci față de ce a stabilit omul, nu față de ce a scris deja motorul auto (`CCCMINAUTO`/`CCCMAXAUTO`) la o rulare anterioară.

| Interval FLAG | Interpretare |
|---|---|
| 0,77 – 1,30 | ✓ Engine și ERP aliniate |
| 1,30 – 2,00 | ↑ Engine recomandă mai mult |
| 0,50 – 0,77 | ↓ Engine recomandă mai puțin |
| > 2,00 | ⚠ Diferență majoră — analiză necesară |
| < 0,50 | ⚠ Posibil suprastoc în ERP |

`STATUS` — trend `VZ_13S` vs. `VZ_26S`: > +10% `ACTIVE` · −10%…+10% `STABLE` · −30%…−10% `TREND DOWN` · < −30% `DECLINE`.

`DISC_FLAG` — setat dacă `AZI − LAST_RECEIPT > 365` zile (posibil discontinuat la furnizor).

---

## 4. Parametri

### Matricea de acoperire `COV_TGT`

| CLASA | COV_MARE | COV_MEDIU | COV_MIC |
|---|---|---|---|
| AX | 2,75 | ⚠️ *de stabilit* | 1,25 |
| AY | 2,50 | ⚠️ *de stabilit* | 1,10 |
| AZ | 2,00 | ⚠️ *de stabilit* | 0,95 |
| BX | 2,50 | ⚠️ *de stabilit* | 1,25 |
| BY | 2,00 | ⚠️ *de stabilit* | 1,00 |
| BZ | 1,75 | ⚠️ *de stabilit* | 0,50 |
| CX | 2,00 | ⚠️ *de stabilit* | 0,75 |
| CY | 1,50 | ⚠️ *de stabilit* | 0,50 |
| CZ | 0 | ⚠️ *de stabilit* | 0 |
| NOU | 0,75 | ⚠️ *de stabilit* | 0,75 |

Până la stabilirea coloanei `MEDIU`, aceasta va fi egală cu `MIC` — comportament identic cu separarea binară actuală.

> ✅ **Confirmat de client (14.08.2026):** matricea `COV_TGT` este complet **parametrizată și editabilă manual** (nu doar valorile din tabel, ci și maparea filială → categorie). Beneficiarul poate muta oricând o filială din `MARE` în `MEDIU`/`MIC` (sau invers), în funcție de propria evaluare de business — nu există o regulă fixă de încadrare derivată automat din date. Acoperit deja de modelul de date (`CCCMINMAXCOV` pentru matrice, `CCCMINMAXBRANCH.MARIME` pentru mapare) și de panoul UI `minmax-params-panel.js` (editare parametri + matrice COV + configurare filiale). Rămâne deschisă doar completarea valorilor concrete pentru coloana `MEDIU`.

> ⚠️ **De confirmat (I2 din analiza anterioară):** `CX = 2,00` este mai mare decât `BY = 2,00` și decât `BZ = 1,75`. Un articol din clasa C, dar cu cerere stabilă, primește acoperire mai mare decât unul din clasa B cu cerere volatilă. Este deliberat?

### Alți parametri

| Parametru | Valoare | Domeniu |
|---|---|---|
| `SSF` | **1,28 flat** | z-score ≈ 90% nivel serviciu |
| `SL` per clasă ABC | 95% / 85% / 75% | A / B / C |
| `LT_zile` | per prefix furnizor | 7 – 90 |
| `FRECVENTA_zile` | per prefix furnizor | 7 – 30 |
| Percentila de winsorizare | 0,95 | configurabil |
| Prag minim linii pentru winsorizare | 8 | configurabil |
| `procent_podea` București | 30% | configurabil |
| Inflație HQ | +30% | configurabil |
| Factor HQ CAP | 1,5 | configurabil |
| Plafon acoperire | 6 luni | configurabil |
| `N_PACK` | 1 (default) | per articol |

Toți parametrii se citesc dintr-un tabel de configurare — **nimic hardcodat în motor**.

---

# PARTEA III — CAZURI-LIMITĂ

Fiecare caz are un comportament propus. Vă rugăm confirmați sau indicați alternativa.

## 5. Date insuficiente sau degenerate

### E1 ✅ Articol cu retururi care anulează vânzările — confirmat (14.08.2026)
`VZ_52S = 0` după netting, deși au existat tranzacții.
**Propunere:** devine `ON DEMAND` → `MIN = MAX = BUY = 0`. Conform specificației (`VZ_52S > 0` este obligatoriu pentru STANDARD).
**Confirmat de client (14.08.2026):** se implementează comportamentul propus, fără alternativă.

### E2 ✅ Articol cu sub 8 linii de vânzare — rezolvat (14.08.2026)
**Propunere inițială:** nu se winsorizează (pragul din specificație). Consecință: o comandă unică de proiect la un articol cu 3 linii **nu** este plafonată și domină atât `AVG`, cât și `σ_WK`.
**Risc semnalat:** exact articolele rare sunt cele mai expuse la „tranzacții bombă".

**Decizie client (14.08.2026):** comenzile cu cantități foarte mari trebuie ponderate/coborâte indiferent de pragul de linii, ca să nu devină „standard" pentru un articol care de obicei se vinde în câteva bucăți. Confirmă riscul semnalat — **se cere tratament alternativ**, nu comportamentul din specificație.
**Implementare propusă:** coboară `WINSOR_MIN_LINII` sau aplică un plafon secundar (ex. plafonare la mediana istorică a articolului) și pentru SKU cu sub 8 linii, nu doar peste prag — parametrizat, fără hardcodare.

### E3 ✅ Vânzări perfect constante → `σ_WK = 0` — confirmat (14.08.2026)
**Propunere:** `safety = 0`. Bufferul rămâne `lt_stock + slts`. Matematic corect (variabilitate nulă), dar elimină complet rezerva de siguranță.
**Alternativă:** un plancher minim de siguranță (ex. `safety ≥ 1` pentru articolele STANDARD).
**Confirmat de client (14.08.2026):** se aplică plancărul minim, cu valoare concretă — dacă `σ_WK` calculat este 0, se ridică la **`σ_WK = 1,3`** (bucăți/săptămână) înainte de a intra în formula `safety`. Articolele cu istoric perfect constant primesc totuși o rezervă minimă de siguranță, nu zero.

### E4 ✅ Media lunară = 0 la calculul CV — confirmat (14.08.2026)
Împărțire la zero în `CV = σ/μ`.
**Propunere:** se forțează `Z` (regula „< 2 luni cu vânzări" acoperă majoritatea cazurilor).
**Confirmat de client (14.08.2026):** oricare din cele 3 criterii existente forțează clasificarea la `Z`, fără regulă separată pentru împărțirea la zero — o lună concentrează > 60% din vânzările anuale, **sau** există sub 2 luni cu vânzări reale, **sau** articolul e deja marcat `NOU`/`OD`.

### E5 ⚠️ Articol nou apărut în mijlocul ferestrei
Are 52 de bucket-uri, dar primele ~30 sunt zero prin **inexistență**, nu prin lipsă de cerere.
**Consecință:** `σ_WK` și `AVG` sunt diluate artificial în jos.
**Propunere:** pentru clasa `NOU/REACTIVAT` se folosește deja `AVG = VZ_13S/3`. Extindem principiul și la `σ_WK` — calculat doar pe săptămânile de la prima vânzare încoace?

## 6. Efecte ale plafoanelor

### E6 ⚠️ `VZ_26S = 0`, dar articolul e STANDARD
Posibil pentru un articol cu vânzări concentrate în prima jumătate a anului (`SAPT_FARA` între 27 și 39).
**Efect:** `VZ26_CAP = 9999` → plafonul „realitate recentă" **se dezactivează**, iar `ENG_MAX` e limitat doar de `CAP6`.
**Propunere:** comportament conform specificației, dar semnalăm articolele afectate într-o coloană dedicată, pentru revizuire manuală.

### E7 ✅ `COV_TGT = 0` (clasa CZ) — rezolvat (14.08.2026)
`cycle = max(AVG × 0, ad × FRECVENTA) = ad × FRECVENTA`.
**Efect (conform specificației):** ciclul **nu** devine zero — rămâne cantitatea corespunzătoare unei frecvențe de comandă.
**Confirmat de client (14.08.2026):** se aplică interpretarea alternativă — `cycle = 0` strict pentru clasa CZ, deci stoc limitat strict la nivelul bufferului (`ENG_MAX = buf`, fără componenta de ciclu). Se renunță la termenul `ad × FRECVENTA` pentru această clasă.

### E8 ⚠️ `MIN_DOC > ENG_MAX`
Un articol care se vinde doar în cantități mari (ex. minim 10 buc), dar cu cerere anuală mică.
**Propunere:** `ENG_MIN` se limitează la `ENG_MAX` (deja în formulă) → `MIN = MAX`. Articolul devine „comandă tot sau nimic".

### E9 ⚠️ `ENG_MAX = 0` pentru un articol cu stoc existent
Apare când `CAP6 = 0` (cerere sub prag de rotunjire) sau la flag de blocare.
**Efect:** `BUY_QTY = 0`, dar stocul existent rămâne neutilizat și nesemnalat.
**Propunere:** raportarea în coloana `STATUS` ca stoc mort potențial.

### E10 ⚠️ Stoc negativ în ERP
`STOC_QTY < 0` (erori de gestiune) → `BUY_QTY = MAX − STOC_QTY − ORD` devine **mai mare** decât `MAX`.
**Propunere:** `STOC_QTY` se tratează ca `max(0, STOC_QTY)` la calculul lui `BUY_QTY`, cu semnalarea articolului.

## 7. Reguli business

### E11 ✅ Podeaua București creează `MIN > MAX` — rezolvat (14.08.2026)
Regula ridică `ENG_MIN_BUC`, dar **specificația nu spune ce se întâmplă cu `ENG_MAX_BUC`**. Dacă `ENG_MIN_HQ × 30%` depășește `ENG_MAX_BUC` calculat independent, rezultă o inconsistență (minim peste maxim).
**Confirmat de client (14.08.2026):** în acest caz `ENG_MAX_BUC = ENG_MIN_BUC` (nu `max(ENG_MAX_BUC, ENG_MIN_BUC)` — maximul nu doar se aliniază la minim, ci devine strict egal cu el).

### E12 ✅ Articol auto-creat în București — rezolvat (14.08.2026)
Regula introduce codul lipsă cu `ENG_MIN_BUC = ⌈ENG_MIN_HQ × 30%⌉`, dar **nu definea `ENG_MAX_BUC`**.
**Propuneri:**
- **A.** `ENG_MAX_BUC = ENG_MIN_BUC` (strict minimul necesar)
- **B.** `ENG_MAX_BUC = ⌈ENG_MAX_HQ × 30%⌉` (același procent aplicat maximului)

**Confirmat de client (14.08.2026):** varianta **A** — `ENG_MAX_BUC = ENG_MIN_BUC` (egale, MIN=MAX), consecvent cu decizia de la E11.

### E13 ⚠️ Rotunjirea la `N_PACK` depășește `ENG_MAX`
`BUY_QTY` rotunjit în sus poate conduce la un stoc final peste maximul calculat.
**Propunere:** se acceptă depășirea (multiplul de ambalare este o constrângere fizică, nu una de optimizare). Alternativa — rotunjire în jos — riscă `BUY_QTY = 0` pentru articolele cu pachet mare.

### E14 ✅ Regula INJECTOR nu se poate exprima prin `N_PACK` — rezolvat (14.08.2026)
Regula „0 dacă MAX < 3, altfel minim 4" conține un **prag**, nu doar un multiplu. Câmpul `N_PACK` nu o poate reproduce ca atare.
**Confirmat de client (14.08.2026):** `N_PACK` înlocuiește complet Pack Rules-urile hardcodate pe categorie (DISC, BUCȘĂ, INJECTOR, PISTON/CĂMAȘĂ) — dacă `MTRL.MTRPACK` nu e completat pentru un SKU, `N_PACK = 1` (fără rotunjire, fără regulă de prag de rezervă). Nu mai există excepții separate pe categorie.

### E15 ⚠️ Articol în lichidare, blocat sau exclus — riscul variantei „doar marcare"
Conform §3.11, aceste flag-uri nu modifică valorile calculate (vezi F9, pasul 4).
**Risc:** dacă ERP-ul generează comenzi automate din `CCCMINAUTO`/`CCCMAXAUTO`, articolele în lichidare sau blocate la furnizor vor fi reaprovizionate automat — exact contrar intenției.
**Propunere:** valorile rămân calculate în raport, dar la **scrierea în ERP** articolele cu aceste flag-uri primesc `MIN = MAX = 0`. Astfel raportarea rămâne completă, iar efectul operațional este cel dorit.

### E16 ⚠️ București încetează să fie cea mai mare filială
Regula podelei presupune acest lucru implicit. Datele actuale o confirmă (124.898 linii care intră în statistici, față de 19.694 pentru următoarea filială), deci riscul e teoretic pe termen scurt.
**Propunere:** filiala-țintă a podelei devine parametru, nu constantă.

## 8. Clasificare

### E17 ⚠️ Grupă cu un singur articol
Cumulativul atinge 100% la primul articol → clasificat automat `A`.
**Propunere:** comportament acceptat (articolul este, prin definiție, cel mai important din grupa lui). Semnalăm grupele cu sub 5 articole.

### E18 ⚠️ Articol fără grupă atribuită
**Propunere:** se tratează ca o grupă distinctă „nedefinit". De verificat câte articole sunt în această situație înainte de prima rulare.

### E19 ⚠️ Egalități la pragul de 80%
Mai multe articole cu valoare identică la granița A/B produc o clasificare nedeterministă între rulări.
**Propunere:** ordonare secundară după codul articolului, pentru rezultate reproductibile.

### E20 ⚠️ Articol vândut într-o filială, fără fișă de stoc acolo
**Propunere:** se creează poziția în `MTRBRNLIMITS` la scrierea în ERP, analog mecanismului podelei.

---

# PARTEA IV — LACUNE METODOLOGICE CUNOSCUTE

Acestea nu sunt erori, ci abateri conștiente de la formula academică completă. Le documentăm pentru trasabilitate.

### L1 ⚠️ Variabilitatea lead time-ului este ignorată

Formula academică completă:

$$\mathrm{SS} = z \times \sqrt{E(L) \times \sigma_D^2 + E(D)^2 \times \sigma_L^2}$$

v5 folosește doar primul termen. Anterior, acest lucru era parțial compensat de un `SSF` conservator (până la 1,65); după trecerea la 1,28 flat, compensarea a dispărut. **Este acum principala abatere de la formula completă.**

### L2 ✅ Deviația standard reală — rezolvată odată cu confirmarea F5 (14.08.2026)
Proxy-ul `AVG × 0,30` din specificație este înlocuit cu `σ_WK` calculat din date, ceea ce face formula echivalentul exact al `SS = z × σ_D × √L` (primul termen din formula academică). Confirmat de client prin e-mail (14.08.2026) — vezi F5. Lacuna metodologică se închide: nu mai e vorba de o aproximație, ci de deviația reală.

### L3 ✅ Componenta `slts` acționează invers intenției teoretice — acceptată ca atare (14.08.2026)

$$\mathrm{slts} = \mathrm{lt\_stock} \times \left(\frac{100}{\mathrm{SL}} - 1\right)$$

| Clasă | SL | Multiplicator |
|---|---|---|
| A | 95% | **0,0526** |
| B | 85% | 0,176 |
| C | 75% | **0,333** |

Clasa C — cea mai puțin importantă — primește **de 6 ori** mai multă rezervă proporțională decât clasa A. Componenta se comportă ca o rezervă procentuală pentru incertitudine, nu ca un z-score.

**Confirmat de client (14.08.2026):** lacuna rămâne exact așa cum a fost surprinsă mai sus — clientul nu solicită nicio modificare a comportamentului `slts`. Se păstrează ca atare, fără corecție.

### L4 ✅ Nivel de serviciu uniform în `safety` — rezolvat (14.08.2026)

Cu `SSF = 1,28` pentru toate articolele, stocul de siguranță corespunde unui nivel de serviciu de ~90%, indiferent de clasă. Clasa A nu mai primește protecție statistică suplimentară.

> **Confirmat de client (14.08.2026):** rămâne așa cum a fost cerut inițial — `SSF = 1,28 flat` pentru toate clasele. Varianta variabilă per clasă (tabelul de mai jos) **nu se implementează**; rămâne doar ca alternativă documentată teoretic.

**Alternativa aliniată teoretic** (neaplicată, păstrată doar informativ), coerentă cu tabelul SL deja definit:

| Clasă | SL țintă | `SSF` corespunzător |
|---|---|---|
| A | 95% | 1,645 |
| B | 85% | 1,036 |
| C | 75% | 0,674 |

> **De confirmat:** `SSF` rămâne 1,28 flat, sau devine variabil per clasă ABC conform tabelului de mai sus?

---

# PARTEA V — CHECKLIST DE CONFIRMARE

| # | Subiect | Decizie necesară |
|---|---|---|
| F5 | `σ_WK` real în locul aproximării `AVG × 0,30` din §3.9 | ✅ Formula nouă (confirmat 14.08.2026, e-mail) |
| I12 | Zerourile intră în `σ_WK`, calculat pe date winsorizate p95 | ✅ Confirmat (14.08.2026, e-mail) |
| **F9** | **Flag-urile externe: informative (§3.11) sau zero-uiesc valorile?** | **Informative / Zero-uire** |
| **I7** | **Atribuirea vânzării: filiala documentului, a agentului, sau a clientului (`TRDBRANCH`)?** | **Document / Agent / Client (`TRDBRANCH`) — date: B↔C se suprapun 87,7%, A↔C doar 60,5%; recomandăm C** |
| **I6** | **HQ se dimensionează pe vânzările agregate la nivel de companie** | **Confirmat / Altfel** |
| F1 | `PRAG_REC` = 39 la HQ și 26 la filiale — se păstrează? | Da / Nu |
| I5 | Excludere `MECDI2` (Dubhe Bulgaria) | ✅ Nu (confirmat 14.08.2026) |
| I8 | Includere VOLUNTARI (1.161 linii) și RM. VÂLCEA (1.611 linii) | Da / Nu |
| I10 | ABC relativ la grupă, chiar și pentru grupa `LOCALE` (22.159 SKU) | Confirmat / Revizuit |
| I11 | Ordinea `winsorizare → netting`, conform §3.2–3.3 | ✅ Confirmat (14.08.2026) |
| I14 | Există istoric recepții pentru calculul `σ_LT`? | Da / Nu |
| F10 | `ERP_MAX` = `MAX_MANUAL` (nu `max(MAX_MANUAL, MAX_CALCULAT)`) | ✅ Confirmat (14.08.2026) |
| — | Matricea `COV_TGT` + maparea filială → MARE/MEDIU/MIC editabile manual de beneficiar | ✅ Confirmat (14.08.2026) |
| — | Valorile `COV_MEDIU` + maparea filială → MARE/MEDIU/MIC | Tabel de completat |
| — | `CX = 2,00 > BZ = 1,75` — deliberat? | Da / Corectat |
| E2 | Tratament pentru articolele cu < 8 linii | ✅ Alternativă (confirmat 14.08.2026: se plafonează chiar și sub prag) |
| E1 | Articol cu retururi care anulează vânzările → `ON DEMAND` | ✅ Confirmat (14.08.2026) |
| E3 | Plancher minim de siguranță când `σ_WK = 0` | ✅ Da (confirmat 14.08.2026) — plancher `σ_WK = 1,3` |
| E4 | Forțare la `Z` când media lunară = 0 (împărțire la zero în CV) | ✅ Confirmat (14.08.2026) |
| E7 | `cycle` la clasa CZ: `ad × FRECVENTA` sau 0? | ✅ Confirmat (14.08.2026) — `cycle = 0` strict |
| E11 | `ENG_MAX_BUC` când podeaua ridică MIN peste MAX | ✅ Confirmat (14.08.2026) — `MAX = MIN` |
| E12 | `ENG_MAX` pentru articolele auto-create în București | ✅ Confirmat (14.08.2026) — Varianta A, `MAX = MIN` |
| E14 | `N_PACK` înlocuiește complet regula INJECTOR? | ✅ Da (confirmat 14.08.2026) — gol → `N_PACK = 1` |
| **E15** | **Articolele cu flag: `MIN = MAX = 0` la scrierea în ERP?** | **Da / Nu** |
| L4 | `SSF` flat 1,28 sau variabil per clasă ABC? | ✅ Confirmat (14.08.2026) — rămâne flat 1,28 |

Pozițiile **îngroșate** au impact direct asupra rezultatelor numerice și sunt prioritare.

## Elemente care există doar în analizele noastre

Următoarele au fost consemnate de noi din email sau din ședințe și **nu apar în specificația scrisă**. Le implementăm parametrizat, cu revenire la comportamentul din specificație dacă nu le confirmați — dar reprezintă efort de dezvoltare pe o bază nesemnată:

| Element | În specificație |
|---|---|
| Câmpul `N_PACK` și importul din Excel | absent — §3.10 are Pack Rules fixe pe categorie (disc frână, bucșă, injector, piston) |
| Clasificarea filialelor `MARE`/`MEDIU`/`MIC` | absent — §3.7 are doar separarea binară `COV_HQ` / `COV_BR` |
| ABC-XYZ per grupă de produs, pentru Branch Replenishment | absent complet |
| Podeaua București cu auto-creare a codului lipsită | §3.10 are doar `ENG_MIN(Buc) ≥ ceil(ENG_MIN(HQ) × 0,30)` |

Pentru comparație, specificația dumneavoastră declară la §6 **doar două** puncte deschise: lista de filiale active și `CX > BY`. Restul documentului este formulat ca definitiv.

---

# PARTEA VI — CRITERII DE ACCEPTANȚĂ

1. **Rulare paralelă** motor Python vs. ERP, timp de 1–2 săptămâni.
2. **Criteriu inițial:** > 80% dintre articole cu `FLAG = ✓ OK`.

> ⚠️ **Pragul de 80% trebuie recalibrat — dar numai dacă se adoptă F5.** A fost stabilit pentru formula cu aproximarea `σ = AVG × 30%`. Trecerea la `σ_WK` real deplasează stocul de siguranță **în sus** pentru articolele volatile (clasa Z) și **în jos** pentru cele stabile (clasa X). Distribuția `FLAG` se schimbă structural, deci pragul nu mai este comparabil cu cel calibrat anterior. Dacă se păstrează formula din specificație, pragul rămâne valabil ca atare.

3. **Verificări suplimentare:**
   - reconcilierea `VZ_*` cu raportul Top ABC existent, pe același interval — atenție, Top ABC rulează implicit pe filiala **agentului**; dacă v5 alege filiala documentului (I7), cele două rapoarte vor diferi structural cu circa o treime, iar reconcilierea trebuie făcută pe același mod
   - confirmarea că winsorizarea nu modifică `VAL_52S` (deci ABC rămâne identic)
   - comparație `ENG_MIN`/`ENG_MAX` cu ieșirea motorului Python, pe un eșantion agreat

4. **Scrierea în ERP nu este automată.** Rezultatele se calculează și se inspectează; aplicarea în `MTRBRNLIMITS`/`MTRL` se declanșează manual, cu confirmare și cu posibilitate de revenire (valorile anterioare se salvează).

---

*Document pregătit pentru confirmare. Cifrele din ERP sunt un instantaneu la data de 14.08.2026 și se referă, unde nu se specifică altfel, la liniile de vânzare care intră în statistici (tip document cu indicatorii de statistică activi) — 241.285 de linii în ultimele 52 de săptămâni, din 669.756 înregistrări brute. Fiind date vii, ele se pot modifica ușor de la o rulare la alta.*
