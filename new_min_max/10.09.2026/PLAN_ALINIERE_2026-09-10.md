# MIN/MAX: plan de aliniere a codului la cerintele beneficiarului

Data: 10.09.2026. Statut: plan de lucru aprobat de utilizator ca directie; nu aproba formule, nu autorizeaza scrieri in ERP si nu inlocuieste deciziile beneficiarului din Faza 2.

Scop: alinierea motorului v5 (`Classify`/`Compute`) la cerintele beneficiarului, corectand presupunerile proprii, cu implicarea minima a beneficiarului — doar acolo unde nu exista autoritate interna pentru decizie.

Documente-sursa: [CONTRADICTII_SI_DIRECTII_DE_CLARIFICARE_2026-09-10.md](CONTRADICTII_SI_DIRECTII_DE_CLARIFICARE_2026-09-10.md), [MATRICE_COMPARATIVA_MINMAX_2026-09-10.md](MATRICE_COMPARATIVA_MINMAX_2026-09-10.md), [REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md](REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md), [SUMAR_TEORETIC_CONFIRMARE.md](../SUMAR_TEORETIC_CONFIRMARE.md). ID-urile D/C/F/O/T trimit la matrice; A/B/C/N la contradictii; I/F/E/L la sumar.

## 1. Evaluarea abordarii initiale

Abordarea "categoria 3 -> 0, categoria 2 -> parametrizare, categoria 1 -> client" este corecta ca igiena documentara, dar insuficienta pentru alinierea codului. Doua corectii de cadru:

1. **Sectiunea 3 din CONTRADICTII nu contine cod.** C1-C5 sunt erori editoriale in sumarul din august. Cea mai mare parte a presupunerilor proprii care trebuie corectate sunt in matrice, la regulile unde **ambele surse (august si septembrie) concorda si codul deviaza**. Acolo nu exista decizie de business; este restanta interna.
2. **Taxonomia CONTRADICTII este doc-vs-doc.** Pentru cod este necesara o partitie dupa *autoritate*:

| Zona | Criteriu | Cine decide | Continut |
| --- | --- | --- | --- |
| **Z0** | August si septembrie concorda; codul deviaza | Intern, acum | D12, D13, C02, C03, C07/C09, C11, F10 + presupuneri proprii neconfirmate |
| **Z1** | Septembrie declara; august tacea sau era ⚠️ fara decizie marcata | Intern, dupa septembrie, cu parametru unde valoarea e incerta | D02/D03, D15, O05/B6, O07, O08, O09, F09, B5 |
| **Z2** | Septembrie contrazice o confirmare consemnata in august | Beneficiar | A1, A2, A3, A4, B2 |
| **Z3** | Septembrie e neclar in interior (N01-N16) | Beneficiar doar unde nu exista default defensabil | N01, N02, N06, N05 |

Categoria 2 din CONTRADICTII se dizolva in Z1/Z2: B1/B3/B4 sunt deja parametri (`WINSOR_SUB_PRAG`, `PROCENT_PODEA_BUC`, `CCCMINMAXCOV`) — nu e nimic de parametrizat, doar de incarcat valorile din C si de aprobat; B2 este Z2; B5/B6 sunt Z1.

## 2. Contradictiile A1-A4 si B2 din perspectiva codului

| ID | Ce face codul azi | Partea care ne apartine | Ce ramane efectiv al beneficiarului |
| --- | --- | --- | --- |
| **A1** SSF vs z(ABC) | `SIGMA_WK * SSF * sqrt(LT/7)`, SSF global | Absenta mecanismului pe clasa; L4 spunea "nu se implementeaza", nu "nu se parametrizeaza" | Valoarea: `Z_A/Z_B/Z_C` = 1.28 flat sau 1.65/1.04/0.67 |
| **A2** sigma zero | `SIGMA_MIN` default 1.3; fallback-ul inlocuieste 0 cu 1.3, deci nu se poate dezactiva | Nedezactivabilitatea este bug de implementare | Valoarea: 0 sau 1.3 |
| **A3** pack | `N_PACK = MTRPACK sau 1`, doar pe BUY; `MTRPACK` este 100% gol in ERP | Aplicarea pe BUY (I3), nu pe MIN/MAX; E14 produce in practica zero pack | Familii (cu semantica N07) sau MTRPACK. Singura contradictie care cere date sau cod nou |
| **A4** CZ | `CZ_CYCLE_ZERO=1` testeaza `COV=0`, nu `CLASA='CZ'` | Legarea exceptiei de valoarea COV: incarcarea COV din C o dezactiveaza tacit si orice clasa cu COV=0 o mosteneste | Doar autoritatea; cost minim |
| **B2** flags | Informative; `FLAGS_ZERO_LA_APPLY` doar auditat | E15 era propunere; F9 era ⚠️ deschis — nu exista confirmare in august, deci este gol nedecis, nu contradictie | Mod: informativ / zero la apply / zero in calcul (S 6); sursa ERP OR fisier extern |

