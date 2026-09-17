# P17 — Aplicarea politicii de retenție: ghid operațional

Data: 17.09.2026. Stare: **implementat și testat local, nedeployat, neînchis live** (vezi
`RESTANTE_INTERNE.md`, secțiunea Deschise, rândul P17). Acest document este ghidul manual pentru
persoana care face deploy-ul și proba live — nu descrie mecanismul (asta e în
[FAZA6_CONTRACT.md](FAZA6_CONTRACT.md) §6 și în codul SQL însuși), ci **pașii, în ordine, cu ce
verifici la fiecare pas**.

## 0. Ce s-a schimbat față de starea dinainte de P17

- `ESTE_REPER` (pin) generalizat pe `CCCMINMAXRUN`: un `RUNID` marcat `ESTE_REPER=1` nu poate fi
  purjat de `sp_MinMaxEngine_PurgeRun`, indiferent de poziția lui în fereastra
  `RETENTIE_DET_SESIUNI` (gardă nouă, `THROW 50053`).
- `sp_MinMaxEngine_PurgeSelector` (00k): clasificare read-only, autoritativă, per `RUNID`:
  `CURRENT` / `OPEN` / `PINNED` / `PROTECTED` / `PURGED` / `ELIGIBLE`. Nu șterge nimic; e sursa
  pentru selectorul din UI **și** pentru executor.
- Sesiunile terminale `DONE` și `ABANDONED` sunt eligibile dacă mai au date și nu intră într-o
  gardă. Fereastra `RETENTIE_DET_SESIUNI` protejează deliberat numai ultimele rulări `FULL/DONE`,
  conform contractului existent `50044`; un scope `SKU`/`GROUP` finalizat nu consumă un loc în
  această fereastră și poate fi purjat.
- `sp_MinMaxEngine_PurgeRetention` (00l): executor oldest-first, maximum `@MaxRuns` (implicit 2,
  plafonat la 2), care citește selectorul și apelează **numai** `sp_MinMaxEngine_PurgeRun` — nu are
  niciun `DELETE` propriu pe `CCCMINMAXRUN`/`GRP`/`RUNPARAM`, nicio tranzacție globală peste buclă.
  `sp_MinMaxEngine_PurgeRun` rămâne autoritatea finală (50042/50043/50044/50053).
- Auto-purjare: `sp_MinMaxEngine_RunPhases` cheamă `PurgeRetention @MaxRuns = 1` imediat după un
  `FinishRun` reușit, izolat într-un `TRY/CATCH` propriu — o eroare de purjare **nu** aruncă
  (`THROW`), **nu** atinge `ERRORMSG`/`GROUP_ERRORMSG`/`COMPUTE_ERRORMSG`, doar un `RAISERROR`
  severitate 10 în job history.
- `sp_MinMaxEngine_EnsureBackfillJob` (00m): creează/aliniază idempotent jobul Agent
  `MEC_MinMaxEngine_PurgeRetentionBackfill_<company>` — un singur pas `TSQL`, comanda fixă
  `EXEC dbo.sp_MinMaxEngine_PurgeRetention @Company = <company>, @MaxRuns = 2;`, **fără schedule**,
  `enabled=1`. Setup îl creează/aliniază, **nu** îl pornește niciodată.
- UI (`minmax-run-panel.js`): selectorul se afișează discret în tabelul de istoric — badge `REPER`
  pentru `PINNED`, text muted „date eliberate" pentru `PURGED`, tăcere pentru `PROTECTED`/`ELIGIBLE`
  (nu există buton de purjare/backfill în UI — decizie explicită). Store: `purgeRun`/
  `loadPurgeSelector` există ca metode, folosite de refresh-ul manual și după finalizarea unei
  rulări; fără declanșator automat de backfill.

## 1. Măsurare before/after — `sys.allocation_units`, NU `sp_spaceused`

