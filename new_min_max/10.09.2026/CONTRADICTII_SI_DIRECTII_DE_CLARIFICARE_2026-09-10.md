# MIN/MAX: contradictii si directii de clarificare

Data: 10.09.2026.

Scop: separarea schimbarilor de cerinta ale beneficiarului de interpretarile, omisiunile si erorile noastre de documentare. Documentul consemneaza analiza discutata si obiectivele de lucru stabilite de utilizator; nu aproba formule noi si nu autorizeaza modificari de implementare sau scrieri in ERP.

## Baza comparatiei

- [SUMAR_TEORETIC_CONFIRMARE.md](../SUMAR_TEORETIC_CONFIRMARE.md): sumarul din august, redactat de noi, cu confirmari atribuite beneficiarului si propuneri proprii.
- [REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md](REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md): sinteza separata a materialelor beneficiarului din septembrie.
- [MATRICE_COMPARATIVA_MINMAX_2026-09-10.md](MATRICE_COMPARATIVA_MINMAX_2026-09-10.md): analiza mai ampla, inclusiv comportamentul codului; nu este sursa de autoritate pentru confirmarile clientului.

Comparatia de aici priveste cele doua documente, nu conformitatea codului. Regulile declarate in Word/config raman distincte de observatiile asupra Excelului static. Excelul nu decide automat care regula este corecta.

**Concluzie:** nu sunt doar deductii gresite ale noastre. Exista incompatibilitati reale intre reguli consemnate ca fiind confirmate de client in august si reguli declarate in noul pachet. Totusi, sumarul este redactarea noastra: fara raspunsurile originale putem demonstra contradictia dintre documente, nu inca faptul ca beneficiarul a formulat personal ambele variante exact astfel.

## 1. Contradictii explicite: de confirmat cu clientul

| ID | Subiect | Confirmarea consemnata in august | Cerinta declarata in septembrie | Contradictie si atribuire |
| --- | --- | --- | --- | --- |
| A1 | Coeficientul safety | L4: SSF=1.28 flat pentru toate clasele; varianta pe ABC nu se implementeaza. | Referinta 4.1, 4.4, 7.4: z(A/B/C)=1.65/1.04/0.67; SSF=1.28 este informativ si nu se foloseste in safety. | Varianta respinsa explicit in august devine regula noua. Daca raspunsul original confirma L4, este schimbare de cerinta sau nepreluarea confirmarii in noul pachet, nu simpla interpretare gresita. |
| A2 | Cerere constanta, sigma zero | E3: sigma calculata zero se inlocuieste cu 1.3 pentru rezerva minima. | Referinta 7.1, 12.2: cererea perfect constanta produce sigma zero si safety zero. | Rezerva impusa versus absenta rezervei statistice. Contradictie directa, sub rezerva fidelitatii consemnarii E3. |
| A3 | Reguli de pack | E14: N_PACK inlocuieste complet regulile pe categorii; daca lipseste, N_PACK=1, fara regula de rezerva pe familie. | Referinta 4.5, 7.5: reapar regulile disc/bucsa/piston/injector, inclusiv pragul injector, aplicate pe MIN/MAX. | Un mecanism eliminat explicit este cerut din nou. Nu se rezolva doar completand valori N_PACK. |
| A4 | Tratamentul CZ | E7/F6: cycle=0 strict pentru CZ, fara termenul ad*frecventa. | Referinta 4.3, 7.4: CZ are COV pozitiv; cycle urmeaza max(AVG*COV, ad*frecventa). | Pentru cerere pozitiva, noua regula produce cycle pozitiv. Este schimbare a politicii de stoc, nu doar ajustarea unei celule COV. |

Intrebarea comuna catre beneficiar:

> Noua regula inlocuieste confirmarea consemnata la 14.08.2026 sau documentul nou a omis-o? Va rugam sa precizati regula aplicabila si data de la care se foloseste.

Raspunsurile originale pentru L4, E3, E7 si E14 sunt probele decisive. Nu pornim nici de la premisa ca noi am dedus gresit, nici de la acuzatia ca beneficiarul se contrazice.

