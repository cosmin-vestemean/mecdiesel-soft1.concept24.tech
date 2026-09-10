# Current Focus

## Last Updated
- 10.09.2026 (session 3)

## Current Goal
- Faza 1 este deblocată pentru pașii 1-5 din matricea executabilă (P14, P9, P8, P3, P7); implementarea se face într-o sesiune Sonnet dedicată.
- Restul registrului rămâne pentru sesiuni ulterioare: netting P1/P2 și univers P4 au dependențele proprii; P6 este neblocat pentru override-urile per filială, iar numai extensia de prefix așteaptă lista N5.

## Active Area
- MIN/MAX v5: I7/D05 este implementat per rulare; codul curent salvează încă `DOC`/`AGENT`/`CLIENT` în `PARAMSJSON`, dar decizia de implementare este eliminarea celor trei JSON-uri și migrarea la `CCCMINMAXRUNPARAM` ca snapshot unic.
- Ultima lucrare a fost documentară: C1-C5 sunt corecții editoriale, nu aprobări de formule sau autorizații de cod. Workspace-ul este curat după commitul `bbd7ad4`.

## Relevant Files
- [Matrice executabilă P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md): sursa de adevăr pentru deciziile luate, ordinea de implementare și locațiile de cod verificate.
- [Plan de aliniere](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): Z0-Z3, P1-P15 și succesiunea Fazelor 1-3.
- [Contradicții](../../new_min_max/10.09.2026/CONTRADICTII_SI_DIRECTII_DE_CLARIFICARE_2026-09-10.md): sursa pentru C1-C5 și întrebările de autoritate.
- [Sumar reconciliat](../../new_min_max/SUMAR_TEORETIC_CONFIRMARE.md): C1-C5 aplicate în commitul `bbd7ad4`.
- [Model wiki](../wiki/minmax-engine-model.md) și [formule wiki](../wiki/minmax-engine-formulas.md): arhitectură și formule durabile.
- [Open items wiki](../wiki/minmax-engine-open-items.md): întrebări business încă neînchise.
- [AJS NewMinMax](../../S1-MEC/AJS/NewMinMax.js): implementare deployată; nu a fost modificată în această fază.

