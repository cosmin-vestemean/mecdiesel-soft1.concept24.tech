# Referinta beneficiar: calcul MIN/MAX v5 HYBRID

Data sintezei: 10.09.2026. Domeniu: exclusiv materialele primite in folderul din aceeasi data.

## 1. Statutul documentului si sursele

Acest document descrie ce a trimis beneficiarul, nu solutia existenta si nu o propunere de implementare. Nu foloseste codul, documentatia proiectului sau deciziile din discutii anterioare. Afirmatia beneficiarului ca metodologia nu ar trebui sa difere fata de discutii este context, nu o concluzie verificata aici.

Surse:

| ID | Fisier | Rol in aceasta referinta |
| --- | --- | --- |
| S | [SPEC_MINMAX_v5_implementare.docx](SPEC_MINMAX_v5_implementare.docx) | Specificatia declarata: obiectiv, inputuri, reguli, formule, output si acceptanta. Trimiterile `S 5.4`, de exemplu, indica sectiunile din documentul original. |
| C | [config_minmax.docx](config_minmax.docx) | Configuratie prezentata ca text YAML, cu parametri declarati ca decisi pentru 09.2026. Trimiterile indica cheile configuratiei. |
| X | [minmax_union_2.xlsx](minmax_union_2.xlsx) | Rezultatul numeric livrat, cu 14 foi de date, `SUMMARY` si `PARAMETRI`. Trimiterile de forma `HQ!M2` indica celule din acest fisier. |

Conventii de lectura:

- **Declarat**: regula sau valoare explicit prezenta in S ori C.
- **Observat**: continut efectiv prezent in X; nu dovedeste, singur, algoritmul care l-a produs.
- **De clarificat**: informatie lipsa, ambigua sau neconcordanta intre materialele beneficiarului. Nu este completata prin presupuneri.

**Limita importanta:** X este un raport cu valori statice, nu un model Excel cu formule. Nu contine formule de celula, foi ascunse, legaturi externe sau datele tranzactionale brute necesare recalcularii integrale. Formulele din prezenta referinta provin din S; exemplele din X se trateaza separat. Notele si comentariile Word nu adauga continut metodologic; documentele nu contin imagini sau obiecte incorporate care sa completeze formulele.

## 2. Sinteza cerintei beneficiarului

**Declarat, S 1 si S 10:** un serviciu batch saptamanal pentru Dubhe Romania SRL, independent de ERP Soft One, calculeaza pentru fiecare SKU si fiecare scope:

- `ENG_MIN`: pragul minim de stoc;
- `ENG_MAX`: nivelul maxim/tinta de stoc;
- `BUY_QTY`: cantitatea de aprovizionat dupa scaderea stocului si a comenzilor furnizor;
- indicatori de cerere, clasificare, acoperire, siguranta, valorizare si comparatie cu MIN/MAX manual.

Exista 14 scope-uri: HQ si 13 filiale. **HQ foloseste cererea totala a retelei**, iar o filiala foloseste numai vanzarile sale. Nu se confunda calculul HQ cu insumarea rezultatelor filialelor.

Motorul citeste exporturi ERP si o configuratie externa, editata de buyer. Nu scrie direct in ERP. Eventualul import al MIN/MAX in ERP este un pas separat, optional si controlat de buyer. Valorile manuale sunt referinta de comparatie; documentele nu declara un override general al rezultatului calculat cu valorile manuale.

Rezultatul asteptat este un fisier per rulare, denumit dupa modelul `minmax_union_<data>.xlsx`, cu 16 foi. Aceleasi inputuri si aceeasi configuratie trebuie sa produca acelasi output. Data sistemului nu stabileste ferestrele de calcul.

## 3. Contractul de intrare

### 3.1. Vanzari

**S 2.1:** minimum 52 de saptamani de istoric. Foaie `vanzari` sau `vanzari 2026`; optional se concateneaza exporturi separate pentru 2024 si 2025.

| Coloana originala | Semnificatie |
| --- | --- |
| `Data` | Data documentului; determina ancora temporala. |
| `Document` | Numar document, informativ; nu este cheia de compensare a retururilor. |
| `Cod` | SKU. |
| `Nume` | Denumire, utilizata ca fallback. |
| `Cantitate` | Cantitate, inclusiv valori negative pentru retururi. |
| `Valoare neta` | Valoare pentru clasificarea ABC. |
| `Cod client` | Cheie de netting. |
| `Branch` | Una dintre cele 13 filiale. |
| `Grupa` | Grupa de produs, utilizata ca fallback. |
| `AltRef` | Referinta alternativa pentru echivalente. |

### 3.2. Stoc si comenzi furnizor

**S 2.2:**

- `stoc raw total`, etichetat in sursa drept HQ/companie: coloane pozitionale `SKU`, `STOCK`, `SUPPORD`, `FIRST_IN`, `LAST_IN`, `COST_RON`, `COST_EUR`.
- `stoc raw filiale`: pivot SKU x Branch, cu o coloana per filiala si stocul curent ca valoare.

Documentul cere ulterior comenzi furnizor pe scope, dar nu descrie un input pentru comenzile pe filiala. Semnificatia exacta a stocului HQ fata de stocul companiei necesita confirmare; nu se presupune aici ca reprezinta exclusiv depozitul central.

### 3.3. Univers ERP si valori manuale

**S 2.3:** foile `min max raw HQ` si `MIn max raw filiale`, in baza de calcul sau intr-un export separat `old_min_max`, furnizeaza universul SKU si atributele `Cod`, `AltRef`, `Denumire`, `Grup Denumire`, `Nume Filiala`.

**S 2.4:** exportul manual contine `SKU`, `MIN MANUAL`, `MAX MANUAL`, `BRANCH`. Alimenteaza `MIN_MANUAL`, `MAX_MANUAL` si `FLAG`. Particularitate explicita: branch `HQ` sau `BUCURESTI` din manual se afiseaza pe scope-ul HQ. Aceasta mapare nu trebuie inlocuita tacit cu o mapare intuitiva pe filiala Bucuresti.

### 3.4. Flags si configuratie

**S 2.5:** exportul pentru lichidare/excludere/blocare contine `SKU`, `BLOCAT`, `EXCLUDE`, `IN LICHIDARE`. Valorile `DA`, `X`, `1`, `TRUE` activeaza flag-ul. S 6 permite activarea si din ERP, prin SAU cu fisierul extern.

**S 2.6 si C:** un singur fisier de configurare versionabil, extern ERP, in format YAML/JSON/XLSX, intretinut de buyer. C livreaza textul pentru varianta YAML, nu un fisier YAML separat. Exporturile brute enumerate mai sus nu sunt incluse intre cele trei fisiere primite.

## 4. Parametrii declarati

### 4.1. Globali, eligibilitate si coeficienti