## 2. Diferente reale, cu alt statut: de analizat si, unde este util, parametrizat

| ID | Subiect | Diferenta dintre documente | Verdict si actiune necesara |
| --- | --- | --- | --- |
| B1 | Sub 8 linii pozitive | E2 consemneaza cererea de reducere a cantitatilor exceptionale indiferent de prag. Septembrie descrie p95 numai de la 8 linii, fara alternativa sub prag. | Confirmare veche nepreluata, dar noul text nu interzice explicit alternativa. Cererea de protectie este atribuita clientului; mediana este propunerea noastra, nu formula exacta confirmata. Verificam raspunsul E2 si alegem tratamentul; parametrizarea nu legitimeaza automat mediana ca default. |
| B2 | Flags | F9 spune ca vechiul Word le declara informative. Septembrie cere lichidare -> BUY zero; blocat/exclus -> MIN/MAX/BUY zero. | Contradictie intre specificatiile descrise, dar F9/E15 erau intrebari deschise in sumar. Nu atribuim clientului o confirmare definitiva a variantei informative. Verificam vechiul Word 3.11 si decidem efectele pe calcul, raport si aplicare ERP. |
| B3 | Podea Bucuresti | August foloseste 30%; septembrie 40%. | Schimbare de parametru, compatibila cu o configuratie editabila. Confirmam valoarea aplicabila si versiunea configuratiei; nu este prin ea insasi incoerenta metodologica. |
| B4 | Matrice COV si marimi | Valorile difera; NOU trece de la .75 la 1. Septembrie completeaza MEDIU si maparea filialelor. | Preponderent actualizare/completare de configuratie. Confirmarea din august include editabilitatea. Nu cerem din nou ca lipsa un tabel deja furnizat. Exceptia CZ este tratata separat la A4, deoarece schimba si regula cycle. |
| B5 | MAX dupa podea | E11/E12 confirma ridicarea MAX la MIN cand necesar si MAX=MIN la randul creat. Septembrie descrie numai ridicarea MIN. | Omisiune, nu contrariul explicit. Septembrie nu spune ca MAX trebuie lasat neschimbat. Confirmarea veche poate completa golul daca ramane valabila; trebuie inchis separat tratamentul OD/BUY. |
| B6 | TREND | F10 compara 13S cu 26S; septembrie compara media 13S cu media 52S. | Definitii diferite, dar alegerea 13S/26S nu este marcata ca o confirmare explicita distincta. Verificam provenienta inainte de atribuire. Un eventual selector de metoda necesita default aprobat, unitate si praguri clare. |

Categoria 2 nu inseamna ca orice diferenta trebuie transformata intr-un comutator. Parametrizam valori care trebuie realmente ajustate sau variante de metoda care trebuie realmente sustinute. Pentru o omisiune este necesara completarea contractului; pentru o schimbare de metoda este necesara decizia; pentru o eroare este necesara corectia.

## 3. Unde documentatia noastra este problema: de redus la zero

| ID | Problema | De ce ne apartine | Conditie de inchidere |
| --- | --- | --- | --- |
| C1 | ABC: F2 versus E17 | F2 pune cumulul peste 95% in C. E17 spune ca unicul articol, cu cumul 100%, devine automat A. Acest A nu rezulta din formula; este o exceptie propusa, neconfirmata. Septembrie nu o declara. | Eliminam afirmatia ca A rezulta automat din formula. Regula standard si eventuala exceptie se scriu separat; exceptia ramane neaprobata pana la dovada. |
| C2 | E11: MAX=MIN, nu max(MAX,MIN) | In conditia discutata, MIN>MAX, cele doua expresii au acelasi rezultat. Distinctia explicativa este falsa matematic. | Corectam explicatia fara a schimba intelesul confirmarii: MAX se ridica la MIN numai cand este sub el; cazul unui MAX deja mai mare nu este acoperit de aceasta conditie. |
| C3 | CX=2.00 mai mare decat BY=2.00 | Valorile sunt egale. Numai comparatia cu BZ=1.75 este adevarata. | Corectam comparatia, pastrand separat intrebarea de business despre COV. |
| C4 | Provenienta si aprobare amestecate | Legenda spune ca [D] inseamna neconfirmat, dar F5 este [D] si confirmat prin e-mail. L4 este inchis si se termina din nou cu De confirmat. | Separam originea propunerii de starea aprobarii. Indepartam intrebarile reziduale sau le marcam explicit ca redeschise de un document ulterior, cu motiv si data. |
| C5 | Atribuirea diferentei de netting clientului | I3 din august si referinta 5.4 cer ambele compensare pe client si fereastra. Nu exista contradictie intre aceste cerinte. | Nu prezentam netting-ul saptamanal urmat de insumare ca schimbare ceruta de client. O eventuala abatere a codului se trateaza separat ca problema interna; prezentul document nu autorizeaza repararea codului. |

