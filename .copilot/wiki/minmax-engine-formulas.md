# MIN/MAX Engine v5 — Reguli de business și formule

> Fapte durabile despre semantica flagurilor, warning-urilor și formulelor. Editează in-place.
> Distinct de wiki-ul HTML de transparență inițiat de echipă (vezi secțiunea Transparență).

## Flaguri MTRL

- **Mapare confirmată din ecranul „Nomenclator articole" (03.09.2026):** `CCCITEMOUTLET` = În
  lichidare (2.232 articole), `CCCBLOCKPUR` = Blocat achiziții (21.079), `CCCEXSTAT` = **Exclude
  statistici** (21.139). `CCCEXSTAT` și `CCCBLOCKPUR` sunt 98% același set; `CCCITEMOUTLET` e
  practic submulțime.
- **`CCCEXSTAT` e flagul operant, nu `CCCBLOCKPUR`.** `necesar-achizitii/NecesarAchizitie.js` din
  producție îl filtrează deja dur (`isnull(m.cccexstat,0)=0 AND m.isactive=1`); motorul nou îl
  citește doar informativ (`FLAG_EXCLUS`). Parametru `INCLUDE_EXSTAT_IN_STATISTICI` default 0
  (item 13, plan §10). Grup de risc: 1.614 articole `CCCEXSTAT` cu min/max întreținut manual în
  `MTRBRNLIMITS`. Setarea la 0 taie universul 52.701 → ~31.562 (−40%) dar NU înlocuiește
  rescrierea sparse (seria densă tot ~22M rânduri, ~0,5% densitate).
- **`CCCBLOCKPUR` = blocat la achiziție**, confirmat client. 21.079 SKU (40%), 29,0% din valoarea
  52S, dar încă 20,9% din ultimele 4 săptămâni (2.088 SKU vândute) → marfă în lichidare vândută
  activ, deci raportul trebuie s-o arate, nu s-o ascundă.
- **Impact ABC măsurat al scoaterii `CCCEXSTAT` din Pareto (03.09.2026, read-only):** pe 64.516
  rânduri `BRANCH×MTRGROUP×MTRL`, 3.050 schimbări de clasă (4,7%) — 521 promovări, 2.529
  retrogradări, 1.226 pierd `A`; clasa `A` 18.636→17.684 (−5,1%). **Direcție contraintuitivă:**
  pragul e % din `GRP_TOTAL_VAL`, deci scăderea totalului face cumulativul să atingă 80% mai
  devreme → `A` se restrânge. Comportamentul actual **supra-stochează** (nu sub-stochează).

## Warning-uri Compute

- `WARN_STOC_MORT` = `ENG_MAX=0 AND STOC_QTY>0` (E9, `PLAN_IMPLEMENTARE.md` §325-326).
- `WARN_STOC_NEG` = `STOC_QTY<0` (E10).
- `WARN_VZ26_ZERO` = 1 când `VZ_26S<=0` (exact când s-a folosit sentinela `VZ26_CAP_SENTINEL=9999`).
- `FAZA3_HANDOFF.md` §4.3 le enumeră fără definiție — sursa e planul, nu handoff-ul.

## Criteriul `FLAG` — calibrare

- **Măsurat pe RUNID 4 (03.09.2026):** 682.098/713.818 rânduri (95,6%) sunt `FARA_REFERINTA`, deci
  nu intră în calibrare. Pe populația curată (17.945 rânduri `STANDARD/NOU`, cu `ERP_MAX`, fără
  lichidare/blocare/excludere): eticheta strictă `OK` (0,77–1,30) acoperă 40,9%, dar banda
  necritică `0,50–2,00` (`DOWN+OK+UP`) acoperă **85,77%**.
- **Confirmare client:** acceptanța înseamnă >80% în banda necritică `0,50–2,00`, NU >80% etichetă
  `OK` strictă. Nu lărgi eticheta `OK` fără decizie explicită.
- **Vederea implicită a UI-ului trebuie filtrată** — fără filtru, beneficiarul vede >700.000 rânduri
  majoritar `FARA_REFERINTA`/`VZ_26S=0`. Filtrul implicit din `FAZA5_CONTRACT.md` §5:
  `flagTxt IN (DOWN,OK,UP,MAJOR_UP,SUPRASTOC)` + `VZ_26S > 0`.

## Gotcha T-SQL

- **Modulo pe DECIMAL nu există.** `BUY_QTY % N_PACK` (cum scrie `FAZA3_HANDOFF.md` §7.4) eșuează
  cu „Operand data type decimal is invalid for modulo operator". Implementat corect ca
  `BUY_QTY - FLOOR(BUY_QTY / N_PACK) * N_PACK <> 0` în `03_compute.sql`; handoff-ul a rămas
  necorectat conștient (igienă de documentație, nu blochează).
- Nu există `LEAST`/`GREATEST` scalar înainte de SQL Server 2022 — folosește
  `(SELECT MIN(v) FROM (VALUES (a),(b),(c)) t(v))`, cu `CONVERT` explicit la tipul țintă ca precizia
  intermediară să nu urce la `DECIMAL(38,x)`.

## Baseline numeric Nivel B

Baseline-ul `RUNID=5` este fixat în `new_min_max/analiza/esantion_minmax_run5.json` și se regenerează
read-only cu `new_min_max/tools/freeze-minmax-sample.cjs`. Selecția are 31 triplete unice și 35 de
criterii: toate cele 22 celule relevante `CLASA × MARIME`, lifecycle `STANDARD/NOU/OD`, HQ/non-HQ,
ramurile exercitabile și cazurile cu impact maxim. `MARIME=MEDIU` lipsește complet din sesiune, iar
`N_PACK=1` peste tot face ramura pack indisponibilă; ambele absențe sunt explicite în artefact.

Snapshot-ul conține parametrii rulării, inputurile și intermediarii calculați, dependențele
`SUM_BR_MAX`/`HQ_ENG_MIN`, winsorizarea și câte 52 de poziții săptămânale per triplet; săptămânile
absente din tabela sparse sunt materializate cu zero. Lanțul `SAFETY → BUY_QTY` este recalculat
independent cu rotunjire la `DECIMAL(28,8)` după fiecare etapă și verificat suplimentar cu Python
`Decimal`: 31/31 PASS. Acesta este baseline persistent, nu dovada valorilor randate în UI;
comparația manuală cu drawer-ul `explain` rămâne necesară pentru închiderea Nivelului B.

## `SLTS` — închis, a nu se redeschide

Comportamentul invers intenției teoretice (clasa A primește 0,0526, clasa C 0,333) e lacuna **L3**
din `analiza/validare_teoretica_formula.md`; clientul a acceptat-o ca atare pe 14.08.2026, fără
corecție.

## Transparență — wiki HTML pentru beneficiar

Wiki-ul HTML atașat aplicației este o **inițiativă a echipei**, nu o cerință contractuală. El publică
formulele și deciziile din `Compute`
(tipar: `public/help/zero-minmax-help.html`, `<iframe>`/modal). Se generează dintr-o sursă unică,
parametrii se injectează live din `CCCMINMAXPARAMS` (nu hardcodați). Coloanele intermediare din
`CCCMINMAXDET` (`SAFETY`/`BUF`/`CYCLE`/`CAP6`/...) sunt load-bearing pentru drill-down-ul „explică
acest calcul" — vezi `explainRow` în `faza5-ui-backend.md`. Detalii: `FAZA3_HANDOFF.md` §9.
