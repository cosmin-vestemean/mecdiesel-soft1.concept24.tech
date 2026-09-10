# Faza 6 — contract: orchestrare și ciclul de viață al sesiunii

> **Status (08.09.2026): arhitectura de execuție a fost înlocuită cu SQL Server Agent, ca remediere
> a plafonului confirmat de 60s ADO CommandTimeout pe `X.RUNSQL`/`X.GETSQLDATASET` (§4 mai jos).
> Codul e editat și verificat static (`sync-check.cjs`, `node --check`, teste unitare); NU a fost
> încă deployat/rulat `setup()` în S1, nu s-a pornit niciun job Agent, nu s-a lansat o sesiune nouă.
> `RUNID=5` rămâne sesiunea curentă neatinsă.** Faza s-a format din patru fire deschise în
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

`RUNID 1–4` au fost artefacte de dezvoltare: 1–3 aveau câte 14 rânduri (smoke tests pe un singur
articol), iar 4 avea 713.818 rânduri și `GROUP` lipsă. Toate aveau `SESSION_STATUS = NULL` — legacy
prin construcție, dinaintea modelului de sesiune. Curățarea completă a fost executată după închiderea
Nivelului B; verificarea read-only a confirmat zero rânduri în `RUN/DET/WEEK/WINSOR/GRP` pentru 1–4.

**Nu confunda asta cu `PurgeRun`.** Sunt operații diferite, cu reguli diferite:

| | Retenție (`PurgeRun`) | Curățarea de test |
|---|---|---|
| Ce șterge | doar `DET`/`WEEK`/`WINSOR` | și antetul |
| Antet | **păstrat pentru totdeauna** — e registrul | șters: n-are ce căuta în registru |
| Frecvență | continuu, după politică | **o singură dată** |

Antetele lui 1–4 nu aparțin registrului operațional — ar apărea pentru totdeauna în ecranul de
istoric al beneficiarului, deasupra primei rulări reale, fără să însemne nimic. `IDENTITY` nu se
resetează, deci `RUNID=6` rămâne 6; golul e onest și preferabil unei renumerotări.

Decizia executată: **ștergere completă**, inclusiv antetele, pentru un ecran de istoric curat la
predare. `IDENTITY` nu a fost resetat; următoarea sesiune rămâne `RUNID=6`.

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

Endpoint-urile cer suplimentar cheia aplicației din `CCC_WSMCP_AUTH`, activă și cu
`ALLOW_WRITE=1`. Cheia este adăugată numai de transportul Feathers și nu ajunge în browser;
astfel un utilizator cu simplu `clientID` S1 nu poate ocoli rolul `minmax.edit` sau kill-switch-ul
apelând direct AJS.

## 4. `runEngine` — două endpoint-uri, execuția reală în SQL Server Agent

**Cauza confirmată (08.09.2026):** `X.RUNSQL`/`X.GETSQLDATASET` au un ADO CommandTimeout fix de
**60 secunde** la nivelul runtime-ului S1, nereproductibil de codul din acest repo (`WAITFOR DELAY
'0:00:45'` reușește, `'0:01:30'` eșuează la exact 60009ms, `80040E31`). `sp_MinMaxEngine_Classify`
are nevoie de ~90-93s pe date de producție → depășește mereu plafonul dacă rulează *prin* apelul AJS.
Decizie: **fazele grele nu mai rulează în procesul care răspunde la request-ul AJS** — rulează într-un
job SQL Server Agent, pornit explicit și monitorizat prin starea persistentă din `CCCMINMAXRUN`, exact
ca înainte.

| Endpoint AJS | Durată | Rol |
|---|---|---|
| `startRun` | ms | verifică sincron pregătirea job-ului Agent (§4.1), apoi `EXEC sp_MinMaxEngine_StartRun` → `RUNID` |
| `runPhases` | ms | validează `RUNID` cerut = singura sesiune `OPEN` a companiei, apoi `EXEC msdb.dbo.sp_start_job` pe jobul fix al companiei și întoarce imediat |