**Zero** inseamna zero afirmatii false, zero contradictii interne neexplicate si zero aprobari atribuite fara trasabilitate. Nu inseamna zero intrebari deschise cu orice pret, stergerea istoricului sau rescrierea retroactiva a confirmarilor clientului.

Corectiile matematice/editoriale se pot face pe dovezile existente. Cand rezolvarea ar alege o regula business, nu inventam aprobarea ca sa inchidem categoria: formulam corect intrebarea si o mutam in registrul deciziilor necesare.

## 4. Abordarea stabilita

Utilizatorul a stabilit urmatoarele obiective:

1. Categoria 3 trebuie redusa la zero.
2. Categoria 2 trebuie analizata si/sau parametrizata.
3. Categoria 1 trebuie confirmata cu clientul.

**Evaluare: abordarea este corecta**, cu urmatoarele precizari:

- Eliminam intai zgomotul produs de documentatia noastra, pentru a trimite beneficiarului intrebari verificabile, nu contradictii introduse de noi.
- Verificarea raspunsurilor originale din august poate incepe in paralel cu aceasta curatare; nu necesita modificarea codului.
- Pentru categoria 2, o optiune configurabila nu inlocuieste aprobarea comportamentului implicit. Nu sustinem doua metode doar pentru a evita o decizie.
- Pentru categoria 1, stabilim ce regula prevaleaza, din ce sursa si de la ce data. Nu alegem automat noul Excel sau noul text in defavoarea unei confirmari anterioare fara reconciliere.
- Abia dupa inchiderea deciziilor se poate stabili un plan de aliniere a implementarii si validare pe inputuri/configuratie inghetate, cu autorizare separata.

Pentru fiecare decizie se vor putea consemna: identificatorul, formularea exacta, sursa originala, starea aprobarii, regula aleasa, valoarea implicita daca exista, data aplicarii si un exemplu de acceptanta. Aceste informatii nu sunt completate prin presupuneri in documentul de fata.

## 5. Stare si urmatorul pas

- Analiza si directiile sunt consemnate; corectiile din categoria 3 nu au fost aplicate inca sumarului istoric.
- Nu s-a stabilit inca autoritatea finala a variantelor A1-A4.
- Nu s-au modificat implementarea sau parametrii si nu s-a accesat baza de date pentru acest document.
- Urmatorul pas recomandat: o revizie documentara trasabila a categoriei 3 si strangerea raspunsurilor originale L4/E3/E7/E14/E2, apoi intrebari punctuale catre beneficiar.

Formularea defensabila ramane: **pachetul nou contrazice unele confirmari consemnate in august**. Raspunsurile originale vor separa schimbarea cerintei de o consemnare sau deductie gresita a noastra.

## 6. Ce pare cerinta noua in pachetul din septembrie

Adaugare din 10.09.2026, la solicitarea utilizatorului. Aceasta sectiune completeaza analiza contradictiilor, nu transforma automat fiecare diferenta intr-o extindere de scop aprobata.

**Reperul principal este sumarul din august.** Pentru a evita falsuri de noutate, au fost consultate si materialele interne anterioare: [SINTEZA_FINALA.md](../analiza/SINTEZA_FINALA.md), [MinMax_ERP_Implementation.md](../analiza/MinMax_ERP_Implementation.md) si [sinteza_cerinte_clarificari.md](../analiza/sinteza_cerinte_clarificari.md). Acestea sunt dovezi ale existentei anterioare a unei teme in documentatia proiectului, nu substitut pentru mesajele originale ale beneficiarului. Nu a fost refacuta aici examinarea documentelor Word vechi.

