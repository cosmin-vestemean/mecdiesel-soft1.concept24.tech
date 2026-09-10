# MIN/MAX: matrice executabilă P1-P15 (Faza 1)

Data: 10.09.2026. Statut: artefact de planificare pentru o sesiune viitoare. Niciun SQL/AJS nu a fost modificat la redactarea acestui document; locațiile de cod sunt cele curente (verificate prin citire directă), nu presupuneri.

Scop: transformă registrul P1-P15 din [PLAN_ALINIERE_2026-09-10.md](PLAN_ALINIERE_2026-09-10.md) §3 într-o listă executabilă — locație exactă de cod, soluție propusă, parametru afectat, test țintă (T1-T6 din [MATRICE_COMPARATIVA_MINMAX_2026-09-10.md](MATRICE_COMPARATIVA_MINMAX_2026-09-10.md) §9, sau test nou) și dependențe. Nu autorizează implementarea — vezi „Decizii necesare înainte de cod" mai jos.

## Legendă clasă (din matrice, §2)

- **P**: parametru lipsă/diferit, mecanism deja disponibil.
- **M**: metodologie diferită; nu se repară doar completând valori.
- **I**: implementare lipsă, contract neconectat.
- **U**: neclaritate ce cere confirmare.
- **A**: aliniere, sub rezerva identității inputurilor.

## Registrul executabil

