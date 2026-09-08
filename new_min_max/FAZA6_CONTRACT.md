# Faza 6 — contract: orchestrare și ciclul de viață al sesiunii

> **Status: propunere, neconfirmată de beneficiar.** Faza s-a format din patru fire deschise în
> sesiunea 40 (08.09.2026), grupate pentru că împart aceeași proprietate: **toate cer atingerea
> procedurilor stocate și un deploy AJS**. Separat, fiecare ar fi o vizită la aceleași fișiere.
>
> Declanșatorul e o cerință nouă: beneficiarul vrea să lanseze singur ciclul lunar din interfață.
> [FAZA5_CONTRACT.md](FAZA5_CONTRACT.md) exclude explicit `runEngine` din iterația 1, iar
> [../S1-MEC/AJS/NewMinMax.js](../S1-MEC/AJS/NewMinMax.js) are **un singur endpoint**, `setup` —
> deci nu e „de cablat", ci de scris.

Referințe: [FAZA5_REMEDIERI_PLAN.md](FAZA5_REMEDIERI_PLAN.md) Pasul 8,
[FAZA4_CONTRACT.md](FAZA4_CONTRACT.md) pentru convenții,
[minmax-engine-model.md](../.copilot/wiki/minmax-engine-model.md) pentru modelul de operare și retenție.

---

## 1. Precondiție absolută

**Pasul 8 nivel B trebuie încheiat pe `RUNID=5` înainte de orice livrare din această fază.**

Nu e o preferință de ordonare. Orice element de aici duce, direct sau indirect, la o sesiune nouă,
iar `FinishRun` mută `ESTE_CURENT`. Eșantionul numeric înghețat își pierde reperul exact atunci.
În plus, `RUNID=6` ar rula pe altă fereastră de date — o vânzare a aterizat pe `2026-09-07`, chiar
`AZI`-ul rulării 5 — deci diferențele ar amesteca *fixul* cu *mișcarea datelor*, adică exact
distincția pe care nivelul B trebuie s-o poată face.

### Secvența de livrare, în ordine

| # | Pas | Observație |
|---|---|---|
| 1 | Pasul 8 nivel B pe `RUNID=5` | eșantion înghețat în `new_min_max/analiza/` |
| 2 | **Curățarea sesiunilor de test `RUNID 1–4`** | vezi mai jos |
| 3 | Deploy-ul Fazei 6, ca unitate | `sync-check.cjs` înainte |
| 4 | Prima rulare **din interfață** → `RUNID=6` | testul butonului |
| 5 | `validate-minmax-invariants.cjs 6` → **9/9** | confirmă și fixul `ClassifyGroup` |

`RUNID=5` **nu** se curăță la pasul 2: rămâne sesiunea curentă până când `RUNID=6` o înlocuiește, și
este singurul reper dacă prima rulare din interfață iese prost. După pasul 4 devine „precedenta", deci
e păstrată de politica de retenție (`DET` curentă + precedenta) — prin regulă, nu prin excepție.

### Curățarea sesiunilor de test — operație unică, nu retenție

`RUNID 1–4` sunt artefacte de dezvoltare: 1–3 au câte 14 rânduri (smoke tests pe un singur articol),
4 are 713.818 rânduri și `GROUP` lipsă. Toate au `SESSION_STATUS = NULL` — legacy prin construcție,
dinaintea modelului de sesiune. Curățarea lor eliberează ~700 MB, practic doar `RUNID=4`.

**Nu confunda asta cu `PurgeRun`.** Sunt operații diferite, cu reguli diferite:

| | Retenție (`PurgeRun`) | Curățarea de test |
|---|---|---|
| Ce șterge | doar `DET`/`WEEK`/`WINSOR` | și antetul |
| Antet | **păstrat pentru totdeauna** — e registrul | șters: n-are ce căuta în registru |
| Frecvență | continuu, după politică | **o singură dată** |

Antetele lui 1–4 nu aparțin registrului operațional — ar apărea pentru totdeauna în ecranul de
istoric al beneficiarului, deasupra primei rulări reale, fără să însemne nimic. `IDENTITY` nu se
resetează, deci `RUNID=6` rămâne 6; golul e onest și preferabil unei renumerotări.

