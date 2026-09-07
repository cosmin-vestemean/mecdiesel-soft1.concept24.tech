# Faza 4 — contract `applyToErp`

> **Status: confirmat, amânat.** Contractul este închis și acceptat (03.09.2026), dar
> implementarea este împinsă **după Faza 5 (UI)**. Motivul este de ordine, nu de conținut:
> beneficiarul are nevoie întâi de o interfață prin care să confirme ce calculăm deja.
> Scrierea în ERP este pasul ireversibil; nu are sens înaintea validării vizuale a rezultatelor.
>
> Documentul se reia ca atare la momentul implementării. Nimic din el nu depinde de Faza 5,
> cu excepția modalului de confirmare, care consumă `@DryRun = 1`.

Referințe: [PLAN_IMPLEMENTARE.md](PLAN_IMPLEMENTARE.md) §4 (persistență) și §5 (`applyToErp`),
[FAZA3_HANDOFF.md](FAZA3_HANDOFF.md) pentru convențiile fazei anterioare.

---

## 1. Formă și localizare

Aceeași structură ca fazele 1–3:

- logica în `new_min_max/sql/04_apply.sql`, ca `sp_MinMaxEngine_Apply`;
- oglindită în `getApplyProcedureSql()` din [../S1-MEC/AJS/NewMinMax.js](../S1-MEC/AJS/NewMinMax.js);
- înregistrată în `setup()`;
- pereche nouă în [tools/sync-check.cjs](tools/sync-check.cjs).

Endpoint-ul AJS `applyToErp` este un wrapper subțire: parsează `obj.JSONDATA`, execută procedura,
returnează `JSON.stringify({success, ...})`.

## 2. Semnătură

```sql
sp_MinMaxEngine_Apply
    @RunId      INT,
    @Company    SMALLINT = 1000,
    @Branches   VARCHAR(MAX) = NULL,   -- CSV, NULL = toate filialele rularii
    @MtrlList   VARCHAR(MAX) = NULL,   -- CSV, NULL = toate articolele
    @DryRun     BIT = 1,               -- implicit preview; scrierea este opt-in
    @ApplyId    INT = NULL OUTPUT
```

`@DryRun = 1` este implicit deliberat: modalul de confirmare din Faza 5 are nevoie de delta
înainte de scriere, iar o scriere accidentală în ERP este scumpă.

Listele CSV se despart cu `STRING_SPLIT` **pe parametru**, nu prin concatenare de string ca în
`ZeroMinMax.js` — altfel filtrul devine vector de injecție prin stratul AJS.

## 3. Precondiții

Serie `THROW` 50020+, continuând 50010–50014 folosite de `Compute`.

| Cod | Condiție |
|---|---|
| 50020 | `@RunId` inexistent sau pe altă companie |
| 50021 | `COMPUTE_STATUS <> 'DONE'` — o rulare fără Compute nu are `ENG_MIN`/`ENG_MAX` |
| 50022 | rularea nu are rânduri în scope după filtre |
| 50023 | există deja un apply cu `STATUS = 'RUNNING'` pe același `RUNID` |
| 50024 | plafonul `APPLY_MAX_INSERT_POZITII` depășit de inserțiile E20 |

## 4. Mapare valori → ERP

| Rând | Țintă | Coloane scrise |
|---|---|---|
| `ESTE_HQ = 1` | `MTRL` | `CCCMINAUTOCOMP`, `CCCMAXAUTOCOMP`, `CCCDATACALCMINMAX` |
| `ESTE_HQ = 0` | `MTRBRNLIMITS` | `CCCMINAUTO`, `CCCMAXAUTO`, `CCCDATACALCMINMAX` |

Invarianți duri:

- **`REMAINLIMMIN` / `REMAINLIMMAX` nu se ating niciodată.** Sunt valorile umane care alimentează
  `ERP_MIN`/`ERP_MAX` și deci întreg indicatorul `FLAG` (F10); scrierea lor ar distruge baza de
  comparație a motorului.
- **HQ nu primește rând în `MTRBRNLIMITS`.** Branch 1000 este strat de companie, nu locație;
  se scrie exclusiv în `MTRL`.

## 5. E15 — zero-uirea la scriere

Rândurile cu `FLAG_LICHIDARE = 1 OR FLAG_BLOCAT = 1 OR FLAG_EXCLUS = 1` se scriu cu
`MIN = MAX = 0`, în timp ce `CCCMINMAXDET` rămâne neatins — raportul rămâne complet, dar
reaprovizionarea automată nu se declanșează.

Valoarea efectivă a parametrului `FLAGS_ZERO_LA_APPLY` se citește din
`CCCMINMAXRUN.COMPUTE_PARAMSJSON` **al rulării**, nu live din `CCCMINMAXPARAMS`. Este aceeași
regulă ca la `Explain`: un apply trebuie să corespundă rulării pe care pretinde că o aplică, nu
stării de azi a parametrilor.