| # | Regulă (sursă matrice) | Clasă | Locație cod actuală | Soluție propusă | Parametru nou/afectat | Test | Dependențe / ordine |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Netting săptămânal apoi însumare (D12) | M | [01_classify.sql](../sql/01_classify.sql) secțiunea 5 „Netting per (Branch, TRDR, Mtrl, Week)" (L236); clip la zero per săptămână (L250 `GROUP BY BRANCH, TRDR, MTRL, WEEK_INDEX`), apoi VZ = sumă a neturilor săptămânale | Netting separat, pe toată fereastra per (SKU, scope, client); seria săptămânală rămâne DISTINCTĂ, păstrată doar pentru sigma | — (schimbare de query, nu parametru) | T1 | Restructurare secțiunile 5-8; precede P2 |
| P2 | Netting pe `TRDR`, nu `TRDR.CODE`; HQ din neturi de filială (D13) | M/U | Aceeași secțiune 5 (L239/L250 `GROUP BY BRANCH, TRDR, MTRL, WEEK_INDEX`), plus L277 `CROSS JOIN #ActiveBranches hq` (HQ = sumă a filialelor deja netate) | **Cheia de netting: DECISĂ = `TRDR`** (10.09.2026, motiv: mai safe — nu unifică înregistrări distincte de client sub același `CODE`). Codul actual netează deja pe `TRDR`, deci nu e nevoie de parametru `NETTING_CHEIE`; opțiunea `CODE` nu se implementează. HQ ca scope propriu rămâne decizie Z1/Z2 — NU implementat tacit | — (comportament curent confirmat ca definitiv) | T1 (doar regresie: cheia rămâne `TRDR`) | După P1; **rămâne deschis doar HQ scope**, care necesită decizie explicită înainte de cod |
| P3 | ABC pe toate lifecycle-urile, cumul precedent (C02/C03) | M | [01_classify.sql](../sql/01_classify.sql), `Step2_AbcPareto` / `Step3_AbcClassified`, și implementarea duplicată din [02_classify_group.sql](../sql/02_classify_group.sql); populația include NOU/OD, iar comparația folosește cumulul precedent | **DECIS (10.09.2026)**: ambele schimbări, în **doi commiți separați**, cu validare între ei, și ambele comutabile: (a) `ABC_CONVENTIE_CUMUL` = `INCLUSIV` sau `PRECEDENT`; (b) `ABC_POPULATIE` = `STANDARD` sau `TOATE`. `ABC_PRIM_ARTICOL_A=1` acordă `A` primului articol eligibil cu `VAL_52S > 0`; grupa cu total zero rămâne `C`. Comutatorul este **GLOBAL** și se aplică uniform tuturor partițiilor ABC, inclusiv HQ; nu primește override per filială/prefix | **3 chei globale noi:** `ABC_CONVENTIE_CUMUL` (default `INCLUSIV`), `ABC_POPULATIE` (default `STANDARD`), `ABC_PRIM_ARTICOL_A` (default `1`) | T2 | Se modifică obligatoriu atât Classify, cât și ClassifyGroup; re-validare după fiecare commit. Pe `PRECEDENT`, `ABC_PRIM_ARTICOL_A` nu schimbă rezultatul primului articol eligibil, al cărui cumul precedent este zero |
| P4 | Univers = vânzări × filiale, cross join dens (D02/D03) | M/I | `#Items` (L286-291, derivat exclusiv din `#WinsorizedLines`); `CROSS JOIN #ActiveBranches` (L348; singurul alt cross join e L277, pentru HQ) | Extinde `#Items` cu uniuni din stoc/ERP/manual, nu doar vânzări eligibile | — (restructurare univers) | T7 (nou) | Cea mai mare schimbare structurală; afectează volumul CCCMINMAXDET; independent de P1-P3 dar de secvențiat după parametrizarea P6/P7 |
| P5 | BUY fără gardă OD după podea (F10) | M/U | [03_compute.sql](../sql/03_compute.sql) L346-360 (`ENG_MAX0` respectă `LIFECYCLE='OD'⇒0`); BUY nu re-verifică lifecycle după aplicarea podelei | Dacă se decide că OD primește doar prag de prezentare, garda corectă este `WHEN LIFECYCLE='OD' THEN 0` în `BUY_RAW`; condiția pe `PODEA_APLICATA=0` ar fi un no-op și nu rezolvă exact cazul semnalat | — | T8 (nou) | Depinde de decizia „OD primește doar prag de prezentare sau și aprovizionare?" |
| P6 | Parametri operaționali globali, fără resolver per filială/prefix și fără selector de furnizor | I/P | `CCCMINMAXTEMPLATE` nu este citită; `CCCMINMAXBRANCH` nu păstrează parametri; Classify copiază aceleași valori globale pe toate filialele. UI/StartRun nu are selector de furnizor și motorul calculează întotdeauna toți `MTRSUP` | **OBLIGATORIU, politică mixtă (10.09.2026):** sesiunea normală rămâne `FULL`. Parametrii rigizi `NRSAPT`, pragurile lifecycle, `SIGMA_MIN` și `SL_A/B/C` sunt GLOBALI. `SSF` rămâne global, dar devine **doar informativ** și se elimină din formula safety. `LT_ZILE` și `FRECVENTA_ZILE` acceptă override-uri cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`; lipsa unui branch înseamnă lipsa interesului pentru override local, nu HQ implicit, deoarece HQ este explicit `BRANCH=1000`. Constanța lunară este recomandare UI + snapshot, nu blocare: utilizatorul poate reitera, iar fiecare RUNID îngheață configurația. Selectorul de furnizor la lansare este opțional, `ALL` implicit; o alegere filtrează pe `MTRL.MTRSUP`, creează scope `SUPPLIER`, este numai pentru analiză și nu devine sesiune curentă/aplicabilă ERP | Tabelă executabilă separată `CCCMINMAXPARAMOVERRIDE`; `CCCMINMAXTEMPLATE` rămâne doar conveniență UI. `CCCMINMAXRUNPARAM` este snapshot-ul unic. `CCCMINMAXRUN.MTRSUP` (NULL = ALL) și scope nou `SUPPLIER` | T9: HQ + două filiale, override branch/prefix și fallback; verifică valorile rezolvate din `DET` și snapshot. Test separat: rularea SUPPLIER conține doar MTRSUP ales și nu mută `ESTE_CURENT` | Implementarea per filială este neblocată. Partea de prefix necesită lista N5. P6 precede P4 și acceptanța finală |
| P7 | Praguri hardcodate 3/2/0.80/0.95/0.60/2/ponderi AVG (C11) | I | Valorile sunt duplicate în [01_classify.sql](../sql/01_classify.sql) și [02_classify_group.sql](../sql/02_classify_group.sql): lifecycle, ABC, forced-Z, praguri CV; ponderile AVG sunt în Classify | Extrage cheile declarate de beneficiar: `STANDARD_MIN_SAPT`, `NOU_MIN_SAPT_8`, `NOU_NECESITA_VZ26`, `ABC_A`, `ABC_B`, `XYZ_X`, `XYZ_Y`, `FORCE_Z_LUNA_DOMINANTA`, `FORCE_Z_MIN_LUNI`, plus ponderile AVG. Ambele proceduri consumă aceleași chei din snapshot-ul rulării | **10+ chei globale noi**, seed idempotent; `AVG_WEIGHT_4S/13S/26S/52S` rămân scalari separați. Cele 3 chei ABC din P3 sunt globale | — | Depinde de P3 și de migrarea snapshot-ului unic; se modifică obligatoriu atât Classify, cât și ClassifyGroup |
| P8 | `SIGMA_MIN` nedezactivabil (C05) | A/M | Fallback-ul `COALESCE(@SigmaMin,0)<=0` există în Classify și ClassifyGroup; Prepare îl duplică, dar procedura Prepare se retrage | **DECIS (10.09.2026):** parametru absent/NULL folosește fallback `1.3`; `0` este valid și produce safety zero; valoarea negativă sau nenumerică produce eroare de validare, nu fallback. Seed-ul rămâne `1.3` | `SIGMA_MIN`; validare la salvare și defensiv la StartRun | T3 | Se modifică sincron Classify și ClassifyGroup; `00d_prepare.sql` nu se aliniază, ci se retrage |
| P9 | `WINSOR_SUB_PRAG=MEDIANA` default (D11) | M, deja comutabil prin P | L110, parametrul există deja cu opțiunea `NONE` | **DECIS (10.09.2026): rămâne `MEDIANA`.** Beneficiarul s-a exprimat explicit (E2, 14.08.2026): cantitățile foarte mari se coboără *indiferent de pragul de linii*. `NONE` ar contrazice cererea. Mediana rămâne formula noastră de implementare a acelei cereri, nu o formulă dictată de client — se poate reglaja ulterior fără a redeschide decizia | `WINSOR_SUB_PRAG` rămâne `MEDIANA` | — | **Nimic de făcut** — P9 se închide fără modificări de cod sau de seed |
| P10 | Clamp stoc negativ (F09) | M | L457-458 `STOC_QTY > 0 THEN STOC_QTY ELSE 0` — clamp deja aplicat | Dacă decizia cere formula literală S (fără clamp): eliminare 2 linii; altfel confirmă comportamentul curent ca definitiv | — | T4 | Cost minim, dar cere decizia explicită înainte (nu se implementează varianta S fără aprobare) |
| P11 | TREND 13S/26S ca fracție (O05) | M | L470 `2.0 * VZ_13S / NULLIF(VZ_26S,0) - 1` | Parametru `TREND_BAZA` (`13_26`/`13_52`) cu formulă alternativă `100*((VZ13/3)/(VZ52/12)-1)`; adaugă prioritate lifecycle NOU/OD peste `STATUS_TREND` (azi absentă) | `TREND_BAZA` | T5 | Necesită și decizia unitate procent/fracție |
| P12 | `SL_B` pentru toate NOU (F02) | U + interpretare K | L590 `WHEN xc.LIFECYCLE = 'NOU' THEN @SlB` | Rămâne ca atare până la clarificarea explicită ABC/z/SL pentru NOU | — | — | Blocat pe întrebarea ABC/z/SL pentru NOU; referința anterioară la N6 era greșită, deoarece N6 privește excluderea de grupă |
| P13 | MIN_DOC global; SAPT_FARA în frontiere de săptămână (D15) | M/U | `#Items` (L286-291) calculează `MIN_DOC` per MTRL global, copiat tuturor filialelor (L348 cross join); `SAPT_FARA` (L307) e indexul primei săptămâni cu vânzare, nu `round(zile/7)` | Mutare `MIN_DOC` în agregarea per (BRANCH, MTRL) dacă se confirmă scope per filială; recalcul `SAPT_FARA` necesită definirea „ultimei vânzări" după retururi | — | — | Depinde de decizia de scope (global vs per filială) |
| P14 | Validatorul numără banda 0.50-2.00 (O13) | M | [validate-minmax-invariants.cjs](../tools/validate-minmax-invariants.cjs) raportează banda 0.50-2.00 pe populația curată | **DECIS (10.09.2026):** CLI raportează necondiționat trei metrici informative: **A** = 0.50-2.00 pe populația curată actuală; **B** = `FLAG_TXT='OK'` (.77-1.30) pe aceeași populație; **C** = criteriul literal S 8, `FLAG_TXT='OK'` pe toate rândurile cu `ERP_MAX>0`, fără filtre suplimentare de lifecycle/flags. La lansarea rulării, un switch `A/B/C` alege metrica evidențiată; nu schimbă motorul și adaugă doar parametrul de rulare + selectarea rezultatului raportat, deci complexitatea SQL este mică | `CALIBRARE_MOD` global per rulare, default `C` | T6 | CLI se poate implementa primul; switch-ul UI se leagă după snapshot-ul unic. Niciuna dintre metrici nu devine blocantă automat |
| P15 | Lipsuri: AltRef/STOC_TOTAL_ALTREF, costuri/EUR, 41 coloane, SUMMARY HQ separat, raport S 8 (O07-O12) | I | Nicăieri — indicatori lipsă, nu parametru | Tratare separată, în afara Fazei 1 „aliniere Z0/Z1" (fiecare sub-element are propriul I/U nerezolvat). Snapshot-ul complet al parametrilor nu mai aparține P15: este infrastructură obligatorie înainte de P3/P7 | — | — | Explicit AFARA din Faza 1, cu excepția snapshot-ului mutat înainte de P3/P7 |