> **De confirmat înainte de execuție:** dacă vrei ca antetele lui 1–4 să rămână ca urmă istorică a
> dezvoltării, se șterge doar detaliul. Implicit în acest contract: **ștergere completă**, pentru un
> ecran de istoric curat la predare.

Eșantionul de nivel B nu blochează purjarea ulterioară a lui `RUNID=5`: verdictele se consemnează în
`new_min_max/analiza/` ca valori așteptate, deci comparația „înainte/după" se face față de fișier, nu
față de `DET`. Niciun „pin" nu e necesar.

## 2. Principiul care ține faza

**Baza de date e sursa de adevăr pentru starea și progresul unei sesiuni, nu apelul HTTP.**

Mașina de stări e deja persistată (`SESSION_STATUS`, `STATUS`, `GROUP_STATUS`, `COMPUTE_STATUS` cu
`*_STARTEDAT`/`*_FINISHEDAT`). Dacă un apel moare, sesiunea rămâne descriptibilă. Toate deciziile de
mai jos decurg de aici — inclusiv aceea de a nu aștepta pe socket cele ~2 minute ale unei rulări.

## 3. Transport — endpoint AJS, nu whitelist de `EXEC`

**Decizie: `EXEC` rămâne blocat în WSMCP. Nu se deschide un whitelist de proceduri.**

Varianta whitelist a fost evaluată și respinsă pe fond, nu din inerție:

- Garda `WSMCP_classifyStatement` își trage puterea din faptul că **scanează textul și nu parsează** —
  comentariul din cod o spune explicit. De aceea `EXEC('DROP TABLE X')` nu trece: `stripStrings`
  golește literalul, dar `EXEC` rămâne în text.
- Procedurile se numesc `sp_MinMaxEngine_*`, deci trip **ambele** gărzi: cuvântul `EXEC` **și**
  prefixul `\bSP_\w*`. A doua e exact cea care oprește `sp_executesql`, `sp_configure`, `xp_cmdshell`.
- Un whitelist ar trebui să prindă *toate* aparițiile dintr-un statement, nu prima
  (`EXEC sp_MinMaxEngine_StartRun; EXEC sp_configure` e același șir).
- WSMCP e **partajat cu serverul MCP**. Un parser de securitate scris în AJS, fără harness de test,
  într-un gateway partajat, e cea mai proastă combinație posibilă.
- E și regula #2 din [FAZA5_REMEDIERI_PLAN.md](FAZA5_REMEDIERI_PLAN.md), aplicată la stratul S1:
  *„se schimbă statement-ul, nu garda"*.

Un endpoint AJS e un punct de intrare cu **nume și formă fixă** — poate face doar ce scrie în corpul
lui. Zero parsing, zero regex. Și e mai puțin de lucru: o funcție în `NewMinMax.js` față de un
parser plus un whitelist în Node.

## 4. `runEngine` — două endpoint-uri, nu unul

Un singur apel sincron de ~2 minute e o capcană: timeout de socket, tab închis, proces repornit.

| Endpoint AJS | Durată | Rol |
|---|---|---|
| `startRun` | ms | doar `EXEC sp_MinMaxEngine_StartRun` → întoarce `RUNID` |
| `runPhases` | ~2 min | `Classify → ClassifyGroup → Compute → FinishRun` pe `RUNID` dat |

Metoda de serviciu `runEngine()`:

1. verifică `_writesEnabled()` și rolul, **înainte** de orice;
2. apelează `startRun` și **așteaptă** `RUNID`;
3. lansează `runPhases` **fără `await`**, cu `.catch` care doar loghează;
4. returnează `{ runId }` imediat.

UI-ul face poll pe `history()`. Coloanele de fază există deja, deci **progresul se afișează fără
nicio coloană nouă**. Dacă apelul cade, sesiunea rămâne `OPEN` și intră pe calea de abandon (§5).

Separarea în două endpoint-uri nu e cosmetică: fără ea, clientul n-ar afla `RUNID`-ul decât la final,
deci n-ar avea ce să interogheze cât timp rularea e în curs.

## 5. Ciclul de viață — gardă de concurență și abandon

`sp_MinMaxEngine_StartRun` validează azi `@Scope`/`@Mtrl`, apoi face `INSERT` **necondiționat**. Nu
verifică dacă există deja o sesiune `OPEN`.