Auditul stochează **valoarea scrisă**, nu cea calculată, plus un flag `ZEROIZAT` și valorile
`ENG_MIN`/`ENG_MAX` originale, ca diferența să fie vizibilă.

## 6. E20 — crearea poziției lipsă

Pentru rândurile cu `ARE_POZITIE_ERP = 0`:

- **`WHOUSE`** din `WHOUSE.CCCBRANCH = BRANCH AND ISACTIVE = 1`. Filiala și depozitul sunt tandem
  cu același număr (`code`), legate prin `WHOUSE.CCCBRANCH` — maparea este 1:1 și deterministă
  (confirmat 03.09.2026).
- **`LINENUM`** = `ISNULL(MAX(LINENUM), 0) + N` per `(COMPANY, MTRL)`, calculat set-based cu
  `ROW_NUMBER()`. Contorul incremental din [../S1-MEC/AJS/MTRBRNLIMITS.js](../S1-MEC/AJS/MTRBRNLIMITS.js)
  pornește de la 1 la fiecare import și se poate ciocni cu rânduri existente — nu se copiază.
- `REMAINLIMMIN = REMAINLIMMAX = 0` la inserare (nu există valoare manuală).
- **Se inserează doar dacă valoarea scrisă este `> 0`.**

Ultima regulă este load-bearing, nu igienă. Fără ea, o rulare completă ar crea poziție pentru
fiecare SKU în fiecare filială — peste 600.000 de rânduri noi într-un tabel care are azi 26.449,
adică o mutație de 25× a unui tabel ERP ca efect secundar al unui buton. Plafonul
`APPLY_MAX_INSERT_POZITII` este a doua plasă de siguranță.

## 7. Audit

Două tabele, în `sql/00b_persist.sql`, cu aceeași secțiune de aliniere ghidată de
`INFORMATION_SCHEMA` ca restul persistenței.

### `CCCMINMAXAPPLYRUN` — antet

`APPLYID` (IDENTITY, PK), `RUNID`, `COMPANY`, `STATUS` (`RUNNING`/`DONE`/`ERROR`/`REVERSED`),
`DRYRUN`, scope-ul aplicat (`SCOPE_BRANCHES`, `SCOPE_MTRL`), `FLAGS_ZERO_APLICAT`, contoarele
(`NR_UPDATE_BR`, `NR_INSERT_BR`, `NR_UPDATE_HQ`, `NR_SKIP`), `STARTEDAT`, `FINISHEDAT`,
`DURATA_SEC`, `CREATEDBY`, `ERRORMSG`, `REVERSEDAT`.

### `CCCMINMAXAPPLY` — detaliu

Un rând per poziție scrisă: `APPLYID`, `RUNID`, `COMPANY`, `BRANCH`, `MTRL`, `ESTE_HQ`,
`TINTA` (`MTRBRNLIMITS` | `MTRL`), `ACTIUNE` (`UPDATE` | `INSERT`),
`OLD_MIN_AUTO`, `OLD_MAX_AUTO`, `OLD_DATACALC`, `NEW_MIN_AUTO`, `NEW_MAX_AUTO`,
`ENG_MIN`, `ENG_MAX`, `ZEROIZAT`, `WHOUSE`, `LINENUM`, `APPLIEDAT`, `APPLIEDBY`.
PK clustered `(APPLYID, BRANCH, MTRL)`.

> Planul §4 listează un singur `CCCMINMAXAPPLY`. Antetul separat a fost acceptat pentru că un
> apply parțial eșuat nu are altfel unde să-și țină statusul, iar „revert apply X" nu are ancoră
> de scope și autor. Dacă se preferă forma din plan, se poate colapsa într-un `BATCHID`, ca la
> `CCCZEROMINMAX`.

## 8. Tranzacționalitate

Planul spune „totul în tranzacție" — formulare scrisă înainte de a ști volumul. `RUNID = 4` are
713.818 rânduri; o singură tranzacție înseamnă escaladare de lock pe `MTRBRNLIMITS` și `MTRL`
pentru toată durata, cu ERP-ul blocat.

**Decizie: o tranzacție per filială**, cu antetul care urmărește progresul. Apply-ul rămâne
integral reversibil prin audit, iar o cădere la mijloc lasă filialele deja scrise consistente în
loc să blocheze tot ERP-ul. Atomicitatea pierdută este recuperabilă prin `revert`; indisponibilitatea
ERP-ului nu este.

Antetul se marchează `ERROR` în `CATCH` sub garda `XACT_STATE() <> -1`, ca la `Compute`.

## 9. Revert

`sp_MinMaxEngine_ApplyRevert @ApplyId`:

- restaurează `OLD_MIN_AUTO` / `OLD_MAX_AUTO` / `OLD_DATACALC` pe rândurile `UPDATE`;
- șterge rândurile `INSERT` care încă poartă exact valorile scrise de noi;
- marchează antetul `REVERSED`.

Este ieftin odată ce auditul există și este ultimul pas — se poate amâna fără să blocheze restul.

## 10. Parametri noi

| Parametru | Default | Rol |
|---|---|---|
| `APPLY_MAX_INSERT_POZITII` | 5000 | plafon dur pe inserțiile E20 per apply; peste el, `THROW 50024` |

Se adaugă în seed-ul din `sql/00_params.sql`, non-distructiv ca restul.

## 11. Endpoint-uri AJS

| Endpoint | Rol |
|---|---|
| `applyToErp` | wrapper peste `sp_MinMaxEngine_Apply`; `dryRun` din payload |
| `revertApply` | wrapper peste `sp_MinMaxEngine_ApplyRevert` |
| `getApplyHistory` | istoricul din `CCCMINMAXAPPLYRUN` |

Preview-ul nu primește endpoint separat — este `applyToErp` cu `dryRun: 1`.

## 12. Plan de validare

1. **Verificarea tipurilor coloanelor țintă pe producție**, via `INFORMATION_SCHEMA`, înainte de
   orice scriere — aceeași disciplină ca la Faza 3. Atenție la `MTRL.CCCDATACALCMINMAX`, comparat
   în `ZeroMinMax.js` cu `> 0`, în timp ce omologul din `MTRBRNLIMITS` e comparat cu `IS NOT NULL`;
   cele două s-ar putea să nu aibă același tip.
2. **Măsurarea volumului E20** pe `RUNID = 4`: câte poziții s-ar crea efectiv cu regula „valoare > 0".
   Rezultatul se prezintă clientului înainte de primul apply real.
3. **Dry-run** pe rularea completă → contoare și delta.
4. **Apply real pe `@Mtrl = 1360919`**: 13 rânduri de filială + 1 rând `MTRL`, audit complet,
   `revert`, re-verificare că ERP-ul a revenit exact la starea inițială.
5. **Apply pe o singură filială mică**, apoi pe tot, doar după confirmarea clientului la punctul 2.

Scrierile efective le execută utilizatorul: `ALLOW_WRITE = 0` în `CCC_WSMCP_AUTH` blochează
commit-urile server-side din agent.

## 13. Todo list, cu model recomandat

- [ ] 1. Măsurare read-only pe `RUNID = 4`: tipurile coloanelor țintă + volumul E20 *(Claude Sonnet 4.6)*
- [ ] 2. DDL audit în `sql/00b_persist.sql` + secțiunea de aliniere *(Claude Sonnet 4.6)*
- [ ] 3. Seed `APPLY_MAX_INSERT_POZITII` în `sql/00_params.sql` *(model de bază)*
- [ ] 4. `sql/04_apply.sql` — `sp_MinMaxEngine_Apply` *(Claude Sonnet 4.6)*
- [ ] 5. `sp_MinMaxEngine_ApplyRevert` *(Claude Sonnet 4.6)*
- [ ] 6. Oglindire AJS: `getApplyProcedureSql()`, `setup()`, cele trei endpoint-uri *(Claude Sonnet 4.6)*
- [ ] 7. Pereche nouă în `tools/sync-check.cjs` + rulare până la `IN SYNC` pe toate blocurile *(model de bază)*
- [ ] 8. Actualizare `PLAN_IMPLEMENTARE.md` §4–§5 cu contractul final *(model de bază)*
- [ ] 9. Review pe diff, sesiune nouă context mic *(Opus)*
- [ ] 10. Deploy + validare live conform §12 *(rulat de utilizator)*

## 14. Constrângeri de respectat

- `REMAINLIMMIN` / `REMAINLIMMAX` sunt read-only pentru motor.
- Parametrii efectivi ai unui apply vin din `COMPUTE_PARAMSJSON` al rulării, nu din starea live.
- HQ scrie în `MTRL`, niciodată în `MTRBRNLIMITS`.
- Orice editare SQL se termină cu `node new_min_max/tools/sync-check.cjs` verde.
- Tabelele noi se creează din `setup()` cu `IF NOT EXISTS`; schimbările de coloane doar prin
  secțiunea de aliniere ghidată de `INFORMATION_SCHEMA`.
- Filtrele CSV se parsează cu `STRING_SPLIT`, fără concatenare în SQL.
- Tipurile coloanelor țintă se verifică pe producție înainte de a scrie în ele.
- `S1-MEC/AJS/NewMinMax.js` este hardlink către submodul: modificarea cere commit în submodul plus
  commit de pointer în repo-ul principal.