## Decizii necesare înainte de a scrie orice cod

Decizii luate:

- **P2, cheia de netting (10.09.2026, reconfirmată)**: netting pe `TRDR`, nu pe `TRDR.CODE`. Confirmă comportamentul curent (L239/L250); `NETTING_CHEIE` iese din scope. **Abatere conștientă**: contractul de intrare al beneficiarului declară coloana `Cod client` drept „Cheie de netting" ([REFERINTA L54](REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md)), iar excluderile sunt deja implementate pe `TRDR.CODE` fiindcă `MECDIS`/`MECDI2`/`INTE79` au câte două înregistrări `TRDR`. Motorul rămâne deci cu excludere pe CODE și netting pe ID; consecință acceptată: un retur pe al doilea `TRDR` al aceluiași cod nu compensează vânzarea de pe primul.
- **P3, pragul ABC (10.09.2026)**: `A până la 80% **inclusiv**`, deci `<=`, nu `<` — conform S 4.8.
- **P7, numele parametrilor (10.09.2026)**: se folosesc cheile declarate de beneficiar, nu nume inventate de noi.
- **P8, autoritatea A2 (10.09.2026)**: `SIGMA_MIN = 0` explicit produce safety=0. Se distinge NULL de 0. Valoarea din seed rămâne `1.3`, parametrizată — alegerea între `1.3` și `0` se face din configurare, nu din cod.
- **Scope prima sesiune de implementare (10.09.2026, revizuit)**: retragerea lui Prepare, P14 CLI, P8, migrarea la snapshot-ul unic, P3 și P7. P9 rămâne închis fără cod. Netting, resolverul per filială/prefix și universul rămân pentru sesiuni ulterioare.
- **P9, decizia B1 (10.09.2026)**: rămâne `MEDIANA`, pentru că beneficiarul a cerut explicit (E2, 14.08.2026) plafonarea cantităților mari indiferent de pragul de linii. P9 se închide fără modificări.
- **P3 (10.09.2026)**: ambele schimbări ABC, în doi commiți separați, cu validare între ei, și ambele comutabile prin parametru. Toate cele trei comutatoare ABC sunt globale. Regula primului articol se aplică primului articol care contribuie la populația ABC selectată și are `VAL_52S>0`; totalul de grupă zero rămâne `C`. Classify și ClassifyGroup se modifică împreună.
- **P14 (10.09.2026, revizuit)**: validatorul CLI raportează A/B/C necondiționat. Switch-ul de la lansarea rulării selectează doar metrica evidențiată, nu schimbă formulele sau populația motorului. `MAX_MANUAL` = `ERP_MAX`; `ERP_MAX_AUTO` nu intră. Criteriul C folosește literal `ERP_MAX>0`, fără filtre suplimentare.
- **P6, politică mixtă per filială (10.09.2026, obligatoriu)**: aplicația veche este numai referință pentru nevoia de context local. Noul motor păstrează sesiunea `FULL`. `NRSAPT`, pragurile lifecycle, `SIGMA_MIN` și `SL_A/B/C` sunt globale; `SSF` este global și numai informativ; `LT_ZILE` și `FRECVENTA_ZILE` pot avea override per filială/prefix. HQ este explicit `BRANCH=1000`; absența unui branch nu înseamnă HQ. Constanța parametrilor rigizi pe parcursul lunii este recomandare operațională, nu blocare: fiecare rerulare primește RUNID și snapshot propriu.
- **Selector furnizor (10.09.2026)**: UI oferă `ALL` implicit sau un `MTRSUP`. O rulare filtrată are scope `SUPPLIER`, este numai pentru analiză, nu mută `ESTE_CURENT` și nu poate fi aplicată în ERP. Doar rularea `FULL`/ALL poate deveni curentă.
- **`sp_MinMaxEngine_Prepare` (10.09.2026)**: retras. Nu se mai menține ca oracle paralel; se elimină din sursa SQL/setup și din obiectele instalate la următorul deploy controlat.
- **Snapshot (10.09.2026, revizuit)**: cele trei coloane JSON de dezvoltare se elimină. `CCCMINMAXRUNPARAM` fără `FAZA` devine singura sursă înghețată a configurației unei rulări; snapshot-ul se scrie o singură dată la StartRun.
- **`MOD_ATRIBUIRE_FILIALA` (10.09.2026)**: default-ul rămâne `CLIENT`. Beneficiarul are combo cu `DOC`/`AGENT`/`CLIENT` și poate cere alt default. De reținut că documentul de confirmare din 14.08 îi oferea doar două variante (document/agent), iar jobul lui legacy folosește agentul; modul `CLIENT` este adăugat de noi.
- **`PSAL` și `overmax` (10.09.2026)**: confirmate ca eliminate intenționat de specificația nouă. Nu se reintroduc pragul „minim 3 piese vândute total" (`PSAL`) și nici factorul overmax din jobul legacy.