Azi e latent — doar un dezvoltator care rulează statement-uri manual poate deschide o sesiune. Cu un
buton în UI devine mod de eșec real: dublu-click ⇒ două pipeline-uri de ~37M rânduri concurente;
`FinishRun` mută `ESTE_CURENT`, deci câștigă ultima care termină, nedeterminist.

```sql
IF EXISTS (SELECT 1 FROM CCCMINMAXRUN
           WHERE COMPANY = @Company AND SESSION_STATUS = 'OPEN')
    THROW 50039, 'sp_MinMaxEngine_StartRun: a session is already OPEN.', 1;
```

**Garda nu se livrează singură.** Fără cale de recuperare, primul eșec la mijloc de pipeline blochează
motorul definitiv. Deci la pachet: `sp_MinMaxEngine_AbandonRun @RunId` → `SESSION_STATUS = 'ABANDONED'`,
**zero `DELETE`**. Rândurile parțiale rămân marcate; `_resolveRunId()` cere deja `SESSION_STATUS='DONE'`,
deci o sesiune abandonată nu poate deveni vizibilă accidental.

Respinsă deliberat varianta „timeout automat pe sesiuni mai vechi de N minute": alege un `N` arbitrar
și poate porni a doua rulare peste una lentă, încă vie. Recuperarea tăcută contrazice modelul de
sesiune imutabilă.

**Dublu-click — trei straturi, fiecare cu rolul lui:**

| Strat | Ce prinde |
|---|---|
| buton `disabled` + stare în store | click repetat în aceeași filă |
| `THROW 50039` | a doua filă, al doilea utilizator, reconectare |
| serviciul traduce `50039` | mesaj „o sesiune este deja în curs" + afișarea ei, **nu** eroare roșie |

Al treilea nu e opțional: fără el, un dublu-click normal produce ceva ce arată ca un defect.

## 6. `PurgeRun` și retenția

Politica e decisă și documentată în [minmax-engine-model.md](../.copilot/wiki/minmax-engine-model.md),
secțiunea „Retenția sesiunilor". Rezumat: `DET` curentă + precedenta, `WEEK`/`WINSOR` doar curenta,
antet + `PARAMSJSON` + `GRP` pentru totdeauna. Măsurat: **~730 MB per sesiune**, din care `DET` e 96%.

**Mecanism separat de politică.** `sp_MinMaxEngine_PurgeRun @RunId` execută, nu decide. Politica —
câte sesiuni se păstrează — stă în `CCCMINMAXPARAMS` ca `RETENTIE_DET_SESIUNI` (implicit `2`), iar
alegerea `RUNID`-urilor de purjat e a apelantului.

Gărzi, exact două, ambele împotriva distrugerii setului de lucru:

| Cod | Refuz |
|---|---|
| `50042` | `ESTE_CURENT = 1` |
| `50043` | `SESSION_STATUS = 'OPEN'` — rulează chiar acum |

**Nu** există gardă „refuz pe sesiune aplicată în ERP", deși pare firească. `CCCMINMAXAPPLY`
([FAZA4_CONTRACT.md](FAZA4_CONTRACT.md) §7) păstrează deja `OLD_*`/`NEW_*`/`ENG_MIN`/`ENG_MAX` per
poziție scrisă, cu `RUNID` și autor — apply-ul își ține singur dovada, la ~78.000 rânduri înguste
față de 706.734 late. Consecință utilă: **faza nu depinde de Faza 4.**

Ștergerea se face în loturi. `DET` fiind clustered pe `(RUNID, BRANCH, MTRL)`, ștergerea pe `RUNID` e
un range scan eficient, dar 706k rânduri într-o singură tranzacție umflă log-ul inutil.

**Tensiunea de rezolvat explicit:** modelul actual are **zero `DELETE`** pe tabele persistate.
Rezolvarea nu e o excepție, ci o distincție — **imutabilitatea înseamnă „o sesiune nu se rescrie
niciodată", nu „nu se șterge niciodată"**. Prima garanție rămâne intactă. De aceea purjarea e o
operație explicită și separată, niciodată ceva ce face o fază implicit.

## 7. Fixul `ClassifyGroup` (pasager)

Din [FAZA5_REMEDIERI_PLAN.md](FAZA5_REMEDIERI_PLAN.md) Pasul 8: `NR_SKU_GRP` numără articole din
afara perimetrului (468 din 559 rânduri de grupă non-HQ pe `RUNID=5`), pentru că `#ItemGroups` se
construiește din `#SalesLines` nefiltrat.