Surse: S 3.1-3.5, S 5.4, S 6; cheile corespunzatoare din C.

| Parametru | Valoare declarata | Utilizare |
| --- | --- | --- |
| `EUR_RATE` / `eur_rate` | 5.25 RON/EUR | Valorizare. |
| `MARGIN_EST` / `margin_est` | 0.25 | Cost estimat din pret de vanzare. |
| `WINSOR_P` | 0.95 | Percentila de plafonare a cantitatilor pozitive. |
| `WINSOR_MIN_LINES` | 8 | Minimum de linii pozitive per SKU pentru winsorizare. |
| `RECENCY_HQ_WK` | 39 saptamani | Recenta maxima pentru STANDARD la HQ. |
| `RECENCY_BR_WK` | 26 saptamani | Recenta maxima pentru STANDARD la filiale. |
| `PODEA_BUCURESTI` | 0.40 | Podea a MIN Bucuresti raportata la MIN HQ. |
| `GROUP_EXCLUDE` | sir gol, OFF | Nicio grupa exclusa in configuratia declarata. |
| `STANDARD_MIN_SAPT` | 3 | Saptamani distincte cu vanzare in 52S. |
| `NOU_MIN_SAPT_8` | 2 | Saptamani distincte cu vanzare in ultimele 8S. |
| `nou_necesita_vz26` | `true` | NOU necesita si `VZ_26S > 0`. |
| `ABC_A`, `ABC_B` | 0.80; 0.95 | Praguri cumulative pe valoare, per grupa. |
| `XYZ_X`, `XYZ_Y` | 0.5; 1.0 | Praguri pentru coeficientul de variatie. |
| `force_z_luna_dominanta` | 0.60 | Peste 60% din cantitate intr-o luna impune Z. |
| `force_z_min_luni` | 2 | Mai putin de doua luni active impune Z. |
| `max_inflation_hq` | 1.30 | Inflatie MAX numai la HQ; filiale 1.00. |
| `cap6_mult` | 6 | Plafon de sase luni de medie. |
| `hq_cap_mult` | 1.5 | Plafon HQ fata de suma MAX a filialelor. |
| `n_pack_default` | 1 | Unitatea implicita de pack. |

Excluderi explicite:

- `EXCLUDE_CLIENTS = ["C.000003", "MECDIS"]`.
- `INTE79` ramane inclus. S 3.2 il identifica drept client extern real si mentioneaza aproximativ 7,2 milioane RON de cerere pierduta daca ar fi exclus; aceasta cifra este afirmatia sursei, nu un total recalculabil din pachet.
- `EXCLUDE_SKU_PREFIX = ["Disc.", "OTHER."]`.

Ponderi pentru STANDARD: `W4=0.30`, `W13=0.40`, `W26=0.15`, `W52=0.15`; suma este 1. S 3.4 mentioneaza si o alta varianta, numita ERP anti-dead-stock, cu 0.40/0.35/0.15/0.10, dar declara explicit ca **nu aceasta este ponderarea de productie MIN/MAX v5**.

| ABC | Factor de siguranta z | Service level SL, in procente |
| --- | --- | --- |
| A | 1.65 | 95 |
| B | 1.04 | 85 |
| C | 0.67 | 75 |

### 4.2. Filiale si lead time

Surse: S 3.6; C `filiale`; X `PARAMETRI!A59:C72`.

| Filiala / grup de filiale | Marime | LT efectiv |
| --- | --- | --- |
| BUCURESTI | MARE | LT furnizor; text `AL FURNIZORULUI` in S/X, `null` in C. |
| GALATI, CONSTANTA, TIMISOARA, CLUJ, IASI, BRASOV, ORADEA, PITESTI, PLOIESTI | MEDIU | 10 zile. |
| SIBIU, CRAIOVA, TG. MURES | MIC | 10 zile. |

C foloseste cheia `TG_MURES`, cu nota explicita ca branch-ul real este `TG. MURES`.

### 4.3. Acoperire tinta COV_TGT

Surse: S 3.7; C `coverage`; X `PARAMETRI!A46:E55`. Unitate: luni de acoperire.

| CLASA | HQ | MARE | MEDIU | MIC |
| --- | --- | --- | --- | --- |
| AX | 2.25 | 2.25 | 1 | 1 |
| AY | 2.00 | 2.00 | 1 | 1 |
| AZ | 2.00 | 2.00 | 1 | 1 |
| BX | 2.50 | 2.50 | 1 | 1 |
| BY | 2.25 | 2.25 | 1 | 1 |
| BZ | 2.25 | 2.25 | 1 | 1 |
| CX | 2.50 | 2.50 | 1 | 1 |
| CY | 2.25 | 2.25 | 1 | 1 |
| CZ | 1.50 | 1.50 | 1 | 1 |
| NOU | 1.00 | 1.00 | 1 | 1 |

OD nu are o acoperire necesara calculului: MIN/MAX/BUY sunt declarate zero si calculul se opreste pentru acest lifecycle.

### 4.4. Furnizori si prefixe

**Regula declarata, S 3.8 si C:** se alege cel mai lung prefix care se potriveste SKU-ului. De exemplu, `KNCORE` este mai specific decat `KN`, iar `MEC DN` decat `MEC`. `SSF=1.28` este pastrat informativ si **nu se foloseste in safety v5**.

Tabelul de mai jos transcrie **X**, nu completeaza tacit C. C contine doar 12 prefixe concrete si o mentiune ca restul listei trebuie preluat din parametrii furnizorilor.

| Rand PARAMETRI | PREFIX in X | Furnizor in X | LT_zile in X | FRECVENTA_ZILE in X |
| --- | --- | --- | --- | --- |
| 3 | MEC | MEC | 30 | 7 |
| 4 | IVP | IVP | 60 | 30 |
| 5 | FSEL | FSEL | 30 | 30 |
| 6 | CEI | CEI | 30 | 15 |
| 7 | KN | KNORR | 90 | 30 |
| 8 | KNCORE | KNK | 60 | 30 |
| 9 | MO | MO | 30 | 30 |
| 10 | FEBI | FEBI | 60 | 30 |
| 11 | FT | FT | 60 | 45 |
| 12 | WA | WA | 30 | 30 |
| 13 | LEMA | LEMA | 30 | 15 |
| 14 | NRF | NRF | 15 | 30 |
| 15 | COVI | COVI | 30 | 30 |
| 16 | GA | GA | 45 | 30 |
| 17 | ERV | ERV | 30 | 30 |
| 18 | ZF | ZF | 30 | 30 |
| 19 | SOL | SOL | 30 | 30 |
| 20 | AS | AS | 30 | 30 |
| 21 | PRO | PRO | 30 | 30 |
| 22 | FA | FA | 15 | 30 |
| 23 | MANN | MANN | 30 | 30 |
| 24 | EM | EMMERE | 30 | 30 |
| 25 | K | MS MOTORS | 45 | 30 |
| 26 | MX | MARTEX | 15 | 30 |
| 27 | XXL | XXL | 30 | 30 |
| 28 | BNR | BANNER | 30 | 30 |
| 29 | VL | VALEO | 30 | 30 |
| 30 | `GEW `, cu spatiu final | GEWINER | 60 | 30 |
| 31 | HA | HALDEX | 30 | 30 |
| 32 | HOBI | HOBI | 90 | 30 |
| 33 | MD | MEC | 45 | 30 |
| 34 | MEC DN | MEC | 90 | 30 |
| 35 | MOL | MOLLEBALESTRA | 30 | 30 |
| 36 | EX | ETRIFIX | 30 | 30 |
| 37 | WH | WHEELS | 30 | 60 |
| 38 | NIS | NISSENS AUTOMOTIVE A/S | 30 | 30 |
| 39 | TK | TIMKEN EUROPE THE TIMKEN COMPANY | 30 | 30 |
| 40 | DEFAULT | 14 | 30 | 30 |