Job-ul Agent execută `dbo.sp_MinMaxEngine_RunPhases @Company=<company>` — procedura care rezolvă ea
însăși singura sesiune `OPEN` (niciodată `MAX(RUNID)`) și înlănțuie `Classify(@Persist=1) →
ClassifyGroup → Compute → FinishRun`, fără nicio limită de 60s (nu trece prin ADO).

Metoda de serviciu `runEngine()`:

1. verifică `_writesEnabled()` și rolul, **înainte** de orice;
2. apelează `startRun` și **așteaptă** `RUNID`;
3. apelează `runPhases` și **așteaptă** răspunsul — acum e doar lansarea jobului, milisecunde, nu
   cele ~2 minute ale pipeline-ului; o eroare de lansare ajunge deci direct la apelant;
4. returnează `{ runId }`.

UI-ul face poll pe `history()`. Coloanele de fază există deja, deci **progresul se afișează fără
nicio coloană nouă**. Dacă lansarea jobului eșuează, sesiunea rămâne `OPEN` — **fără abandon automat** —
și intră pe calea de abandon explicit (§5); serviciul nu mai înghite eroarea într-un `.catch` care doar
loghează, cum se întâmpla în varianta fire-and-forget inițială.

Polling-ul browser este limitat la 600 încercări la 3 secunde (~30 minute), tolerează trei erori tranzitorii și
oferă explicit „Abandonează RUNID” pentru recuperarea unei sesiuni rămase `OPEN`. `AbandonRun`
refuză backend o sesiune cât timp jobul companiei rulează, iar butonul rămâne dezactivat în timpul
polling-ului; erorile `STATUS`/`GROUP_STATUS`/`COMPUTE_STATUS` opresc imediat polling-ul și afișează
mesajul specific fazei.

Separarea în două endpoint-uri nu e cosmetică: fără ea, clientul n-ar afla `RUNID`-ul decât la final,
deci n-ar avea ce să interogheze cât timp rularea e în curs.

### 4.1 Pregătire — job-ul per companie, verificat înainte de a deschide o sesiune

`dbo.sp_MinMaxEngine_EnsureAgentJob @Company` recreează idempotent și tranzacțional jobul fix
`MEC_MinMaxEngine_RunPhases_<company>`: activat, **fără schedule** (pornit doar explicit, via
`sp_start_job`), server local, un singur pas `TSQL` în baza curentă care execută
`EXEC dbo.sp_MinMaxEngine_RunPhases @Company=<company>`. Rulat din `setup()`, o dată per companie
reală (`X.SYS.COMPANY`) — nu acceptă un nume de job dat de apelant. Ownerul este loginul built-in
identificat prin SID `0x01` (supraviețuiește redenumirii lui `sa`). Dacă jobul rulează, setup-ul
refuză realinierea (`50051`) în loc să modifice infrastructura sub o execuție activă.

`startRun` verifică, **după validarea payload-ului și înainte** de a deschide sesiunea, definiția
completă a jobului (enabled, un singur pas, comandă/bază/acțiuni corecte, server local, zero schedule),
că serviciul SQL Server Agent rulează și că loginul AJS îl poate gestiona; dacă verificarea eșuează,
întoarce o eroare structurată (`errorCode` 50045/50046/50050) și **nu deschide niciun `RUNID`** — altfel ar rămâne o sesiune
`OPEN` fără nicio cale de a fi dusă la capăt. `runPhases` re-validează, chiar înainte de a porni
jobul, că `RUNID`-ul cerut e chiar singura sesiune `OPEN` a companiei (`errorCode` 50047) și că jobul
nu e deja activ (`errorCode` 50048, apărare împotriva unei lansări duble/curse).

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

**Mecanism separat de politică.** `sp_MinMaxEngine_PurgeRun @RunId` execută, iar
`RETENTIE_DET_SESIUNI` (implicit `2`) impune în procedură podeaua de retenție: cele mai recente N
sesiuni `FULL/DONE` nu pot fi purjate. Apelantul alege doar dintre sesiunile mai vechi eligibile.

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