Călătorește aici pentru că deploy-ul pleacă oricum. Singur nu s-ar fi justificat: nicio valoare
calculată nu e afectată (`VZ_52S` și `VAL_52S` de grupă coincid exact cu agregarea `CCCMINMAXDET`).

**Nu e „o singură clauză".** `#IncludedLines` (§5) se construiește **din** `#ItemGroups` și `#Groups`
(§3), deci inversarea ar fi un ciclu. Fixul cere:

1. mutarea blocului `#ActiveBranches` (§4) înaintea §3;
2. rescrierea filtrului din `#ItemGroups` pe populația restrânsă la filiale active;
3. acceptarea inversării ordinii `THROW` — `50002` ajunge înaintea lui `50003`.

**De verificat înainte de implementare:** o grupă ale cărei articole s-ar vinde exclusiv pe filiale
închise ar dispărea complet din `#Groups`, nu doar și-ar corecta contorul. Improbabil pe 43 de grupe,
dar e schimbare de comportament, nu de contor.

## 8. Autorizare și audit

**Autorizare.** Hook `minmax.edit` — decizie de beneficiar: *cine poate scrie parametrii poate și
rula o sesiune*. Raționamentul stă în picioare: cine setează `SSF`, `SL_A`, matricea `COV` sau
`HQ_CAP_FACTOR` determină deja *ce* produce o rulare.

**Kill-switch.** `_writesEnabled()` se verifică **explicit** ca primă instrucțiune în `runEngine()` și
`purgeRun()`. Calea AJS **nu moștenește** nimic de la calea `execSql` — `MINMAX_ENGINE_WRITES_ENABLED`
gardează azi doar `saveParams`. De adăugat o linie în descrierea configurației: flagul înseamnă de
acum *orice operație care schimbă starea în S1*.

**Audit: log app-side, nu tabelă `CCC`.** O tabelă de audit ar trebui adăugată în whitelist-ul de
scriere din `sql-guard.js`, deci **exact canalul auditat și-ar putea falsifica propriul audit** —
aceeași eroare de proiectare respinsă la tabela de roluri (FAZA5_CONTRACT §12.8). Logul e scris de
proces, nu de browser.

Formă: `REFID`, timestamp, operație, iar pentru lansare și `RUNID`-ul rezultat — răspunde la „cine a
mutat sesiunea curentă?". Acoperă și restanța de audit din Pasul 6 al Fazei 5 (`saveParams`).

## 9. Coduri `THROW` alocate

Continuă alocarea din [minmax-engine-model.md](../.copilot/wiki/minmax-engine-model.md)
(`50030-50032` StartRun, `50033-50038` FinishRun, `50020-50024` rezervate Fazei 4):

| Cod | Procedură | Condiție |
|---|---|---|
| `50039` | `StartRun` | există deja o sesiune `OPEN` pe companie |
| `50040` | `AbandonRun` | `RUNID` inexistent sau sesiunea nu e `OPEN` |
| `50041` | `PurgeRun` | `RUNID` inexistent |
| `50042` | `PurgeRun` | refuz pe `ESTE_CURENT = 1` |
| `50043` | `PurgeRun` | refuz pe `SESSION_STATUS = 'OPEN'` |

## 10. Formă și localizare

Aceeași structură ca fazele 1–4:

- `sp_MinMaxEngine_AbandonRun` și `sp_MinMaxEngine_PurgeRun` în `new_min_max/sql/00g_lifecycle.sql`;
- modificările la `StartRun` în `00e_start_run.sql`, la `ClassifyGroup` în `02_classify_group.sql`;
- fiecare oglindită într-un `get*Sql()` din `NewMinMax.js`, înregistrată în `setup()`;
- **pereche nouă în [tools/sync-check.cjs](tools/sync-check.cjs)** pentru fiecare fișier SQL nou.

`sync-check.cjs` raportează deja `UNREGISTERED` pentru un `get*Sql()` fără pereche, deci un bloc
uitat nu poate diverge tăcut. **De rulat după fiecare editare de SQL**, fără excepție.

## 11. Endpoint-uri AJS și metode de serviciu