**Nu sunt echivalente toate reprezentarile:** C declara `DEFAULT: LT=14, frecventa=30, furnizor="?"`, in timp ce X pune `14` in coloana Furnizor si `30` in LT. C mai foloseste numele PETRONAS, FORD si WABCO pentru FSEL, FT si WA; X foloseste FSEL, FT si WA. S/C mentioneaza 38 de prefixe; X contine 37 de prefixe concrete plus DEFAULT. Detaliile sunt pastrate ca neclaritati, nu corectate in aceasta sinteza.

### 4.5. Pack rules

Surse: S 3.9 si S 5.5; C `pack`.

| Familie | Regula declarata |
| --- | --- |
| Implicit | `N_PACK=1`. |
| Disc frana | Multiplu de 2. C da `match: ["DISC", "FRAN\|BRAKE"]`. |
| Bucsa / silentbloc | Minimum 4. C da `match: ["BUCSA\|SILENTBLOC"]`. |
| Piston / camasa | Multiplu de 4 sau 6. C da `match: ["PISTON\|CAMASA"]`. |
| Injector | Zero daca MAX < 3; altfel minimum 4. C da `match: ["INJECTOR"]`. |

Regulile se aplica pe ENG_MIN/ENG_MAX dupa formula de baza. Alegerea intre 4 si 6, directia rotunjirii la multiplu, precedenta familiilor si relatia cu plafoanele nu sunt precizate complet.

## 5. Metodologia de pregatire a cererii

### 5.1. Universul de SKU

**S 4.1:**

$$
master_{HQ}=SKU(stoc\ raw\ total)\cup SKU(min\ max\ raw\ HQ)
$$

Daca `min max raw HQ` lipseste, se completeaza din vanzari cu SKU care au `SAPT_VZ >= 3` SAU (`SAPT_8S >= 2` SI `VZ_26S > 0`). Scopul declarat este pastrarea articolelor cu stoc zero, dar vandute regulat.

Pentru o filiala:

$$
master_{BR}=SKU(stoc_{BR}>0)\cup SKU(ERP_{BR})\cup SKU(manual_{BR})\cup SKU(vanzari_{BR})
$$

S 4.1 conditioneaza fallback-ul HQ de lipsa sursei, in timp ce cazul limita S 9 vorbeste si despre lipsa unei linii individuale; diferenta ramane deschisa.

### 5.2. Ancora si ferestrele temporale

**S 4.2:** `AZI = max(Data)` din vanzari, nu data sistemului.

| Indicator | Fereastra declarata |
| --- | --- |
| VZ_4S | 28 zile calendaristice de la AZI. |
| VZ_8S | 56 zile. |
| VZ_13S | 91 zile. |
| VZ_26S | 182 zile. |
| VZ_52S | 365 zile. |
| VZ_13P | Fereastra anterioara, notata textual `[182..91)`, pentru trend. |

S nu defineste complet incluziunea capetelor intervalelor, impartirea celor 365 de zile in exact 52 de bucket-uri ori construirea celor 12 luni. Formula finala de TREND din S 7 nu foloseste VZ_13P.

### 5.3. Excluderi

**S 4.3:** se elimina SKU cu prefixele configurate si liniile clientilor exclusi. Daca `GROUP_EXCLUDE` este setat, se elimina grupa, rezolvata din `min max raw HQ`, cu fallback in vanzari.

### 5.4. Winsorizare si netting

**S 4.4-4.6:** retururile se compenseaza pe client, nu pe document. Pentru SKU, client si fereastra se insumeaza cantitatile si se limiteaza rezultatul inferior la zero. Astfel, retururile unui client nu reduc cererea altui client.

S 4.5 cere winsorizare dupa excluderi si inainte de calculul ferestrelor. Pentru fiecare SKU cu cel putin 8 linii pozitive:

$$
cap_{SKU}=Q_{0.95}(cantitati\ pozitive)
$$

$$
q'_{linie}=\begin{cases}\min(q_{linie},cap_{SKU}),&q_{linie}>0\\q_{linie},&q_{linie}\leq0\end{cases}
$$

Pentru un scope si o fereastra F, transcrierea matematica a netting-ului declarat este:

$$
VZ_F(SKU,scope)=\sum_{client}\max\left(0,\sum_{linie\in(SKU,scope,client,F)}q'_{linie}\right)
$$

**Valoarea neta nu se winsorizeaza.** ABC ramane bazat pe valoare. `VAL_52S` este descris drept suma valorii nete netate pe 52S.

S enumera netting-ul inainte de winsorizare, dar cere aplicarea plafonului la liniile pozitive inainte de ferestre. Formula de mai sus exprima cerinta de plafonare la nivel de linie inainte de agregarea ferestrelor; ordinea operationala exacta, populatia pentru p95 si metoda de interpolare a percentilei trebuie confirmate, nu deduse din numerotarea capitolelor.

### 5.5. Metrici de baza, per SKU si scope

**S 4.6:**

| Indicator | Definitie declarata |
| --- | --- |
| VZ_4S, VZ_8S, VZ_13S, VZ_26S, VZ_52S | Cantitate netata in fiecare fereastra. |
| VAL_52S | Valoare netata pe 52S, pentru ABC. |
| SAPT_VZ | Numar de saptamani ISO distincte cu net saptamanal > 0 in 52S. |
| SAPT_8S | Acelasi tip de numaratoare in ultimele 8S. |
| ULT_VANZ | Ultima vanzare; criteriul exact dupa retururi/plafonare nu este detaliat. |
| SAPT_FARA | `round((AZI - ultima_vanzare) / 7)`, in saptamani. |
| MIN_DOC | Cea mai mica cantitate pozitiva vanduta in 52S; implicit 1. |
| DEV_STD_SAPT | Deviatia standard saptamanala descrisa in sectiunea 7.1 de mai jos. |
| CV | Deviatie standard / medie pe 12 bucket-uri lunare din 52S. |
| Luni active si luna dominanta | Folosite pentru fortarea XYZ=Z. |

Netting-ul se face separat pe fiecare fereastra. Cantitatile rezultate nu trebuie presupuse automat aditive intre ferestre atunci cand retururile sunt in perioade diferite.

## 6. Eligibilitate si clasificare

### 6.1. Lifecycle, cu prioritate STANDARD

**S 4.7:** se testeaza in aceasta ordine:

1. `STANDARD` daca `SAPT_VZ >= 3`, `SAPT_FARA <= 39` la HQ sau `<= 26` la filiale, si `VZ_52S > 0`.
2. Altfel, `NOU/REACTIVAT` daca `SAPT_8S >= 2` si `VZ_26S > 0`.
3. Altfel, `ON DEMAND`: `ENG_MIN=ENG_MAX=BUY=0` si se sare restul calculului de baza.

NOU/REACTIVAT este deci definit prin activitate recenta, nu printr-o data de creare a articolului sau a primei receptii.

### 6.2. ABC

**S 4.8:** numai pentru STANDARD, pe `VAL_52S`, separat in fiecare grupa de produs. Se sorteaza descrescator si se calculeaza ponderea cumulata: A pana la 80% inclusiv, B pana la 95% inclusiv, C restul.

Nu este declarata o clasificare ABC globala pentru toate grupele. Nu este stabilita o regula suplimentara pentru egalitati, total de grupa zero sau pentru includerea in A a unui articol care singur depaseste 80%.

### 6.3. XYZ si clasa finala

**S 4.6 si S 4.8:** `CV = std / mean` pe 12 bucket-uri lunare.

- X daca CV <= 0.5.
- Y daca 0.5 < CV <= 1.0.
- Z daca CV > 1.0.
- Se forteaza Z daca luna dominanta reprezinta peste 60% din VZ_52S, exista mai putin de doua luni active sau lifecycle este NOU/OD.

`CLASA = ABC + XYZ` pentru STANDARD; override `NOU` pentru NOU/REACTIVAT si `OD` pentru ON DEMAND. Parametrii z si SL pentru NOU nu sunt explicit stabiliti, desi calculul safety/buffer pentru NOU ar avea nevoie de ei.

## 7. Formulele MIN/MAX/BUY

Toate formulele sunt pentru un SKU si un scope. `AVG` este o medie in luni-echivalent, `ad` este cerere zilnica, LT si frecventa sunt in zile, iar safety/buffer/MIN/MAX/BUY sunt cantitati. `ceil` inseamna rotunjire in sus la intreg; specificatia nu ofera o conventie completa pentru toate celelalte rotunjiri.

### 7.1. Deviatia standard saptamanala

**S 5.1:** `STDEV.S` pe **52 de bucket-uri saptamanale**, dupa winsorizare, cu saptamanile fara vanzari incluse ca zero. Nu este deviatie pe linii de document si nici doar pe saptamanile active.

$$
s_1=\sum_w x_w,\qquad s_2=\sum_w x_w^2
$$

$$
\sigma_{sapt}=\sqrt{\frac{\max(0,s_2-s_1^2/52)}{51}}
$$

Zerourile nu schimba sumele, dar N ramane 52, iar numitorul pentru varianta de esantion este 51. Pentru cerere perfect constanta, sigma si safety sunt zero.

### 7.2. Media ponderata

**S 5.2 si C `avg_weights`:**

$$
AVG_{STANDARD}=0.30\,VZ_{4S}+0.40\,\frac{VZ_{13S}}{3}+0.15\,\frac{VZ_{26S}}{6}+0.15\,\frac{VZ_{52S}}{12}
$$

$$
AVG_{NOU/REACTIVAT}=\frac{VZ_{13S}}{3},\qquad AVG_{ON\ DEMAND}=0
$$

Ferestrele sunt suprapuse; nu sunt patru intervale disjuncte. S trateaza 4S ca o luna-echivalent, iar celelalte ferestre sunt impartite la 3, 6 si 12, exact ca mai sus.

### 7.3. Lead time efectiv

**S 5.3:**

$$
LT_{eff}=\begin{cases}LT_{furnizor(prefix)},&scope=HQ\\LT_{filiala},&LT_{filiala}\ este\ numeric\\LT_{furnizor(prefix)},&LT_{filiala}\ este\ text\ sau\ gol\end{cases}
$$

Ultimul caz inseamna acelasi LT al furnizorului ca primul. LT efectiv se foloseste in toate cele trei componente: safety, lt_stock si slts. Filialele cu LT numeric sunt tratate ca aprovizionate prin transfer din HQ.

### 7.4. Buffer si stoc de ciclu

**S 5.4:**

$$
ad=\frac{AVG}{30}
$$

$$
safety=z(ABC)\,\sigma_{sapt}\sqrt{\frac{LT_{eff}}{7}}
$$

$$
lt\_stock=ad\,LT_{eff}
$$

$$
slts=lt\_stock\left(\frac{100}{SL(ABC)}-1\right)
$$

$$
buf=safety+lt\_stock+slts
$$

$$
cycle=\max(AVG\,COV_{TGT},\;ad\,FRECVENTA_{zile})
$$

SL este 95/85/75, nu 0.95/0.85/0.75 in aceasta formula. SSF nu se inmulteste in safety. COV depinde de clasa si de marimea locatiei. Formula nu declara o frecventa separata pentru transferuri la filiale; referinta sa este frecventa furnizorului configurat.

### 7.5. MAX si MIN de baza

**S 5.4:**

$$
MAX_{raw}=\lceil buf+cycle\rceil
$$

$$
MAX_{inf}=\begin{cases}\lceil1.30\,MAX_{raw}\rceil,&HQ\\MAX_{raw},&filiala\end{cases}
$$

$$
CAP6=\lceil6\,AVG\rceil,\qquad VZ26_{CAP}=\begin{cases}VZ_{26S},&VZ_{26S}>0\\9999,&altfel\end{cases}
$$

$$
ENG_{MAX}=\min(MAX_{inf},CAP6,VZ26_{CAP})
$$

$$
ENG_{MIN}=\min\left(\max(\lceil buf\rceil,MIN_{DOC}),\;ENG_{MAX}\right)
$$

Cele trei plafoane MAX se aplica simultan. Valoarea 9999 este fallback-ul literal din specificatie, nu un infinit matematic. MIN este limitat de MAX in acest punct al fluxului.

Urmeaza pack rules din sectiunea 4.5, apoi BUY. Interactiunea pack rules cu plafoanele si cu integritatea MIN <= MAX nu este descrisa complet.

### 7.6. Cantitatea de aprovizionat

**S 5.6:**

$$
BUY_{QTY}=\max(0,ENG_{MAX}-STOC_{QTY}-ORD_{FURN})
$$

Stocul si comanda furnizor trebuie sa fie ale scope-ului respectiv. Formula nu scade `STOC_TOTAL_ALTREF`; acel camp este definit ca indicator separat, nu ca substitut automat pentru stocul SKU.

## 8. Reguli business dupa calculul tuturor scope-urilor

**S 6:** ordinea declarata este HQ CAP, podea Bucuresti, flags externe.

### 8.1. HQ CAP

$$
SUM_{BR\_MAX}=\sum_{cele\ 13\ filiale}ENG_{MAX,BR}
$$

Daca suma este pozitiva si MAX HQ depaseste 1.5 ori suma, se inlocuieste cu:

$$
ENG_{MAX,HQ}=\lceil1.5\,SUM_{BR\_MAX}\rceil
$$

Pentru `SUM_BR_MAX=0` nu se aplica plafonul. Apoi se limiteaza MIN HQ la noul MAX HQ si se recalculeaza BUY HQ.

### 8.2. Podea Bucuresti

Daca `ENG_MIN_HQ > 0`:

$$
tinta_{BUC}=\lceil0.40\,ENG_{MIN,HQ}\rceil
$$

Daca SKU lipseste in Bucuresti, se creeaza rand cu MIN egal cu tinta. Altfel, MIN Bucuresti devine maximul dintre MIN existent si tinta. Regula **doar ridica MIN**, nu il scade.

S nu precizeaza in acest pas ridicarea MAX Bucuresti, recalcularea BUY Bucuresti ori completarea celorlalte coloane ale unui rand nou. Nu se adauga aici asemenea reguli prin presupunere.

### 8.3. Flags

| Flag activ, din ERP SAU fisier extern | Efect declarat, HQ si toate filialele |
| --- | --- |
| IN LICHIDARE | BUY=0; MIN/MAX raman referinta. |
| BLOCAT | MIN=MAX=BUY=0. |
| EXCLUDE | MIN=MAX=BUY=0. |

Prin efectele declarate, blocarea sau excluderea anuleaza si MIN/MAX, chiar daca lichidarea este simultan activa. Nu este declarat un nou HQ CAP dupa aplicarea flag-urilor.

## 9. Output si indicatori derivati

### 9.1. Coloane, in ordinea declarata

**S 7; observat si in X:** fiecare foaie de date are 41 de coloane, antet pe randul 1.

| Pozitii Excel | Coloane, in ordine |
| --- | --- |
| A-H | SKU, GRUPA, DENUMIRE, LIFECYCLE, VZ_52S, VZ_26S, VZ_13S, VZ_4S |
| I-P | SAPT_VZ, SAPT_12S, ULT_VANZ, SAPT_FARA, AVG_POND, ABC, XYZ, CLASA |
| Q-X | COV_TGT, ENG_MIN, ENG_MAX, STOC_QTY, ORD_FURN, ACOP_CUR, BUY_QTY, TREND |
| Y-AF | STATUS, MIN_MANUAL, MAX_MANUAL, FLAG, FURNIZOR, STOC_VAL_EUR, COST_MED_RON, BUY_VALUE_EUR |
| AG-AO | LAST_RECEIPT, DISC_FLAG, BLOCAT, EXCLUDE, IN LICHIDARE, DEV_STD_SAPT, SAFETY, ALTREF, STOC_TOTAL_ALTREF |

`SAPT_12S` este numele efectiv al coloanei, desi criteriul NOU se bazeaza pe `SAPT_8S`. Nu se presupune ca reprezinta acelasi indicator. `VZ_8S`, `VAL_52S`, `MIN_DOC`, LT efectiv, frecventa, buf, cycle si plafoanele intermediare nu sunt coloane ale outputului declarat.

### 9.2. Acoperire, trend si status

**S 7:**

$$
ACOP_{CUR}=\frac{STOC_{QTY}}{AVG_{POND}}
$$

$$
TREND=100\,\frac{VZ_{13S}/3-VZ_{52S}/12}{VZ_{52S}/12}
$$

| Conditie declarata | STATUS |
| --- | --- |
| Trend > +10% | ACTIVE |
| -10% pana la +10% | STABLE |
| -30% pana la -10% | TREND DOWN |
| Trend < -30% sau VZ_13S=0 | DECLINE |
| NOU | NOU, mentionat ca status in enumerare. |
| OD | OK |

Limita comuna -10%, prioritatea lifecycle fata de DECLINE si impartirile cu numitor zero nu sunt precizate complet.

### 9.3. Comparatia cu manualul

**S 7:** `ratio = ENG_MAX / MAX_MANUAL`.

| Raport declarat | FLAG |
| --- | --- |
| 0.77-1.30 | OK |
| 1.30-2.0 | ENG>MAN |
| 0.50-0.77 | ENG<MAN |
| >2.0 | ENG>>MAN |
| <0.50 | ENG<<MAN |
| Fara manual | FARA MANUAL |

Nu sunt precizate toate incluziunile la 0.77/1.30, nici distinctia dintre manual absent si MAX manual explicit zero. Acest FLAG este comparatia definita de beneficiar intre rezultatul sau si valorile manuale, nu o comparatie cu aplicatia proiectului.

### 9.4. Receptie, echivalente si valorizare

**S 7 si S 9:**

$$
DISC_{FLAG}=\big((AZI-LAST_{RECEIPT})>365\ zile\big)
$$

`DISC_FLAG` este indicatorul definit din ultima receptie; nu trebuie confundat cu prefixul exclus `Disc.`. S nu declara ca acest indicator, singur, anuleaza MIN/MAX/BUY.

`ALTREF` reprezinta referinta alternativa. `STOC_TOTAL_ALTREF` este suma stocurilor SKU cu acelasi AltRef **in acelasi scope**. Pentru AltRef gol, se foloseste stocul propriu. Nu se declara consolidarea cererii sau calcularea MIN/MAX pe familie AltRef.

$$
STOC_{VAL\_EUR}=\frac{STOC_{QTY}\,COST_{MED\_RON}}{5.25}
$$

$$
BUY_{VALUE\_EUR}=\frac{BUY_{QTY}\,COST_{MED\_RON}}{5.25}
$$

Daca lipseste costul din stoc: `cost = pret_vanzare * (1 - 0.25)`. Daca lipseste si pretul, costul si valorizarile sunt zero. Alegerea pretului reprezentativ si agregarea costului mediu nu sunt detaliate.

### 9.5. SUMMARY si PARAMETRI

**S 7:** SUMMARY contine per scope numarul de SKU, eligibili, ON DEMAND, SKU cu BUY>0, suma BUY_QTY si suma BUY_VALUE_EUR; separat, totalul retelei de filiale. PARAMETRI trebuie sa pastreze configuratia folosita pentru audit.

Totalul HQ si totalul filialelor se raporteaza separat. Documentele nu definesc suma lor drept buget unic de achizitie externa.

## 10. Ce contine efectiv Excelul primit

### 10.1. Inventar si sumar livrat

**Observat, X:** 16 foi vizibile; 14 foi de date cu 41 de coloane; niciuna dintre foile Excel nu contine formule de celula. Datele de mai jos sunt valorile livrate in `SUMMARY`, nu o simulare a algoritmului.

| Scope | SKU | Eligibili | ON DEMAND | SKU cu BUY>0 | TOTAL BUY_QTY | TOTAL BUY_VALUE_EUR |
| --- | --- | --- | --- | --- | --- | --- |
| HQ | 47114 | 12116 | 34998 | 2945 | 19758 | 781819.71 |
| BUCURESTI | 28706 | 4112 | 24594 | 1293 | 7574 | 312044.59 |
| GALATI | 2966 | 1937 | 1029 | 646 | 2027 | 70806.75 |
| CONSTANTA | 1769 | 885 | 884 | 313 | 1038 | 57796.12 |
| TIMISOARA | 2050 | 1024 | 1026 | 372 | 1115 | 42323.97 |
| CLUJ | 1626 | 858 | 768 | 273 | 1172 | 45025.70 |
| IASI | 1210 | 584 | 626 | 175 | 474 | 40904.10 |
| BRASOV | 1874 | 996 | 878 | 377 | 1566 | 41291.50 |
| ORADEA | 2011 | 1088 | 923 | 371 | 1067 | 43833.02 |
| PITESTI | 1557 | 934 | 623 | 333 | 1020 | 35570.05 |
| PLOIESTI | 2507 | 1479 | 1028 | 524 | 1810 | 54843.19 |
| SIBIU | 852 | 417 | 435 | 134 | 356 | 27256.46 |
| CRAIOVA | 914 | 409 | 505 | 148 | 447 | 14328.24 |
| TG. MURES | 897 | 498 | 399 | 170 | 707 | 20930.90 |
| Total retea, numai filiale | - | - | - | - | 20373 | 806954.59 |

Trasabilitate: `SUMMARY!A3:G17`, total filiale la randul 19. Titlul `SUMMARY!A1` este literal `SUMMARY — MIN MAX HQ FILIALE 2027 (complete run)`. Eticheta 2027 nu este tratata drept anul ferestrei de calcul sau drept dovada a datei AZI.

### 10.2. Configuratia efectiv atasata rezultatului

`PARAMETRI` contine doar tabelele Mapare furnizori, coverage si FILIALE. Nu contine un dump integral al parametrilor din C: lipsesc, intre altele, ponderile AVG, excluderile clientilor, parametrii winsor, recenta, pragurile ABC/XYZ, z/SL si coeficientii HQ. Prin urmare, configuratia exacta cu care a fost produs X nu poate fi demonstrata integral din foaia PARAMETRI.

### 10.3. Limita demonstratiei numerice

X permite verificari aritmetice pe coloanele afisate, dar nu permite recalcularea completa a winsorizarii, netting-ului, ABC/XYZ, sigma ori MIN/MAX: lipsesc tranzactiile, bucket-urile si o parte din intermediari. Rotunjirea coloanelor afisate poate produce diferente fata de un calcul cu precizie integrala; o diferenta mica nu demonstreaza singura o regula diferita.

### 10.4. Verificari asupra intregului raport

**Observat prin parcurgerea tuturor celor 96.053 de randuri SKU x scope:**

- Cele 14 foi de date au antetul declarat de 41 de coloane, pe randul 1. Nu exista SKU duplicat in interiorul aceleiasi foi. Totalul de 96.053 nu inseamna 96.053 de produse distincte in companie.
- Numarul de randuri, eligibili (`STANDARD` + `NOU/REACTIVAT`), OD, SKU cu BUY pozitiv, suma BUY_QTY si suma BUY_VALUE_EUR rotunjita la cent reproduc SUMMARY pentru fiecare scope.
- Nu exista randuri cu ENG_MIN mai mare decat ENG_MAX in outputul primit.
- Cea mai recenta ULT_VANZ afisata este `2026-09-09`, de exemplu `HQ!K2`. Aceasta este compatibila cu o ancora in 09.09.2026, dar nu dovedeste max Data al inputului brut inainte de filtrari.
- Exista 7.991 de randuri OD cu MIN/MAX pozitive, toate in BUCURESTI. In toate aceste randuri MIN=MAX; in 7.653, MIN este exact `ceil(0.40 * MIN_HQ)` calculat cu MIN HQ final afisat. Nu se deduce o regula pentru celelalte 338 de cazuri.
- Exista 48.444 de randuri cu BLOCAT sau EXCLUDE activ; dintre acestea, 8.377 pastreaza MIN sau MAX pozitiv. Este o diferenta fata de efectul literal MIN=MAX=BUY=0 din S 6.
- Compararea izolata cu `max(0, MAX-STOC-ORD)` da 8.210 diferente BUY. Toate sunt pe randuri cu flag activ sau pe randuri OD din Bucuresti; 1.717 sunt OD Bucuresti fara niciunul dintre cele trei flags active. Aceste diferente nu sunt etichetate global ca erori: formula BUY trebuie citita impreuna cu lifecycle si regulile finale. Exemplele de mai jos arata de ce precizarea ordinii este necesara.
- Cele 784 de randuri NOU/REACTIVAT au ABC distribuit A=202, B=233, C=349. X atribuie deci litere ABC si pentru NOU; metoda de atribuire nu este explicata de regula S 4.8, care limiteaza ABC la STANDARD.

Pentru criteriul manual, folosind explicit `MAX_MANUAL > 0` ca baza masurabila, X are 227 de randuri la HQ, dintre care 16 cu FLAG=OK, aproximativ 7.05%. In toate scope-urile sunt 403 randuri cu MAX_MANUAL pozitiv si 20 cu FLAG=OK, aproximativ 4.96%. Acestea sunt ponderi ale etichetelor livrate, nu o recalculare a FLAG. Nu se poate afirma indeplinirea pragului de peste 80% din S 8 pe aceasta baza; nici reprezentativitatea manualului, ceruta de acel criteriu, nu poate fi stabilita din pachet. Randurile aceleiasi referinte in scope-uri diferite sunt numarate separat.

### 10.5. Exemplu HQ: medie, plafon si aprovizionare

**Observat:** SKU `FSOP601216886-205`, `HQ!A2`, produs DURA 46 HLP 205L.

| Campuri sursa | Valori |
| --- | --- |
| HQ!E2, F2, G2, H2 | VZ_52S=450; VZ_26S=299; VZ_13S=153; VZ_4S=44. |
| HQ!M2, N2, O2, Q2 | AVG=46.70; ABC=A; XYZ=X; COV=2.25. |
| HQ!AL2, AM2 | Sigma afisata=4.59; SAFETY=15.68. |
| HQ!R2, S2 | MIN=65; MAX=164. |
| HQ!T2, U2, W2 | STOC=19; ORD=96; BUY=49. |
| HQ!AE2, AF2 | COST_MED_RON=1885.0732; BUY_VALUE_EUR=17594.02. |

Media se reproduce direct:

$$
44(0.30)+\frac{153}{3}(0.40)+\frac{299}{6}(0.15)+\frac{450}{12}(0.15)=46.70
$$

**Reconstructie aritmetica limitata la valorile afisate:** SKU nu corespunde unui prefix concret din Mapare; X afiseaza FURNIZOR=`14`. Cu LT=30 din randul DEFAULT al X, safety calculata din sigma afisata este aproximativ 15.6786, compatibila cu 15.68. Cu LT=14 declarat in S/C, ar fi aproximativ 10.7105. Exemplul sustine existenta diferentei DEFAULT; nu transforma LT=30 in regula declarata corecta.

Folosind LT=30, SL=95, frecventa=30 si SAFETY afisata:

$$
ad=46.7/30,\quad lt\_stock=46.7,\quad slts=46.7(100/95-1)\approx2.4579
$$

$$
buf\approx64.8379,\quad cycle=\max(46.7\cdot2.25,46.7)=105.075
$$

Rezulta MAX_raw=170, MAX_inf=221, CAP6=281, VZ26_CAP=299: MAX de baza ar fi 221 in aceasta reconstructie.

Suma MAX afisate pentru acelasi SKU in cele 13 filiale este 109. Trasabilitate: BUCURESTI!S3=35; GALATI!S594=10; CONSTANTA!S3=13; TIMISOARA!S289=6; CLUJ!S287=5; IASI!S251=6; BRASOV!S282=6; ORADEA!S1449=0; PITESTI!S6=2; PLOIESTI!S439=11; SIBIU!S133=10; CRAIOVA!S610=0; TG. MURES!S163=5.

$$
HQ\ CAP=\lceil109\cdot1.5\rceil=164,\qquad BUY=164-19-96=49
$$

$$
BUY_{EUR}=49\cdot1885.0732/5.25\approx17594.02
$$

MIN afisat, 65, este compatibil cu ceil(buf)=65; MIN_DOC nu este livrat, deci aceasta componenta nu poate fi verificata independent. Pentru acelasi SKU, MIN Bucuresti este 26 la `BUCURESTI!R3`, egal cu `ceil(65*0.40)`. Nu sunt reconstituite tranzactiile sau valorile intermediare nerotunjite.

### 10.6. Exemple de filiala si NOU

**Filiala:** `GALATI!A2`, SKU `MEC 101250`, are VZ_52S=3, VZ_26S=2, VZ_13S=1, VZ_4S=1. Formula AVG da 0.520833..., afisata 0.52 la M2. Cu LT=10, SL=95 si SAFETY afisata=0.46, buf este aproximativ 0.64275; COV=1 si frecventa MEC=7 dau cycle aproximativ 0.52083. MAX_raw=2, CAP6=4, VZ26_CAP=2, deci MAX=2; X afiseaza MIN=1, stoc=0, comenzi=0 si BUY=2. MIN_DOC nu este disponibil pentru verificarea independenta a MIN.

**NOU:** `HQ!A11839`, SKU `20-CAT4196688`, are lifecycle NOU/REACTIVAT, VZ_13S=9 si AVG=3, conform `9/3`. In `HQ!N11839:P11839`, X afiseaza ABC=A, XYZ=Z, CLASA=NOU; SAFETY este 3.15, MIN=7, MAX=9 si BUY=9. Exemplul documenteaza rezultatul, dar nu stabileste regula generala de atribuire ABC pentru NOU.

### 10.7. Exemple ale diferentelor de reguli finale

**Blocare/excludere:** `HQ!A641`, SKU `00-.049038`, are BLOCAT=DA si EXCLUDE=DA in AI641/AJ641, dar MIN=3 si MAX=3 in R641/S641. BUY=0 in W641. Excelul pastreaza aici pragurile si anuleaza cumpararea; S 6 cere anularea tuturor celor trei valori.

**Podea si OD:** `BUCURESTI!A4114`, SKU `$B001M22B028`, este ON DEMAND, cu AVG=0, MIN=MAX=1, stoc=0, comenzi=0, BUY=0 si fara flags active. `HQ!R6655` pentru acelasi SKU este 1, iar `ceil(0.4*1)=1`. `BUCURESTI!A4115`, SKU `$B179M22A015`, are MIN=MAX=2, BUY=0, iar MIN HQ la R2563 este 3, cu `ceil(0.4*3)=2`. Rezultatele sunt compatibile cu o podea care ridica si MAX, mentinand BUY zero pentru OD, dar **aceasta regula completa nu este scrisa in S 6**. Trebuie confirmata, nu adoptata prin inferenta.

## 11. Neclaritati si neconcordante interne ale pachetului

Aceasta sectiune compara numai sursele beneficiarului intre ele. Nu stabileste care sursa are prioritate si nu propune modificari ale aplicatiei.

| ID | Punct de clarificat | Baza in materialele primite |
| --- | --- | --- |
| N01 | Care este fallback-ul real de furnizor: LT 14 sau 30? | S 3.8 si C `default_supplier` cer 14/30; X `PARAMETRI!B40:F40` pune Furnizor=14, Observatii=1, LT=30, SSF=1.28, frecventa=30. |
| N02 | Lista completa are 38 de prefixe concrete sau 37 plus DEFAULT? Cum se normalizeaza spatiile si numele furnizorilor? | C livreaza numai 12 prefixe concrete; X are 37 plus DEFAULT, prefix `GEW ` cu spatiu final si etichete FSEL/FT/WA diferite de PETRONAS/FORD/WABCO din C. |
| N03 | Care este ordinea exacta winsorizare/netting si populatia p95? | S 4 declara ordine stricta, enumera netting inainte de winsor, dar cere winsor pe linii pozitive inainte de ferestre. Nu stabileste daca p95 se obtine pe intreg istoricul sau pe 52S, global sau pe scope. |
| N04 | Cum se construiesc exact cele 52 de saptamani si cele 12 luni? | 365 de zile rolling pot intersecta mai mult de 52 de saptamani ISO si mai mult de 12 luni calendaristice, in timp ce S 5.1 fixeaza N=52. Lipsesc capetele intervalelor si conventia pentru std lunar. |
| N05 | Ce reprezinta SAPT_12S si la ce se foloseste VZ_13P? | S 4.7 foloseste SAPT_8S; S 7 si X au SAPT_12S. VZ_13P este mentionat pentru trend, dar formula TREND finala compara 13S cu 52S. |
| N06 | Ce ABC, z si SL se aplica NOU/REACTIVAT? | ABC este declarat numai pentru STANDARD, iar formula buffer cere z(ABC) si SL(ABC) inclusiv pentru NOU. C nu contine valori z/SL dedicate NOU. X atribuie NOU litere A/B/C, vezi 10.4 si 10.6. |
| N07 | Care este semantica exacta a regulilor de pack? | Nu se alege intre 4/6, nu se precizeaza rotunjirea, match-ul combinat, prioritatea familiilor, tratamentul zero si revalidarea plafoanelor dupa pack. |
| N08 | Ce se intampla daca podeaua Bucuresti face MIN mai mare decat MAX sau ridica MIN pentru OD? | S 6 modifica numai MIN si poate crea randuri noi; S 4.7 cere zero pentru OD. X are 7.991 de randuri OD Bucuresti cu MIN=MAX pozitiv, fara cazuri MIN>MAX. Exemplele 10.7 arata MAX ridicat si BUY ramas zero. |
| N09 | Fallback-ul HQ se aplica la fisier lipsa sau si la fiecare SKU absent? | S 4.1 conditioneaza fallback-ul de lipsa `min max raw HQ`; S 9 descrie SKU vandut, stoc zero si fara linie HQ. |
| N10 | Stocul HQ este stoc central sau stoc total de companie? De unde provin ORD_FURN pe filiala? | S 2.2 spune HQ/companie si livreaza pentru filiale doar pivot de stoc; S 5.6 cere stoc/comenzi pe scope. |
| N11 | Cum se trateaza exact pragurile si impartirile la zero? | Lipsesc cazurile AVG=0, baza TREND=0, MAX_MANUAL=0, limitele comune STATUS/FLAG, lipsa ultimei vanzari/receptii si regulile de rotunjire in afara ceil. |
| N12 | Cum se rezolva conflictele de metadata, duplicatele, costurile si flags ERP? | Exporturile sunt definite, dar nu toate regulile de agregare, precedenta pe atribute sau calcul al pretului/costului reprezentativ sunt explicite. Netting-ul valorii si al bucket-urilor necesita detaliere. |
| N13 | Configuratia C este chiar cea folosita pentru X si care este AZI? | X nu are dump complet si nu declara AZI in PARAMETRI; SUMMARY are titlu cu 2027, iar livrarea este din 09.2026. Data nu se deduce din titlu. |
| N14 | Nota CZ inseamna interdictie sau doar comentariu? | X `PARAMETRI!F54` spune `C-lent — nu stocăm`, dar aceeasi linie si S/C stabilesc COV pozitiv 1.50/1.00. Nu exista o regula explicita generala CZ => MIN/MAX zero. |
| N15 | BLOCAT/EXCLUDE trebuie sa anuleze si MIN/MAX sau doar BUY? | S 6 cere MIN=MAX=BUY=0; X contine 8.377 de randuri blocate/excluse cu praguri pozitive. Exemplu: HQ!A641. |
| N16 | Care este baza manuala reprezentativa pentru acceptanta? | Pe MAX_MANUAL>0, etichetele OK din X sunt 16/227 la HQ si 20/403 pe toate scope-urile, sub pragul declarat de peste 80%. Reprezentativitatea nu este demonstrata. |

## 12. Verificari si cerinte operationale declarate

### 12.1. Raport obligatoriu la fiecare rulare

**S 8:**

1. AZI efectiv, egal cu max Data vanzari.
2. Confirmarea includerii INTE79 si numarul de linii excluse pentru C.000003 si MECDIS.
3. Numarul de SKU plafonate prin winsorizare, cu minimum de linii aplicat.
4. Numarul de SKU master, STANDARD, NOU si OD.
5. Numarul de coduri adaugate prin fallback daca lipseste sursa HQ.
6. Totalurile BUY_QTY si BUY_VALUE_EUR pentru HQ, separat de suma filialelor.
7. Prezenta DEV_STD_SAPT, SAFETY, ALTREF, STOC_TOTAL_ALTREF si antetul pe randul 1 al foilor de date.
8. Acceptanta fata de manual: **peste 80%** dintre SKU cu manual trebuie sa aiba FLAG=OK, cand baza manuala este reprezentativa. Reprezentativitatea nu este definita numeric.

### 12.2. Cazuri limita explicite

**S 9:** stoc zero si SKU vandut trebuie tratat prin fallback in conditiile specificate; retururile care depasesc vanzarile unui client produc net zero; sigma zero produce safety zero; AltRef lipsa produce stoc alternativ egal cu stocul propriu; cost si pret lipsa produc valorizare zero; flags modifica rezultatul conform sectiunii 8.3.

S 9 scrie `BUY=ENG_MAX` pentru cazul de stoc zero. In raport cu formula generala S 5.6, egalitatea presupune si ORD_FURN=0, respectiv absenta flag-urilor care anuleaza BUY; aceste conditii nu sunt mentionate in formularea scurta a cazului limita.

### 12.3. Operare si performanta

**S 1, S 9 si S 10:**

- Rulare saptamanala automata, cron/task, cu exporturile in acelasi folder.
- Configuratie externa versionata; schimbarea unui parametru nu cere deploy.
- Output si configuratie pastrate pe saptamani pentru audit si comparatie W/W.
- Logging pentru pasii si verificarile de mai sus.
- Daca outputul este deschis in Excel la scriere, se salveaza cu sufix `_v2`, `_v3`.
- Tinta orientativa: aproximativ doua minute la circa 700.000 de linii de vanzari, 47.000 de SKU si 14 locatii.
- Stack recomandat, nu obligatoriu: Python 3.11, pandas/numpy, citire calamine, scriere xlsxwriter streaming, iterare pe tuple. Alte tehnologii sunt acceptate daca pastreaza formulele.

## 13. Concluzie de referinta

Materialele declara un calcul de cerere cu netting pe client si plafonare p95, eligibilitate prin frecventa/recenta, ABC per grupa, XYZ lunar, medie ponderata pe ferestre suprapuse si safety bazat pe 52 de saptamani cu zerouri incluse. MIN/MAX rezulta din buffer si ciclu, cu plafoane simultane, pack rules si ajustari finale HQ/Bucuresti/flags. BUY scade stocul si comenzile SKU-ului, nu stocul alternativ.

Aceasta este metodologia **declarata**. Excelul este o fotografie a rezultatelor, nu o demonstratie executabila a metodologiei. Punctele neclare raman explicit deschise; nu se afirma nici identitatea completa dintre cele trei surse, nici concordanta cu discutii sau implementari anterioare.