Toate cinci devin comutabile prin configuratie fara beneficiar. Beneficiarului ii ramane semnarea unei foi PARAMETRI — artefactul cerut oricum de S 7/S 8 pentru audit. Cererea de confirmare *este* livrabilul de configuratie.

## 3. Registrul presupunerilor proprii din cod (Z0 + Z1)

Fara confirmare de client sau contrare ambelor surse. Testul asociat devine regresie.

| # | Presupunere in cod | Sursa contrara | Test |
| --- | --- | --- | --- |
| P1 | Netting saptamanal apoi insumare (D12) | I3 + S 4.4: `max(0, Σ)` per client per fereastra | T1 |
| P2 | Netting pe `TRDR`, nu pe `TRDR.CODE` (D13); HQ din neturi de filiala | I5: codurile nu sunt unice; HQ scope propriu | T1 (variante) |
| P3 | ABC pe toate lifecycle-urile, cumul precedent (C02/C03) | I0 3.3 + S 4.8: doar STANDARD, cumul inclusiv | T2 |
| P4 | Univers = vanzari × filiale, cross join dens (D02/D03) | S 4.1: uniuni per scope; I9 vag | nou |
| P5 | BUY fara garda OD dupa podea (F10) | E1 + S 4.7: OD ⇒ BUY=0 | nou |
| P6 | LT/frecventa globale, fara resolver prefix, fara LT filiala (C07/C09) | I14 + S 3.8/5.3 | nou |
| P7 | Praguri hardcodate 3/2/0.80/0.95/0.5/1.0/0.60/2/ponderi AVG (C11) | ambele: "nimic hardcodat" | — |
| P8 | `SIGMA_MIN` nedezactivabil (C05) | A2 | T3 |
| P9 | `WINSOR_SUB_PRAG=MEDIANA` default (D11) | E2 cere *un* tratament; mediana e formula proprie | — |
| P10 | Clamp stoc negativ (F09) | E10 era [D] neconfirmat; S 5.6 literal | T4 |
| P11 | TREND 13S/26S ca fractie (O05) | F10 august nu era decizie marcata; S 7 explicit | T5 |
| P12 | `SL_B` pentru toate NOU (F02) | gol completat intern | — |
| P13 | MIN_DOC global; SAPT_FARA in frontiere de saptamana (D15) | S 4.6: per scope; `round(zile/7)` | nou |
| P14 | Validatorul numara banda 0.50-2.00 (O13) | S 8: FLAG=OK pe MAX_MANUAL>0 | T6 |
| P15 | Lipsuri: AltRef/STOC_TOTAL_ALTREF, costuri/EUR, 41 coloane, SUMMARY HQ separat, raport S 8, `PARAMSJSON` complet (O07-O12) | S 7-9 | — |

## 4. Fazele

### Faza 0 — Curatare documentara si probe (fara cod, fara beneficiar)

- [ ] C1-C5 aplicate in [SUMAR_TEORETIC_CONFIRMARE.md](../SUMAR_TEORETIC_CONFIRMARE.md): separare provenienta/aprobare, corectare E17, E11, CX/BY, eliminarea "De confirmat" rezidual din L4; nota de reconciliere datata la fiecare ID reatins de pachetul din septembrie *(model: Claude Sonnet 4.6)*
- [ ] Strangerea raspunsurilor originale L4/E3/E7/E14/E2 (e-mail/sedinte) — **actiune a utilizatorului**; rezultatul reclasifica A1-A4 in "schimbare de cerinta" sau "consemnare gresita proprie" *(fara model)*
- [ ] Registrul P1-P15 de mai sus mentinut ca lista de bifat, cu ID matrice si test *(model: Claude Haiku)*

