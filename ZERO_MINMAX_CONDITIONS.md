# Condiții pentru resetarea CCCMINAUTO / CCCMAXAUTO la 0

## A. Condiții la nivel de UI (pre-validare)

| # | Condiție | Sursa |
|---|---------|-------|
| 1 | `materialCodeFilter` trebuie să fie non-gol (default: `"FS"`) | `public/components/zero-minmax/zero-minmax-panel.js` L81 |
| 2 | `selectedBranches.length > 0` (HQ 1000 este exclus automat) | `public/components/zero-minmax/zero-minmax-panel.js` L556 |
| 3 | `previewCount > 0` (trebuie rulat un preview înainte) | `public/components/zero-minmax/zero-minmax-panel.js` L561 |
| 4 | Utilizatorul trebuie să confirme prin `confirm()` dialog | `public/components/zero-minmax/zero-minmax-panel.js` L590 |
| 5 | `debugMode` trebuie să fie **false** (altfel doar se afișează query-ul) | `public/components/zero-minmax/zero-minmax-panel.js` L595 |

---

## B. Condiții SQL (WHERE clause) — procesare normală (≤500 articole)

Toate trebuie îndeplinite simultan:

| # | Condiție SQL | Scop |
|---|-------------|------|
| 1 | `l.COMPANY = {X.SYS.COMPANY}` | Compania curentă |
| 2 | `l.BRANCH IN ({branches})` | Branch-urile selectate de utilizator |
| 3 | `l.CCCMINAUTO <> 0 OR l.CCCMAXAUTO <> 0` | Ignoră înregistrările deja la 0 |
| 4 | `m.ISACTIVE = 1` | Doar materiale active |
| 5 | `m.SODTYPE = 51` | Doar tip articol standard (51) |
| 6 | `m.CODE LIKE '{filter}%'` | Prefix cod material (ex: `"FS%"`) |

**JOIN:** `INNER JOIN MTRL m ON l.MTRL = m.MTRL AND l.COMPANY = m.COMPANY`

**Sursa:** `S1-MEC/AJS/ZeroMinMax.js` funcția `processZeroMinMax()` L390-L403

---

## C. Condiții SQL — procesare batch (>500 articole)

| # | Condiție SQL | Scop |
|---|-------------|------|
| 1 | `l.COMPANY = {X.SYS.COMPANY}` | Compania curentă |
| 2 | `l.BRANCH IN ({branchesCSV})` | Branch-urile selectate |
| 3 | `l.CCCMINAUTO <> 0 OR l.CCCMAXAUTO <> 0` | Ignoră înregistrările deja la 0 |
| 4 | `m.CODE LIKE '{filter}%'` | Prefix cod material |
| ⚠️ | **LIPSĂ:** `m.ISACTIVE = 1` | **Nu se verifică!** |
| ⚠️ | **LIPSĂ:** `m.SODTYPE = 51` | **Nu se verifică!** |

**Condiție suplimentară batch:** între chunk-uri se verifică dacă job-ul a fost anulat (`CCCZEROMINMAX_QUEUE.STATUS = 'cancelled'`).

**Sursa:** `S1-MEC/AJS/ZeroMinMax.js` funcția `processZeroMinMaxBatch()` L863-L876

---

## D. Arbore decizional complet

```
Utilizator apasă "Reset"
  ├─ materialCodeFilter gol? → EROARE, stop
  ├─ niciun branch selectat? → EROARE, stop
  ├─ previewCount = 0? → EROARE, stop
  ├─ debugMode = true? → AFIȘARE query fără execuție
  ├─ utilizatorul refuză confirm()? → stop
  │
  ├─ ≤ 500 articole → processZeroMinMax() [o singură tranzacție]
  │     COMPANY ✅  BRANCH IN ✅  MIN/MAX ≠ 0 ✅
  │     ISACTIVE=1 ✅  SODTYPE=51 ✅  CODE LIKE ✅
  │     → SET CCCMINAUTO=0, CCCMAXAUTO=0
  │
  └─ > 500 articole → processZeroMinMaxBatch() [chunk-uri de 500]
        COMPANY ✅  BRANCH IN ✅  MIN/MAX ≠ 0 ✅
        CODE LIKE ✅
        ISACTIVE ⚠️ LIPSĂ   SODTYPE ⚠️ LIPSĂ
        + verificare anulare între chunk-uri
        → SET CCCMINAUTO=0, CCCMAXAUTO=0
```

---

## E. Cazuri speciale de inserare cu valori 0

### Blacklist Import (`importBlacklistFromExcel()`)

Când se creează un rând nou în `MTRBRNLIMITS` la importul de blacklist (înregistrarea nu există), `CCCMINAUTO` și `CCCMAXAUTO` sunt inserate ca **0 by default**:

```sql
INSERT INTO MTRBRNLIMITS (..., CCCMINAUTO, CCCMAXAUTO, ...)
VALUES (..., 0, 0, ...)
```

**Condiții:**
- Codul materialului există în `MTRL`
- Nu există înregistrare existentă pentru combinația (company + mtrl + branch + whouse)

**Sursa:** `S1-MEC/AJS/MTRBRNLIMITS.js` funcția `importBlacklistFromExcel()` L478

---

## F. Bug identificat

⚠️ **Inconsistență între procesarea normală și batch:**

Procesarea batch (`processZeroMinMaxBatch`) **NU verifică** `m.ISACTIVE = 1` și `m.SODTYPE = 51`, spre deosebire de procesarea normală (`processZeroMinMax`).

**Impact:** La seturi mari (>500 articole) pot fi resetate și materiale inactive sau de alt tip decât 51.

**Recomandare:** Adăugarea condițiilor `AND m.ISACTIVE = 1 AND m.SODTYPE = 51` în query-ul din `processZeroMinMaxBatch()`.

---

## G. Notă privind Blacklist

`CCCISBLACKLISTED` **NU** este verificat ca și condiție în nicio cale de resetare. Articolele aflate pe blacklist vor fi și ele resetate dacă îndeplinesc celelalte condiții de filtrare.