Statutul **aparent nou** inseamna ca elementul nu este stabilit in sumarul anterior si pare adaugat in noul contract. Nu inseamna ca s-a demonstrat ca beneficiarul nu l-a cerut niciodata in alte discutii. **Precizare noua** inseamna ca obiectivul exista, dar noul pachet ii da o semantica sau un contract mai exact.

### 6.1. Candidati la cerinte noi sau precizari substantiale

Trimiterile la sectiuni din coloana sursa sunt la referinta beneficiarului, nu la sumarul din august.

| ID | Element | Sursa noua | Ce exista anterior / ce pare adaugat | Statut si intrebare necesara |
| --- | --- | --- | --- | --- |
| N1 | ALTREF si STOC_TOTAL_ALTREF | 9.1, 9.4; S 7/9; verificare cod si metadate DB din 10.09 | ALTREF este deja expus din MTRL.CODE1 in exportul MIN/MAX existent. CalculMinMax.js si definitia instalata a ufn_vanzariWksOptimized nu folosesc AltRef si nu insumeaza stocul echivalentelor. | **Reclasificat partial:** campul AltRef nu este o noutate a proiectului. Candidata ramane regula STOC_TOTAL_ALTREF pe acelasi scope, cu fallback la stocul propriu; absenta din traseul vechi nu dovedeste ca nu a fost ceruta anterior. Nu implica gruparea cererii sau schimbarea BUY. Vezi 6.4. |
| N2 | Univers SKU definit prin uniuni de surse | 5.1; S 4.1 | I9 descria universul prin articole de marfa si activitate. Acum HQ are stoc UNION ERP HQ, iar filialele au stoc pozitiv UNION ERP UNION manual UNION vanzari. | **Precizare substantiala de contract:** poate introduce articole fara vanzari, nu doar alte randuri de raport. De confirmat ca aceasta este populatia obligatorie, distincta de eligibilitatea STANDARD/NOU. |
| N3 | Fallback HQ pentru articole absente din sursa ERP | 5.1, 11 N09; S 4.1/9 | I6 stabilea agregarea HQ, iar E20 privea articole vandute fara pozitie de filiala; nu defineau acest fallback HQ si criteriile sale de includere. | **Aparent nou ca regula explicita:** de stabilit daca se aplica la sursa HQ lipsa sau si la fiecare SKU absent. Nu se confunda cu auto-crearea Bucuresti prin podea. |
| N4 | LT efectiv diferit pe filiale | 4.2, 7.3; S 3.6/5.3; clarificare utilizator si capturi UI din 10.09 | Modulul vechi era operat pe o singura filiala, selectata obligatoriu, cu LT introdus pentru acea rulare. Acest context era deja cunoscut implementatorului. Pachetul expliciteaza HQ/BUC cu LT furnizor si celelalte 12 filiale cu LT=10, numeric, text/gol cu fallback la furnizor. | **Reclasificat: comportament existent, nu functie noua.** Tabelul si prioritatea automata sunt detalii de configurare de reconciliat. Selectia unica si parametrul LT nu demonstreaza singure ca vechiul cod aplica automat valoarea 10 sau resolverul furnizor/filiala. |
| N5 | Cel mai lung prefix si DEFAULT pentru nerecunoscut | 4.4; S 3.8/C | Maparea pe prefix era deja ceruta prin I14. Acum este explicita rezolvarea suprapunerilor, precum KNCORE inainte de KN, si cazul fara potrivire. | **Precizare noua, nu intreaga functie noua:** de confirmat lista, normalizarea si valoarea DEFAULT 14 versus 30. Furnizorul ERP al FSOP si ALL/72235 nu inlocuiesc aceasta regula. |
| N6 | Excludere optionala de grupa | 4.1, 5.3; S 4.3/C GROUP_EXCLUDE | I4/I5 stabileau excluderile pe prefix si client. Acum apare si excluderea configurabila a grupei, rezolvata din ERP HQ cu fallback in vanzari. | **Aparent nou, functional:** acum este OFF, dar suportul configurabil este cerut. Nu este acelasi lucru cu flag-ul EXCLUDE al articolului sau propunerea interna CCCEXSTAT. |
| N7 | Contract exact al fisierelor de intrare | 3.1-3.4; S 2 | Existau cerinte de date ERP si unele fisiere externe. Acum sunt enumerate foi acceptate, coloane pozitionale, surse de univers/manual, fallback-uri de metadata si concatenarea optionala a exporturilor anuale. | **Precizare noua de integrare:** de stabilit ce trebuie efectiv importat si daca aceasta forma de input se aplica proiectului nostru. Nu presupunem ca descrierea fisierelor aproba abandonarea integrarii ERP. |
| N8 | BUCURESTI din manual poate insemna HQ | 3.3; S 2.4; clarificare utilizator din 10.09 | HQ este jargon MEC pentru intreaga companie, asociat operational depozitului Bucuresti, unde intra achizitiile si de unde se distribuie catre filiale. Utilizatorul indica branch replenishment drept mecanism existent si acceptat. | **Reclasificat: context operational existent, omis din analiza noastra, nu cerinta noua.** Maparea manualului trebuie sa reflecte acest context. Asocierea logistica nu face automat identice stocul fizic Bucuresti si agregatele companiei; se pastreaza distinctia pe indicator. |
| N9 | Ferestre in zile si reguli de calendar mai explicite | 5.2, 5.5; S 4.2/4.6 | I1/F4 foloseau 52 saptamani si ferestrele VZ. Acum apar explicit 28/56/91/182/365 zile, saptamani ISO si recenta round(zile/7). | **Precizare de metoda, nu indicatori complet noi:** trebuie reconciliate cele 365 zile cu exact 52 bucket-uri; nu se declara calendarul complet rezolvat. VZ_13P este mentionat, dar utilizarea lui ramane neclara. |
| N10 | Fallback de cost si parametri de valorizare | 4.1, 9.4; S 7/9/C | Valorizarea si COST_MED_RON/STOC_VAL_EUR existau in documentatia initiala. Sumarul nu fixeaza insa lantul cost din stoc -> pret*(1-.25) -> zero si rata 5.25 din noul pachet. | **Precizare noua fata de sumar:** nu numim intreaga valorizare cerinta noua. De stabilit costul/pretul reprezentativ si care valori sunt configurabile. |
| N11 | Motor web, nu exclusiv in S1 | 2, 3.4, 12.3; S 1/2/10; clarificare utilizator din 10.09 | Utilizatorul precizeaza ca expresia independent de ERP desemna folosirea tehnologiilor web, spre deosebire de prima versiune realizata numai in S1. Nu cere decuplare de ERP sau inlocuirea integrarii cu exporturi. | **Retras din candidatele la schimbare de scop.** Interpretarea anterioara a fost excesiva. Detaliile fisierelor de intrare se reconciliaza separat la N7, fara mandat implicit de reproiectare. |
| N12 | Audit/reproductibilitate si arhiva per rulare | 9.5, 12.1, 12.3; S 7/8/10 | Sumarul cerea verificari, comparatie paralela si salvarea valorilor anterioare la aplicare. Noul pachet expliciteaza configuratia folosita, output/config pastrate pe saptamani si aceleasi inputuri/config -> acelasi output. | **Contract operational nou explicit fata de sumar:** de confirmat continutul arhivei si raportul obligatoriu, inclusiv contoare excluderi, winsor si fallback. Nu confundam auditul calcularii cu posibilitatea de revenire la limite ERP anterioare. |
| N13 | Detalii de livrare a fisierului | 9.1, 12.3; S 7/10 | Existau deja Excel si 16 foi. Acum sunt declarate 41 coloane in ordine, antet pe randul 1, model de nume cu data si sufixe _v2/_v3 daca fisierul este deschis. | **Extindere/precizare a contractului de export:** se verifica diferenta exacta de schema, nu se eticheteaza exportul intreg ca nou. Acceptarea acestor detalii trebuie separata de alegerea stack-ului, care este doar recomandata. |
| N14 | Reprezentativitatea manualului pentru acceptanta | 12.1; S 8 | Sumarul avea deja >80% FLAG=OK si propunea recalibrare. Noul text conditioneaza acceptanta de o baza manuala reprezentativa, fara definitie numerica. | **Precizare noua a acceptantei, nu prag nou:** de stabilit populatia si reprezentativitatea. Nu autorizeaza inlocuirea benzii OK cu o banda mai larga. |