## Confirmed Decisions
- P6 folosește o politică mixtă: `NRSAPT`, pragurile lifecycle, `SIGMA_MIN` și `SL_A/B/C` sunt globale; `SSF` este global și doar informativ (iese din formula safety); numai `LT_ZILE` și `FRECVENTA_ZILE` acceptă override cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`. HQ este explicit `BRANCH=1000`; `BRANCH=0` înseamnă fără interes local. Constanța lunară este recomandare + snapshot, nu hard lock.
- Configurația executabilă locală trăiește în tabela separată `CCCMINMAXPARAMOVERRIDE`; `CCCMINMAXTEMPLATE` rămâne doar conveniență UI. Snapshot-ul unic este `CCCMINMAXRUNPARAM (RUNID, BRANCH, PREFIX, PARAMKEY, PARAMVALUE)`, fără `FAZA`, populat o singură dată la StartRun. Cele trei coloane JSON de dezvoltare se elimină după migrarea consumatorilor.
- Selectorul de furnizor la lansare este opțional (`ALL` implicit). O alegere filtrează pe `MTRL.MTRSUP`, creează scope `SUPPLIER`, este numai pentru analiză, nu mută `ESTE_CURENT` și nu poate fi aplicată ERP.
- P14: CLI raportează A/B/C; switch-ul de lansare selectează metrica evidențiată, fără să schimbe motorul. Default C = `FLAG_TXT='OK'` pe toate rândurile cu `ERP_MAX>0`.
- P3/P7 ating obligatoriu atât Classify, cât și ClassifyGroup. `ABC_PRIM_ARTICOL_A` este global și alege primul articol cu contribuție pozitivă în populația selectată și `VAL_52S>0`; totalul zero rămâne C.
- `sp_MinMaxEngine_Prepare` este retras și se elimină din sursa/setup și din obiectele instalate. P8: SIGMA_MIN absent/NULL -> 1.3, zero valid, negativ sau nenumeric -> eroare.
- C1-C5 repară documentația; nu schimbă codul și nu înlocuiesc automat confirmările din august.
- I7/D05: atribuirea vânzărilor este selector per rulare, validată la `StartRun`, înghețată în snapshot și folosită de `Classify`/`ClassifyGroup`.
- SQL Server Agent rulează fazele grele, evitând plafonul de 60 s al apelurilor AJS; `applyToErp` rămâne amânat.
- **Corectat 10.09.2026:** banda `FLAG_RATIO 0,50-2,00` din validator NU este criteriul S 8. Cifrele `0.50`/`2.00` sunt marginile exterioare ale scalei `FLAG_TXT` din [03_compute.sql](../../new_min_max/sql/03_compute.sql), deci testul numără `DOWN`+`OK`+`UP`. Criteriul clientului este `FLAG=OK` (`.77-1.30`) pe `MAX_MANUAL > 0`. Procentele istorice 85,3%/85,5% răspund altei întrebări.
- `MAX_MANUAL` = `ERP_MAX` (`REMAINLIMMAX`, pus de om); `ERP_MAX_AUTO` (`CCCMAXAUTO`/`CCCMAXAUTOCOMP`) e valoarea calculată de motor și nu intră în populația de acceptanță.
- P2: cheia de netting rămâne `TRDR`, reconfirmat ca abatere conștientă de la contractul de intrare („`Cod client` — cheie de netting"); motorul exclude pe CODE și netează pe ID. P8: `SIGMA_MIN = 0` explicit produce safety=0, seed-ul rămâne `1.3` parametrizat. P9: rămâne `MEDIANA` (cerere beneficiar E2). P3: ambele schimbări ABC, în doi commiți, cu prag `<=` („A până la 80% inclusiv", S 4.8), ambele comutabile prin `ABC_CONVENTIE_CUMUL` / `ABC_POPULATIE`, plus `ABC_PRIM_ARTICOL_A` pentru articolul dominant. Toate combinațiile produc fluxul complet; alegerea metodologică și efectul numeric sunt responsabilitatea utilizatorului, iar validatorul verifică integritatea configurației active. P7: se folosesc cheile de parametri declarate de beneficiar.
- `MOD_ATRIBUIRE_FILIALA` rămâne `CLIENT`; `PSAL` și `overmax` din jobul legacy sunt confirmate ca eliminate intenționat de specificația nouă.
- **Plancherul `σ_WK = 1,3` nu are acoperire în răspunsul beneficiarului** — vezi firul `e3-plancher-sigma-fara-provenienta`. F5 (sigma reală) este în schimb confirmat verbatim prin e-mail.

## Open Questions
- Rămase deschise din matricea executabilă: P2 (HQ ca scope propriu de netting), P4/N9-N10 (fallback univers HQ și surse stoc/ORD), P5 (OD primește și BUY după podea?), P10 (clamp stoc negativ), P11 (baza TREND), P12 (SL pentru NOU), P13 (MIN_DOC/ultima vânzare), P6/N5 (lista canonică și DEFAULT prefixe).
- Autoritatea A1/A3/A4/B2 (Z2) și N01/N02/N06 (Z3) se închide doar prin răspunsul beneficiarului.
- Rămân de clarificat `LT_ZILE`/`FRECVENTA_ZILE`, `COV_MEDIU`, `σ_LT`, `FLAGS_ZERO_LA_APPLY` și formula ABC pe grupă.
- Intenția matricei COV rămâne deschisă, deși comparația numerică este corectată la `CX = BY = 2,00 > BZ = 1,75`.

## Next Step
- Sesiune Sonnet: urmează ordinea revizuită din matrice — retragere Prepare → P14 CLI → P8 → snapshot unic și eliminare JSON → P3a/P3b în 01+02 → P7 în 01+02. `node new_min_max/tools/sync-check.cjs` după orice editare SQL; rularea engine-ului și deploy-ul AJS rămân manuale, la utilizator.
- Ulterior P6 adaugă `CCCMINMAXPARAMOVERRIDE`, resolverul LT/frecvență, UI-ul și scope-ul analitic `SUPPLIER`; longest-prefix rămâne condiționat de N5.