| Cod | Procedură / strat | Condiție |
|---|---|---|
| `50039` | `StartRun` | există deja o sesiune `OPEN` pe companie |
| `50040` | `AbandonRun` | `RUNID` inexistent sau sesiunea nu e `OPEN` |
| `50041` | `PurgeRun` | `RUNID` inexistent |
| `50042` | `PurgeRun` | refuz pe `ESTE_CURENT = 1` |
| `50043` | `PurgeRun` | refuz pe `SESSION_STATUS = 'OPEN'` |
| `50044` | `PurgeRun` | refuz pentru una dintre ultimele `RETENTIE_DET_SESIUNI` sesiuni FULL/DONE |
| `50045` | AJS `startRun` | jobul Agent al companiei lipsește; nu se deschide sesiunea |
| `50046` | AJS `startRun` | serviciul SQL Server Agent nu rulează |
| `50047` | `RunPhases` (SQL) + AJS `runPhases` | zero sau mai multe sesiuni `OPEN` pentru companie |
| `50048` | AJS `runPhases`/`abandonRun` | jobul este activ; nu se dublează lansarea și nu se abandonează execuția |
| `50049` | AJS `runPhases` | `sp_start_job` a eșuat; sesiunea rămâne `OPEN` și poate fi abandonată |
| `50050` | AJS `startRun` | starea/configurația/permisiunile runnerului nu au putut fi verificate |
| `50051` | `EnsureAgentJob` | setup refuzat deoarece jobul rulează |
| `50052` | `StartRun` | modul de atribuire nu este `DOC`, `AGENT` sau `CLIENT` |

Codurile 50045-50050 nu sunt neapărat `THROW`-uri T-SQL: cele din stratul AJS (`startRun`,
`runPhases`) sunt returnate direct ca `errorCode` numeric în JSON, fără să treacă prin recuperarea de
număr din textul unui `THROW` (vezi `sqlErrorCode()` în `NewMinMax.js`). Doar `50047` din
`sp_MinMaxEngine_RunPhases` e un `THROW` T-SQL real, ca apărare suplimentară în interiorul jobului
Agent, pentru fereastra de cursă dintre verificarea AJS și pornirea efectivă a jobului.

## 10. Formă și localizare

Aceeași structură ca fazele 1–4:

- `sp_MinMaxEngine_AbandonRun` în `new_min_max/sql/00g_lifecycle.sql` și
  `sp_MinMaxEngine_PurgeRun` în `new_min_max/sql/00h_purge_run.sql`;
- `sp_MinMaxEngine_RunPhases` în `new_min_max/sql/00i_run_phases.sql` și
  `sp_MinMaxEngine_EnsureAgentJob` în `new_min_max/sql/00j_ensure_agent_job.sql`;
  fiecare `CREATE OR ALTER PROCEDURE` trebuie trimis printr-un apel `X.RUNSQL` separat, fiind primul
  statement din batch;
- modificările la `StartRun` în `00e_start_run.sql`, la `ClassifyGroup` în `02_classify_group.sql`;
- fiecare oglindită într-un `get*Sql()` din `NewMinMax.js`, înregistrată în `setup()`;
- **pereche nouă în [tools/sync-check.cjs](tools/sync-check.cjs)** pentru fiecare fișier SQL nou.

`sync-check.cjs` raportează deja `UNREGISTERED` pentru un `get*Sql()` fără pereche, deci un bloc
uitat nu poate diverge tăcut. **De rulat după fiecare editare de SQL**, fără excepție.

## 11. Endpoint-uri AJS și metode de serviciu

| Endpoint AJS | Metodă serviciu | Rol |
|---|---|---|
| `startRun` | *(internă)* | verifică pregătirea jobului Agent (§4.1), deschide sesiunea, întoarce `RUNID` |
| `runPhases` | *(internă)* | validează singura sesiune `OPEN`, pornește jobul Agent al companiei, întoarce rapid |
| — | `runEngine` | orchestrează 1+2, **așteaptă ambele**, întoarce `{runId}` |
| `abandonRun` | `abandonRun` | marchează `ABANDONED` |
| `purgeRun` | `purgeRun` | purjează `DET`/`WEEK`/`WINSOR` |