### 6.2. Ce nu trebuie prezentat drept cerinta noua

| Element | Motiv |
| --- | --- |
| Rulare saptamanala | Apare deja in materialele initiale, inclusiv SINTEZA_FINALA 5 si sinteza_cerinte_clarificari 5. Faptul ca ulterior s-a discutat un model lunar este o problema de reconciliere a operarii, nu dovada ca saptamanal a fost cerut prima data acum. Automatizarea si declansatorul concret trebuie totusi precizate. |
| Export Excel si 16 foi | Apar deja in MinMax_ERP_Implementation si SINTEZA_FINALA 4, cu schema declarata atunci de 39 coloane. Noutatea posibila este diferenta de continut si contract, nu existenta exportului. |
| SAPT_12S | Coloana apare deja in prezentarea si sintezele initiale. Semnificatia ei fata de SAPT_8S ramane de clarificat; este o ambiguitate veche, nu o coloana introdusa acum. |
| Sigma reala cu zerouri, AVG ponderata, netting pe client/fereastra | Sunt deja prezente in I1/I3/I11/I12 si F4/F5. Abaterea codului de la ele nu transforma regula in cerinta noua. Schimbarile privind sigma zero si coeficientul safety sunt categoria 1. |
| Mapare pe prefix si parametri editabili | I14 si sectiunea 4 le cer deja. Lipsa conectarii lor in cod este restanta de implementare; longest-prefix si fallback-ul explicit sunt precizarile N5. |
| Clasificarea filialelor MARE/MEDIU/MIC | Era deja consemnata, inclusiv editabilitatea. Noul tabel completeaza valorile/maparea, conform B4, nu introduce de la zero conceptul. |
| Pack pe familii, z(ABC), CZ cu cycle pozitiv, sigma zero fara rezerva | Nu le tratam drept functii suplimentare independente pentru a evita discutia: sunt reveniri sau reguli incompatibile cu confirmarile consemnate, tratate la A1-A4. |
| Flags, podea 40%, noua formula TREND | Apartin reconcilierii B2/B3/B6, nu unui inventar de functii complet noi. |
| Aplicare ERP separata si manuala | Exista deja in Partea VI a sumarului. N11 inseamna utilizarea tehnologiilor web, conform clarificarii utilizatorului, nu decuplarea de ERP. |
| >80% FLAG=OK, HQ agregator, excluderile clientilor | Sunt cerinte anterioare. O verificare interna diferita sau o implementare incompleta nu le schimba vechimea. |