### Comutatoarele ABC și responsabilitatea utilizatorului

P3 introduce trei comutatoare (`ABC_CONVENTIE_CUMUL`, `ABC_POPULATIE`, `ABC_PRIM_ARTICOL_A`), deci opt combinații posibile:

| Cheie | Valori | Default | Rol |
| --- | --- | --- | --- |
| `ABC_CONVENTIE_CUMUL` | `INCLUSIV` / `PRECEDENT` | `INCLUSIV` | Litera S 4.8 vs. comportamentul curent |
| `ABC_POPULATIE` | `STANDARD` / `TOATE` | `STANDARD` | Litera S 4.8 vs. comportamentul curent |
| `ABC_PRIM_ARTICOL_A` | `1` / `0` | `1` | Regulă a noastră pentru articolul dominant; `0` dă litera beneficiarului |

- Toate cele opt combinații sunt opțiuni reale și produc întregul flux: clasificare SKU, clasificare agregată pe grupe, MIN, MAX și BUY. Nu sunt motoare separate, ci un singur motor cu politica ABC configurabilă.
- Valorile din coloana `Default` sunt numai pozițiile inițiale ale controalelor. Alegerea activă și efectul ei numeric sunt responsabilitatea utilizatorului.
- Validatorul verifică integritatea tehnică a rezultatului pentru configurația activă; nu declară că o combinație ABC este metodologic superioară alteia.
- Cele trei chei intră obligatoriu în `CCCMINMAXRUNPARAM` pentru sesiunea curentă, astfel încât rezultatul afișat să poată fi explicat prin setările care l-au produs.
- Nu se introduce prin această funcționalitate un contract de istoric al rezultatelor și nu se extinde retenția `CCCMINMAXDET`/`WEEK`/`WINSOR`. Eventuala păstrare a antetului și a parametrilor nu implică păstrarea datelor MIN/MAX produse de rulările vechi.