Execuția grea (`Classify → ClassifyGroup → Compute → FinishRun`) nu mai are un endpoint AJS propriu —
rulează în jobul SQL Server Agent, ca `dbo.sp_MinMaxEngine_RunPhases @Company` (§4).

## 12. Plan de validare

> Testul Agent izolat de 90s a reușit, iar prima versiune a runnerului a fost instalată live prin
> `setup()` (proceduri + job corect, fără sesiune nouă). Hardening-ul rezultat din review trebuie
> redeployat și `setup()` rerulat înainte de prima execuție reală. `RUNID=5` rămâne curent.

1. Suită unit verde pe serviciu (mock pe transportul AJS, ca la `execSql` cu `nock`).
2. `startRun` de două ori consecutiv → al doilea primește `50039`, tradus în mesaj, nu în eroare.
3. `abandonRun` pe sesiunea rămasă `OPEN` → `startRun` funcționează din nou.
4. `setup()` creează/aliniază jobul `MEC_MinMaxEngine_RunPhases_<company>` (`EnsureAgentJob`);
   verificare că e `enabled`, fără schedule, cu pasul `TSQL` corect în baza curentă.
5. `startRun` refuză să deschidă o sesiune când jobul lipsește sau Agent-ul e oprit (`50045`/`50046`),
   fără să lase niciun `RUNID` în urmă.
6. **Prima rulare reală se lansează din interfață** — testul butonului și confirmarea fixului în
   același gest; de urmărit că jobul Agent apare în istoric ca activ, apoi sesiunea trece `DONE`.
7. `node new_min_max/tools/validate-minmax-invariants.cjs <RUNID nou>` → **9/9**, inclusiv `det_grp`.
8. `purgeRun` pe `ESTE_CURENT=1` → `50042`; pe o sesiune veche → `DET` dispare, antetul rămâne.
9. Recitire după purjare: `history()` arată în continuare toate sesiunile, cu parametrii lor.

## 13. Todo list, cu model recomandat

- [x] 1. `AbandonRun` + `PurgeRun` în `00g_lifecycle.sql` *(model: Sonnet)*
- [x] 2. Garda `50039` în `StartRun` *(model de bază)*
- [x] 3. Fixul `ClassifyGroup` — reordonare + filtru *(model: Sonnet; verificarea read-only a confirmat 43/43 grupe cu populație inclusă)*
- [x] 4. `getLifecycleSql()` + perechi în `sync-check.cjs` *(model de bază)*
- [x] 5. Endpoint-uri AJS `startRun`/`runPhases`/`abandonRun`/`purgeRun` *(model: Sonnet)*
- [x] 6. Transport AJS în serviciul Feathers, separat de `execSql` *(model: Sonnet)*
- [x] 7. `runEngine`/`abandonRun`/`purgeRun` ca metode, cu `_writesEnabled()` + `minmax.edit` *(model: Sonnet)*
- [x] 8. Audit app-side, acoperind și `saveParams` *(model: Sonnet)*
- [x] 9. UI: buton de lansare, poll pe `history()`, traducerea lui `50039` *(model: Sonnet)*
- [x] 10. Seed `RETENTIE_DET_SESIUNI` în `00_params.sql` *(model de bază)*
- [x] 11. Curățarea `RUNID 1–4` — executată după Nivel B; `RUN/DET/WEEK/WINSOR/GRP=0`, `RUNID=5` păstrat curent *(model de bază)*
- [x] 12. `sp_MinMaxEngine_RunPhases` + `sp_MinMaxEngine_EnsureAgentJob`, arhitectura SQL Server Agent, cod editat și verificat static, FĂRĂ deploy/rulare live *(model: Sonnet)*
- [ ] 13. Validare live conform §12 — deploy `setup()`, verificare job Agent, prima rulare din interfață *(model: Opus, agentul `Review`, context mic)*

## 14. Constrângeri de respectat

1. **Nivel B înainte de orice** (§1). Nu porni o sesiune nouă până eșantionul nu e înghețat, și nu curăța
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