`sp_spaceused` pe tabele mari cu multe partiții/indici poate fi lent și, în unele medii, blocant.
Măsurarea de referință (folosită și la estimarea „10,8 GB" din `RESTANTE_INTERNE.md`) e directă pe
cataloage:

```sql
SELECT
    OBJECT_NAME(p.object_id) AS TableName,
    SUM(a.total_pages) * 8 / 1024.0 AS TotalMB,
    SUM(a.used_pages) * 8 / 1024.0 AS UsedMB
FROM sys.partitions p
INNER JOIN sys.allocation_units a ON a.container_id = p.hobt_id
WHERE OBJECT_NAME(p.object_id) IN ('CCCMINMAXDET', 'CCCMINMAXWEEK', 'CCCMINMAXWINSOR',
                                    'CCCMINMAXRUN', 'CCCMINMAXGRP', 'CCCMINMAXRUNPARAM')
GROUP BY p.object_id
ORDER BY TotalMB DESC;
```

Rulează această interogare **înainte** de orice pin/backfill (baseline) și **după** fiecare pas
manual de mai jos. Compară doar `CCCMINMAXDET`/`WEEK`/`WINSOR` — acelea trebuie să scadă;
`CCCMINMAXRUN`/`GRP`/`RUNPARAM` nu trebuie să se miște deloc (vezi §5).

## 2. Deploy manual (AJS `setup`)

Nu se rulează prin MCP deploy. Pașii sunt manuali, în ordinea din `setup()`:

1. Deploy `NewMinMax.js` (submodul `external/MEC`) pe server.
2. Apel manual `/JS/NewMinMax/setup` (sau echivalentul din workflow-ul existent de deploy AJS).
   `setup()` rulează în ordine: tabele/coloane (inclusiv `ESTE_REPER`), `PurgeRun`, `PurgeSelector`,
   `PurgeRetention`, fazele motorului, `RunPhases`, `EnsureAgentJob` (+ `EXEC`), apoi
   `EnsureBackfillJob` (+ `EXEC`) — jobul de backfill este creat/aliniat, **nu** pornit.
3. Verifică imediat după setup:
   - `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CCCMINMAXRUN' AND
     COLUMN_NAME='ESTE_REPER';` → un rând, `NOT NULL DEFAULT 0`.
   - `SELECT name, enabled FROM msdb.dbo.sysjobs WHERE name LIKE
     'MEC_MinMaxEngine_PurgeRetentionBackfill_%';` → jobul există, `enabled=1`.
   - `SELECT COUNT(*) FROM msdb.dbo.sysjobschedules sc INNER JOIN msdb.dbo.sysjobs j ON j.job_id =
     sc.job_id WHERE j.name LIKE 'MEC_MinMaxEngine_PurgeRetentionBackfill_%';` → `0` (fără schedule).

## 3. Pin explicit 26/27/28 — înainte de backfill

Deciziile aprobate fixează manual aceste trei `RUNID` ca repere, **înainte** de a porni orice
purjare manuală sau backfill:

```sql
UPDATE CCCMINMAXRUN SET ESTE_REPER = 1 WHERE COMPANY = <company> AND RUNID IN (26, 27, 28);
```

Verificare imediată:

```sql
SELECT RUNID, ESTE_REPER, ESTE_CURENT, SESSION_STATUS FROM CCCMINMAXRUN
WHERE COMPANY = <company> AND RUNID IN (26, 27, 28) ORDER BY RUNID;
```

`RUNID=28` este de așteptat să fie `ESTE_CURENT=1` la data acestui document — pinul pe el este
inofensiv (curent oricum nu se purjează, §4 arată de ce), dar **nu strica nimic să rămână pinuit**
și după ce nu mai e curent.

## 4. Teste negative de validat manual (înainte de backfill)

Rulează fiecare `EXEC` separat și confirmă codul de eroare așteptat, **fără** commit pe rezultat:

| Scenariu | Comandă | Așteptat |
|---|---|---|
| `RUNID` curent (28, la data acestui document) | `EXEC dbo.sp_MinMaxEngine_PurgeRun @Company=<c>, @RunId=28;` | `THROW 50042` |
| `RUNID` protejat de fereastră **și** pinuit (27) | `EXEC dbo.sp_MinMaxEngine_PurgeRun @Company=<c>, @RunId=27;` | `THROW 50044` sau `50053` (oricare lovește primul — ambele sunt refuzuri valide; ordinea din cod e 50042→50043→50053→50044, deci pe 27 protejat+pinuit iese `50053` primul) |
| `RUNID` pinuit, în afara ferestrei (26) | `EXEC dbo.sp_MinMaxEngine_PurgeRun @Company=<c>, @RunId=26;` | `THROW 50053` |
| Gardă `50044` izolată (fereastră, fără pin) | Poate necesita temporar un `RUNID` protejat de fereastră dar **nepinuit** — dacă toate sesiunile recente sunt deja pinuite, testează `50044` **înainte** de pasul §3 (pin), pe un `RUNID` din fereastra `RETENTIE_DET_SESIUNI` care nu e încă 26/27/28, sau pe un `RUNID` de test dedicat | `THROW 50044` |
| Selector, sanity check | `EXEC dbo.sp_MinMaxEngine_PurgeSelector @Company=<c>;` | 26/27 = `PINNED`; 28 = `CURRENT` cât timp este sesiunea curentă, apoi `PINNED` (`CASE` evaluează `CURRENT` înaintea lui `PINNED`) |

Niciun test din tabel nu trebuie să lase date modificate — toate sunt refuzuri (`THROW`), deci
tranzacția nu ajunge la `DELETE`.

Înainte de prima pornire, inventariază explicit reziduul terminal din toate scope-urile:

```sql
SELECT r.SCOPE, r.SESSION_STATUS, COUNT(DISTINCT r.RUNID) AS RUNS_WITH_DATA
FROM CCCMINMAXRUN r
WHERE r.COMPANY = <company>
  AND r.SESSION_STATUS IN ('DONE', 'ABANDONED')
  AND (EXISTS (SELECT 1 FROM CCCMINMAXDET d WHERE d.RUNID = r.RUNID)
    OR EXISTS (SELECT 1 FROM CCCMINMAXWEEK w WHERE w.RUNID = r.RUNID)
    OR EXISTS (SELECT 1 FROM CCCMINMAXWINSOR x WHERE x.RUNID = r.RUNID))
GROUP BY r.SCOPE, r.SESSION_STATUS;
```

Selectorul trebuie să marcheze `ELIGIBLE` atât sesiunile `DONE`, cât și `ABANDONED` neprotejate.
Pentru scope-uri diferite de `FULL`, purjarea imediat ce ajung terminale este intenționată: politica
de retenție rezervă locuri numai rulărilor complete `FULL/DONE`.

## 5. Pornirea manuală a jobului de backfill, în trepte

Backfill-ul rulează `PurgeRetention @MaxRuns=2` — **nu** se pornește automat, nu are schedule.
Pornire explicită, o singură dată la un moment ales, urmărită pas cu pas:

1. Baseline `sys.allocation_units` (§1).
2. `EXEC msdb.dbo.sp_start_job @job_name =
   N'MEC_MinMaxEngine_PurgeRetentionBackfill_<company>';`
3. Urmărește finalizarea: `SELECT run_status, run_duration, message FROM
   msdb.dbo.sysjobhistory WHERE job_id = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name =
   N'MEC_MinMaxEngine_PurgeRetentionBackfill_<company>') ORDER BY instance_id DESC;` (`run_status=1`
   = succes).
4. `sys.allocation_units` din nou (§1) — compară cu baseline.
5. Dacă mai sunt `RUNID` eligibile (verifică `sp_MinMaxEngine_PurgeSelector`, caută `ELIGIBLE`),
   repetă manual pasul 2 — jobul rulează cel mult 2 pe apel, deliberat, ca să nu se purjeze tot
   dintr-o mișcare fără verificare intermediară.

## 6. Verificare log

Purjarea e pe loturi (`@BatchSize`, implicit 10.000), dar 706k+ rânduri pe `RUNID` tot pot umfla
log-ul dacă modelul de recuperare e `FULL` fără backup-uri de log frecvente.

```sql
SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases WHERE name = DB_NAME();
```

`log_reuse_wait_desc` diferit de `NOTHING` după purjare merită investigat înainte de a rula
backfill-ul a doua oară. Dacă există permisiune (`VIEW SERVER STATE`):

```sql
SELECT database_id, total_log_size_in_bytes / 1024.0 / 1024.0 AS TotalLogMB,
       used_log_space_in_percent
FROM sys.dm_db_log_space_usage;
```

## 7. Verificare RUN/GRP/RUNPARAM neatinse

După fiecare rulare de backfill:

```sql
SELECT COUNT(*) FROM CCCMINMAXRUN WHERE COMPANY = <company>;
SELECT COUNT(*) FROM CCCMINMAXGRP WHERE RUNID IN (<lista RUNID purjate>);
SELECT COUNT(*) FROM CCCMINMAXRUNPARAM WHERE RUNID IN (<lista RUNID purjate>);
```

Numărul de rânduri `CCCMINMAXRUN` nu trebuie să scadă (nimeni nu șterge antete). `CCCMINMAXGRP` și
`CCCMINMAXRUNPARAM` pentru `RUNID`-urile purjate trebuie să rămână **identice** cu ce erau înainte —
`PurgeRun` șterge doar `DET`/`WEEK`/`WINSOR`.

## 8. Acceptanță finală

- `CCCMINMAXDET`/`WEEK`/`WINSOR` conțin date **doar** pentru: sesiunea curentă, sesiunile din
  fereastra `RETENTIE_DET_SESIUNI` (implicit ultimele 2 `FULL/DONE`), și orice `RUNID` pinuit
  (`ESTE_REPER=1`, azi 26/27/28). Orice alt `RUNID` terminal (`DONE` sau `ABANDONED`), indiferent
  de scope, are `DET`/`WEEK`/`WINSOR` goale.
- `sp_MinMaxEngine_PurgeSelector` confirmă asta direct: zero rânduri `ELIGIBLE` cu `HAS_DET=1` după
  ce backfill-ul a rulat suficiente treceri.
- `CCCMINMAXRUN`/`GRP`/`RUNPARAM` neschimbate ca număr de rânduri (§7).
- Job-ul de backfill rămâne `enabled`, fără schedule, neconsumat de UI — nu se activează niciun
  buton nou.

**Nu marca P17 ca închis în `RESTANTE_INTERNE.md` fără un `RUNID`/o probă live** care să demonstreze
acceptanța de mai sus, la fel ca toate celelalte rânduri închise din acel registru.