Nu se parametrizează celelalte două cazuri lăsate deschise de beneficiar: **egalitățile la prag** sunt deja deterministe prin `ORDER BY VAL_52S DESC, CODE ASC` (L505, propunerea E19), iar **totalul de grupă zero** dă `C`, singurul răspuns rezonabil. Un comutator acolo ar adăuga combinații de testat fără a oferi o a doua poziție pe care cineva să o aleagă.

Notă de implementare pentru `ABC_POPULATIE`: filtrarea nu se face înainte de fereastră, ci prin contribuție condiționată — `SUM(CASE WHEN @AbcPopulatie = 'TOATE' OR sl.LIFECYCLE = 'STANDARD' THEN sl.VAL_52S ELSE 0 END) OVER (...)`. Articolele NOU/OD rămân în secvență. Pentru `ABC_PRIM_ARTICOL_A`, „eligibil" înseamnă contribuție pozitivă în populația selectată și `VAL_52S>0`; un rând cu contribuție zero nu consumă regula primului A. Litera ABC rămâne persistată inclusiv pentru lifecycle-urile suprascrise de `CLASA`, deci nu este tratată drept date dispensabile.

### Configurație și snapshot — sursă unică

Decis 10.09.2026. Cele trei coloane JSON actuale (`PARAMSJSON`, `GROUP_PARAMSJSON`, `COMPUTE_PARAMSJSON`) sunt artefacte de dezvoltare și se elimină după migrarea consumatorilor. Nu se păstrează compatibilitate cu forma lor scalară.