### 6.3. Cum se trateaza aceasta lista

Se adauga un al patrulea fir de lucru, fara schimbarea prioritatilor 3 -> 2 -> 1:

> **Aparent nou -> verificare in sursele vechi -> confirmare ca se aplica livrabilului nostru -> delimitare de scop si acceptanta -> estimare/implementare numai dupa autorizare.**

Pentru fiecare N1-N14 trebuie stabilit daca este: cerinta cu adevarat noua, precizare a uneia existente, cerinta veche omisa din sumar sau descriere a motorului beneficiarului fara mandat de implementare in proiect. Absenta din cod nu este criteriu de noutate.

Inventarul este preliminar; cele 14 ID-uri sunt pastrate pentru trasabilitate, nu reprezinta 14 cerinte noi confirmate. N4 si N8 au fost reclasificate ca elemente de context existent, iar N11 a fost retras ca presupusa schimbare de scop, dupa clarificarile utilizatorului din 10.09. N1 separa acum campul AltRef existent de regula de totalizare a stocului echivalentelor; aceasta si excluderea optionala pe grupa raman candidate. Universurile si contractele de input/audit necesita verificarea surselor initiale inainte de clasificarea contractuala finala.

### 6.4. Verificarea contextului vechi dupa clarificarile utilizatorului