### Faza 1 — Aliniere Z0/Z1 si schelet de parametrizare (fara beneficiar)

Ordinea respecta dependentele: parametri, cerere, clasificare, formule.

- [ ] **Parametri noi in seed** (idempotent, nu suprascrie editari): `Z_A/Z_B/Z_C/Z_NOU`, `SL_NOU`, `SIGMA_MIN` acceptand 0, `CZ_CYCLE_ZERO` legat de `CLASA`, `FLAGS_MODE` (INFO/APPLY/CALC), `STOC_NEG_CA_ZERO`, `TREND_BAZA` (52S/26S), `NETTING_CHEIE` (CODE/TRDR), praguri lifecycle/ABC/XYZ/dominanta, ponderi AVG, `LT_DEFAULT_PREFIX`, coloana `CCCMINMAXBRANCH.LT` (aliniere in [00b_persist.sql](../sql/00b_persist.sql), guard INFORMATION_SCHEMA) *(model: Claude Sonnet 4.6)*
- [ ] **Valorile COV/marimi din C** livrate ca script de incarcare separat, nu ca modificare de seed; se aplica doar in Faza 3 *(model: Claude Haiku)*
- [ ] **Resolver longest-prefix + LT efectiv** conform S 5.3 in `Classify`; normalizare spatii (`GEW `) *(model: Claude Sonnet 4.6)*
- [ ] **Univers per scope prin uniuni** (stoc, ERP limits, manual, vanzari) + fallback HQ conditionat de sursa lipsa; densitatea ramane optiune de export. Plafonul de 60 s `X.RUNSQL` impune spargerea `Classify` in batch-uri; uniunile reduc volumul *(model: Claude Sonnet 4.6)*
- [ ] **Netting per (SKU, scope, client-cod, fereastra)**, HQ ca scope propriu; seria saptamanala pentru sigma pastrata separat *(model: Claude Sonnet 4.6)*
- [ ] **ABC: populatie STANDARD, cumul inclusiv, tie-break CODE** *(model: Claude Sonnet 4.6)*
- [ ] **Compute**: `z(ABC)` in safety, `SIGMA_MIN=0` respectat, exceptie CZ pe clasa, garda OD pe BUY, `STOC_NEG_CA_ZERO`, `FLAGS_MODE`, TREND parametrizat cu override NOU/OD, MIN_DOC per scope, SAPT_FARA `round(zile/7)` *(model: Claude Sonnet 4.6)*
- [ ] **Indicatori lipsa**: ALTREF (`MTRL.CODE1`), STOC_TOTAL_ALTREF per scope, COST_MED_RON/STOC_VAL_EUR/BUY_VALUE_EUR cu lantul de fallback S 9, `EUR_RATE`, `MARGIN_EST` *(model: Claude Sonnet 4.6)*
- [ ] **T1-T6 devin teste** (date sintetice intr-un RUNID de test sau in `validate-minmax-invariants.cjs`); metrica S 8 FLAG=OK adaugata separat de banda interna *(model: Claude Sonnet 4.6)*
- [ ] `node new_min_max/tools/sync-check.cjs` dupa fiecare editare SQL; deploy AJS manual de utilizator (MCP read-only) *(model: Claude Haiku)*
- [ ] **Review** al diff-ului pe sesiune noua, context mic *(model: Claude Opus 4.1)*

Nu intra in Faza 1: pack pe familii (depinde de A3), import fisier extern de flags (depinde de B2), export 41 coloane / SAPT_12S (depinde de N05), aplicare ERP (Faza 4, amanata).

### Faza 2 — Un singur pachet catre beneficiar

Format: **foaia PARAMETRI propusa pentru prima rulare aliniata** (o pagina) + **maximum 7 intrebari**. Nu se trimit matricea sau documentul de contradictii.