**Configurația editabilă:** valorile globale rămân în `CCCMINMAXPARAMS`. Override-urile trăiesc într-o tabelă separată:

`CCCMINMAXPARAMOVERRIDE (PARAMKEY, BRANCH, PREFIX, PARAMVALUE, UPDATEDAT, UPDATEDBY)`, cu unicitate pe `(PARAMKEY, BRANCH, PREFIX)`. `BRANCH=0` înseamnă fără interes local; `BRANCH=1000` înseamnă explicit HQ. `PREFIX=''` înseamnă fără interes de prefix. În tabela de override este interzis rândul `(BRANCH=0, PREFIX='')`, deoarece aceea este valoarea GLOBAL din `CCCMINMAXPARAMS`.

**Precedența resolverului:** `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`. Prefixul este ales prin longest-prefix după normalizare. Numai cheile declarate flexibile (`LT_ZILE`, `FRECVENTA_ZILE`) acceptă override; API-ul refuză override-uri pentru cheile rigide.

**Template:** `CCCMINMAXTEMPLATE` rămâne exclusiv conveniență UI pentru încărcarea/salvarea unor seturi. Nu este citită de motor și nu este sursă de adevăr. Salvarea unui template în configurația activă produce rânduri explicite în `CCCMINMAXPARAMOVERRIDE`.

**Snapshot-ul rulării:** `CCCMINMAXRUNPARAM (RUNID, BRANCH, PREFIX, PARAMKEY, PARAMVALUE)`, cu unicitate pe toate cele cinci coloane, se populează o singură dată în `StartRun`. Nu are `FAZA`: Classify, ClassifyGroup și Compute citesc aceeași configurație imutabilă. Valorile globale sunt copiate cu `BRANCH=0`, `PREFIX=''`; override-urile își păstrează dimensiunile. `MOD_ATRIBUIRE_FILIALA` și `CALIBRARE_MOD` sunt de asemenea înghețate aici. Filtrul de furnizor se păstrează distinct în `CCCMINMAXRUN.MTRSUP`, cu NULL pentru ALL.

**Migrarea consumatorilor:** Classify/ClassifyGroup nu mai citesc `JSON_VALUE`; Apply, Explain și [freeze-minmax-sample.cjs](../tools/freeze-minmax-sample.cjs) citesc `CCCMINMAXRUNPARAM`. După migrare se elimină scrierea JSON din cele trei proceduri și coloanele JSON din `CCCMINMAXRUN`. Deoarece sistemul este încă în dezvoltare, metadatele JSON ale sesiunilor vechi nu se migrează.

**Retenție:** snapshot-ul rămâne metadată compactă a antetului și poate supraviețui datelor grele `DET/WEEK/WINSOR`; nu introduce singur o promisiune că rezultatele vechi sunt păstrate.

### Notă de proveniență — plancherul `σ_WK = 1.3`

Verificat pe 10.09.2026 pornind de la arhiva de email a beneficiarului:

- Documentul expediat pe 14.08.2026 punea E3 ca întrebare **deschisă** (⚠️), cu propunerea `safety = 0` și alternativa ilustrativă `safety ≥ 1`. Valoarea `1.3` nu apare acolo.
- Răspunsul beneficiarului conține blocul de formule până la `safety = SIGMA_WK × SSF × sqrt(LT/7)`, **fără niciun plancher**. F5 (sigma reală) e confirmat verbatim; E3 nu.
- Fraza „Confirmat de client (14.08.2026) … `σ_WK = 1,3`" din [SUMAR_TEORETIC_CONFIRMARE.md](../SUMAR_TEORETIC_CONFIRMARE.md) a intrat în commitul `0c84996` (31.08.2026) — la 17 zile după data invocată, în același commit cu SQL-ul care o implementează.
- Specificația din septembrie spune de două ori opusul: S 9 și S 7.1, „sigma zero produce safety zero".