**Provenienta:** explicatiile utilizatorului si cele doua capturi UI atasate in conversatie la 10.09.2026; citire statica a codului local; doua interogari SELECT de metadate pe conexiunea `prod:default`, baza `mecdiesel`, in aceeasi zi. Nu s-a executat functia de vanzari, nu s-a executat CalculMinMax.js si nu s-au facut scrieri DB. Definitia instalata citita acum nu dovedeste ce versiune era instalata in august.

- **O singura filiala per rulare in UI:** camp obligatoriu single-select, conform utilizatorului si capturilor. [Wrapper-ul vechi](CalculMinMax.js) primeste un singur set de parametri, inclusiv vLT, pe care il foloseste in safety si LTstock. In schimb, SQL accepta tehnic o lista de filiale prin STRING_SPLIT: aceasta capacitate interna nu contrazice restrictia ecranului. Nu deducem un LT global pentru toate filialele din faptul ca o rulare are un singur vLT.
- **AltRef in traseul calculului vechi:** wrapper-ul apeleaza dbo.ufn_vanzariWksOptimized. Definitia instalata returneaza MTRL, MTRSUP, CODARTICOL, DENUMARTICOL, branch, pcswk, valuewk, wk si wkflag. Agrega pe MTRL si saptamana, plus filiala in modurile de filiala; nu citeste CODE1/AltRef, nu grupeaza echivalente si nu calculeaza stoc. sys.sql_expression_dependencies indica numai tabelele MTRTRN, FINDOC, TPRMS, MTRL si PRSN, fara alte UDF-uri, proceduri, view-uri sau sinonime in acest traseu. Surse locale concordante pentru acest aspect: [varianta initiala](../../top-abc/SQLDependencies_Optimized.sql) si [varianta AGENT/DOCUMENT](../../top-abc/SQLDependencies_Agent_Doc_backwards_compat.sql).
- **AltRef in proiectul existent:** [exportul MIN/MAX](../../S1-MEC/AJS/ZeroMinMax.js#L1112) selecteaza `ISNULL(m.CODE1, '') AS ALTREF`. Este dovada unei surse ERP si a expunerii campului in codul local, nu dovada calcularii STOC_TOTAL_ALTREF sau a datei primei cerinte. Nu a fost verificat deploy-ul acestui export.
- **HQ si Bucuresti:** utilizatorul confirma HQ ca intreaga companie si Bucuresti ca punct logistic de receptie si distributie. Functia instalata trateaza selectia 1000 ca mod agregat, cu branch=1000, fara filtrul pe lista filialelor; nu selecteaza numai vanzarile fizice Bucuresti. [Branch replenishment](../../reumplere/sp_GetMtrlsDat.sql) separa filiale emitente/destinatare, mapeaza depozitele prin WHOUSE.CCCBRANCH si urmareste transferurile prin FINDOC.BRANCH/MTRDOC.BRANCHSEC. [Interfata](../../public/components/branch-replenishment-container.js#L75) identifica 2200 ca BUCURESTI. Codul sustine distinctia agregat companie versus sursa logistica; utilizarea de facto si acceptarea mecanismului sunt confirmari ale utilizatorului, nu concluzii deduse din cod.
- **Clarificare incidentala ALL:** in definitia instalata, `@supplier=72235` dezactiveaza filtrul pe MTRSUP, iar NULL este transformat in 72235. `@mtrl=2606178` are rol analog pentru articol. Aceasta inchide incertitudinea tehnica privind ALL in versiunea citita, fara a modifica sensul DEFAULT pe prefix din noua specificatie.

Corectiile N4/N8/N11 tin de recuperarea contextului cunoscut si de eliminarea interpretarilor noastre prea largi, nu de cerinte suplimentare de imputat beneficiarului. Pentru N1, verdictul este limitat la traseul si sursele verificate, nu la absenta totala a unei asemenea reguli din toate modulele sau discutiile istorice.