| Endpoint AJS | Metodă serviciu | Rol |
|---|---|---|
| `startRun` | *(internă)* | deschide sesiunea, întoarce `RUNID` |
| `runPhases` | *(internă, fire-and-forget)* | rulează cele patru faze |
| — | `runEngine` | orchestrează 1+2, întoarce `{runId}` |
| `abandonRun` | `abandonRun` | marchează `ABANDONED` |
| `purgeRun` | `purgeRun` | purjează `DET`/`WEEK`/`WINSOR` |

## 12. Plan de validare

1. Suită unit verde pe serviciu (mock pe transportul AJS, ca la `execSql` cu `nock`).
2. `startRun` de două ori consecutiv → al doilea primește `50039`, tradus în mesaj, nu în eroare.
3. `abandonRun` pe sesiunea rămasă `OPEN` → `startRun` funcționează din nou.
4. **Prima rulare reală se lansează din interfață** — testul butonului și confirmarea fixului în
   același gest.
5. `node new_min_max/tools/validate-minmax-invariants.cjs 6` → **9/9**, inclusiv `det_grp`.
6. `purgeRun` pe `ESTE_CURENT=1` → `50042`; pe o sesiune veche → `DET` dispare, antetul rămâne.
7. Recitire după purjare: `history()` arată în continuare toate sesiunile, cu parametrii lor.

## 13. Todo list, cu model recomandat

- [ ] 1. `AbandonRun` + `PurgeRun` în `00g_lifecycle.sql` *(model: Sonnet)*
- [ ] 2. Garda `50039` în `StartRun` *(model de bază)*
- [ ] 3. Fixul `ClassifyGroup` — reordonare + filtru *(model: Sonnet; verificare grupă dispărută întâi)*
- [ ] 4. `getLifecycleSql()` + perechi în `sync-check.cjs` *(model de bază)*
- [ ] 5. Endpoint-uri AJS `startRun`/`runPhases`/`abandonRun`/`purgeRun` *(model: Sonnet)*
- [ ] 6. Transport AJS în serviciul Feathers, separat de `execSql` *(model: Sonnet)*
- [ ] 7. `runEngine`/`abandonRun`/`purgeRun` ca metode, cu `_writesEnabled()` + `minmax.edit` *(model: Sonnet)*
- [ ] 8. Audit app-side, acoperind și `saveParams` *(model: Sonnet)*
- [ ] 9. UI: buton de lansare, poll pe `history()`, traducerea lui `50039` *(model: Sonnet)*
- [ ] 10. Seed `RETENTIE_DET_SESIUNI` în `00_params.sql` *(model de bază)*
- [ ] 11. Curățarea `RUNID 1–4` — script unic, versionat, rulat **după** nivelul B *(model de bază)*
- [ ] 12. Validare live conform §12 *(model: Opus, agentul `Review`, context mic)*

## 14. Constrângeri de respectat

1. **Nivel B înainte de orice** (§1). Nu porni `RUNID=6` până eșantionul nu e înghețat, și nu curăța
   `RUNID 1–4` înaintea lui. `RUNID=5` nu se atinge — e reperul dacă prima rulare din UI iese prost.
2. **Un singur deploy**, cu `sync-check.cjs` rulat înainte. Nu patru vizite la aceleași proceduri.
3. **Nu relaxa garda WSMCP** (§3). Dacă un statement nu trece, se schimbă statement-ul.
4. `NewMinMax.js` e hardlink către submodul — orice modificare cere commit în submodul **și** commit
   de pointer în repo.
5. Purjarea rămâne explicită. Nicio fază nu șterge implicit.

## 15. În afara acestei faze

- **Tabela de rezumat per sesiune** (distribuția `FLAG_TXT`, `CLASA`, `SUM(BUY_QTY)`, % în bandă,
  contoare `WARN_*`). Fără ea, parametrii istorici nu pot măsura randamentul — parametrii spun *ce ai
  setat*, nu *ce ai obținut*. Este **electivă**, ca și `explain`: nu a fost cerută de client. De
  etichetat ca atare, ca să nu fie apărată peste șase luni ca obligație contractuală.
- Șabloane de parametri per prefix, și odată cu ele extinderea `PARAMSJSON` la suprafața **rezolvată**
  de parametri — vezi firul `paramsjson-nu-captureaza-parametri-rezolvati`.
- Faza 4 `applyToErp`, care rămâne independentă de această fază.