Concluzie de lucru: **`1.3` este al nostru, nu al beneficiarului.** Nu se mai invocă drept confirmare a clientului. Rămâne default de configurare până la o clarificare explicită.

**Toate blocajele pentru primul bloc de implementare sunt rezolvate**: retragere Prepare, P14 CLI, P8, snapshot unic, P3 și P7. Pentru pașii structurali și condiționali rămân întrebări explicite:

1. **P2**: HQ se netează ca scope propriu sau rămâne sumă a filialelor deja netate?
2. **P4 / N9-N10**: fallback-ul universului HQ se aplică doar dacă sursa HQ lipsește complet sau și per SKU absent? Care sunt sursele exacte pentru stocul HQ/companie și `ORD_FURN` pe filială?
3. **P5**: OD primește doar prag de prezentare sau și aprovizionare (`BUY`) după podea?
4. **P6 / N5**: lista canonică de prefixe, normalizarea și valorile DEFAULT (LT 14 sau 30); mecanismul per filială și selectorul `MTRSUP` sunt deja decise.
5. **P10**: se adoptă formula literală S fără clamp pe stoc negativ sau rămâne clamp-ul curent?
6. **P11**: baza TREND rămâne 13S/26S ca fracție sau se adoptă formula 13S/52S din S 7?
7. **P12**: regula explicită ABC/z/SL pentru NOU; N6 nu este această clarificare.
8. **P13**: `MIN_DOC` este global sau per filială și cum se definește ultima vânzare după retururi? P13 se implementează după P4, fiindcă P4 reconstruiește universul `#Items`.

## Ordinea de implementare propusă

Ordinea respectă dependențele din coloana „Dependențe / ordine": P3 înaintea P7 (nu se parametrizează o formulă care urmează să se schimbe), P1 înaintea P2, P6/P7 înaintea P4.

1. **Retragere Prepare** — elimină [00d_prepare.sql](../sql/00d_prepare.sql) din sursa de deploy/setup și obiectul instalat, astfel încât pașii următori să nu întrețină un al doilea pipeline mort.
2. **P14 CLI** — adaugă metricile B/C; A/B/C rămân informative. Switch-ul UI de lansare se leagă după infrastructura de snapshot.
3. ~~**P9**~~ — închis fără modificări (`MEDIANA`).
4. **P8** — validează `SIGMA_MIN` și aliniază Classify + ClassifyGroup: NULL/absent → 1.3, zero valid, negativ/nenumeric → eroare.
5. **Snapshot unic** — creează `CCCMINMAXRUNPARAM`, îngheață configurația la StartRun, migrează consumatorii și elimină cele trei JSON-uri. Adaugă `CALIBRARE_MOD`; switch-ul P14 poate fi conectat acum.
6. **P3** — în doi commiți, fiecare pe Classify + ClassifyGroup: (a) convenție cumul + primul articol eligibil, validare; (b) populație ABC, validare.
7. **P7** — parametrizare mecanică în ambele proceduri, citită exclusiv din snapshot-ul rulării.
8. **P1** → **P2** — restructurarea nettingului; P2 așteaptă numai decizia HQ-scope.
9. **P6** — tabela de override, resolver branch/prefix, UI de configurare, eliminarea SSF din safety și selectorul opțional de furnizor. Subpasul branch este neblocat; longest-prefix așteaptă N5.
10. **P4** — universurile per scope, după clarificările N9-N10 și după P6/P7.
11. **P5, P10, P11, P12** — fiecare după decizia proprie; **P13 se execută după P4**.
12. **P15** — în afara Fazei 1, cu snapshot-ul deja extras în infrastructura de la pasul 5.

## Ce nu conține acest document

Nu autorizează nicio scriere SQL/AJS, nicio rulare nouă și nicio aplicare ERP. `node new_min_max/tools/sync-check.cjs` rămâne obligatoriu după orice editare SQL viitoare, iar deploy-ul AJS rămâne manual, de utilizator.