| # | Intrebare | De ce nu se poate decide intern |
| --- | --- | --- |
| 1 | A1: `z` = 1.65/1.04/0.67 pe ABC (sept.) sau 1.28 flat (L4, 14.08)? | Confirmare consemnata contrazisa |
| 2 | A2: sigma=0 ⇒ safety 0 (sept.) sau plancher 1.3 (E3, 14.08)? | idem |
| 3 | A3: pack pe familii disc/bucsa/piston/injector pe MIN/MAX (sept.) sau `MTRPACK` pe BUY (E14, 14.08)? `MTRPACK` este gol pentru toate articolele. Daca familii: 4 sau 6, rotunjire, precedenta | Contradictie + semantica incompleta (N07) + cere date |
| 4 | A4: CZ cu COV 1.5/1.0 si cycle normal (sept.) sau cycle=0 (E7, 14.08)? | Confirmare contrazisa |
| 5 | B2/N15: flags informative, zero la scrierea in ERP, sau zero in calcul (S 6)? Excel-ul pastreaza MIN/MAX pe 8.377 randuri blocate | Nedecis in ambele runde; S contrazice X |
| 6 | N01/N02: lista canonica de 38 prefixe si DEFAULT LT 14 sau 30? | Date lipsa; afecteaza toate articolele nerecunoscute (ex. FSOP) |
| 7 | N06: z si SL pentru NOU/REACTIVAT? | Gol in S; codul a inventat SL=85 |

I7/D05 este inchis prin decizie interna la 10.09.2026: modul de atribuire nu mai este o alegere
globala ce trebuie confirmata o singura data. Utilizatorul selecteaza `DOC`, `AGENT` sau `CLIENT`
la fiecare rulare, iar alegerea este validata si persistata in `PARAMSJSON` al RUNID-ului.

Restul (N03, N04, N08-N14, N16, B5, B6, F09, D15) primeste **default documentat in PARAMETRI** si apare in raportul S 8 al rularii; nu formeaza intrebari. Fara raspuns la 1-5, configuratia ramane pe valorile din august (comportamentul actual) si raportul spune explicit asta; septembrie nu se adopta tacit.

Daca Faza 0 arata ca A1-A4 sunt consemnari gresite proprii, intrebarile 1-4 dispar si pachetul se reduce la 3 intrebari.

*(redactare: Claude Sonnet 4.6; validare inainte de trimitere: Claude Opus 4.1, sesiune noua)*

### Faza 3 — Dupa raspunsuri

- [ ] Incarcarea configuratiei semnate (COV/marimi/podea/z/flags) prin `saveParams` sau scriptul din Faza 1; `PARAMSJSON` complet in antetul sesiunii *(model: Claude Haiku)*
- [ ] Pack pe familii / import flags / export 41 coloane, daca raspunsurile le cer *(model: Claude Sonnet 4.6)*
- [ ] Rulare pe RUNID nou; acceptanta pe criteriul S 8 (FLAG=OK pe MAX_MANUAL>0, populatie declarata), separat de banda interna si de apropierea fata de X *(model: Claude Opus 4.1, sesiune mica)*
- [ ] Abia apoi discutia Faza 4 (apply ERP), cu autorizare separata

## 5. Riscuri

- **"Parametrizez ca sa nu decid"**: pentru A3 nu exista parametrizare ieftina — sunt doua mecanisme diferite. Se implementeaza doar dupa raspuns.
- **Faza 1 muta rezultatele numeric** (netting, ABC, univers) fara nicio decizie a beneficiarului. Procentele 85,3%/85,5% dispar ca reper si nu se mai invoca.
- **Incarcarea COV din C inainte de raspunsul la A4** ar dezactiva tacit exceptia CZ — de aceea scriptul COV este separat de seed si ruleaza in Faza 3.
- **Plafonul 60 s `X.RUNSQL`**: orice extindere a `Classify` trebuie insotita de spargerea in batch-uri (`#temp` supravietuiesc intre apeluri in aceeasi invocare AJS).
- **Sesiuni imutabile**: fiecare rulare aliniata este RUNID nou; RUNID 5/7 raman termen de comparatie "inainte", nu etalon.

## 6. Constrangeri operationale mostenite

- Fara scrieri in ERP si fara executarea `CalculMinMax.js`.
- `FLAGS_ZERO_LA_APPLY` / Faza 4 raman amanate pana la aprobare explicita.
- `minmaxEngine.editors="*"` este temporar; de restrans inainte de utilizare de beneficiar. Starea live a flagurilor se citeste din `pm2 env 0`, nu din `.env`.
- Nu se deduc parametrii live din seed/fallback; valorile efective ale unei rulari se citesc din `PARAMSJSON`/coloanele persistate.
