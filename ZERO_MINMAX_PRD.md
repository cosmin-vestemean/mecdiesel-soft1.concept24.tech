# PRD: Zero Min Max - Resetare CCCMINAUTO/CCCMAXAUTO

## Overview
Funcționalitate nouă în **Achiziții** > **Tab "Min Max"** pentru resetarea valorilor `CCCMINAUTO` și `CCCMAXAUTO` la `0` pentru articole selectate pe branch-uri selectate, cu tracking în istoric și notificări real-time.

---

## Problem Statement
1. **Necesitate business**: Utilizatorii au nevoie să reseteze valorile min/max calculate automat pentru anumite categorii de articole (ex: articole cu prefix "FS")
2. **Lipsa vizibilității**: Nu există un mecanism de preview înainte de acțiune
3. **Fără istoric**: Nu se păstrează un audit trail al modificărilor
4. **Concurrency**: Risc de conflicte când mai mulți utilizatori rulează simultan

---

## Solution Architecture

### Database
- **Tabel nou**: `CCCZEROMINMAX` în SoftOne cloud - istoric modificări
- **Tabel afectat**: `MTRBRNLIMITS` - resetare CCCMINAUTO/CCCMAXAUTO

### Backend
- **AJS**: `S1-MEC/AJS/ZeroMinMax.js` (ES5) - endpoint-uri pentru preview, procesare, istoric
- **Feathers**: Serviciu `zero-minmax` în `src/app.js` cu real-time channels

### Frontend
- **Component**: `<zero-minmax-panel>` (LitElement)
- **Locație**: `public/components/zero-minmax/zero-minmax-panel.js`

---

## Database Schema: CCCZEROMINMAX

| Column | Type | Description |
|--------|------|-------------|
| ID | INT IDENTITY | PK |
| BATCHID | NVARCHAR(50) | UUID sesiune (ex: `zero_1733150400000_abc123`) |
| MTRL | INT | ID articol din SoftOne |
| BRANCH | INT | Branch-ul afectat |
| CODE | NVARCHAR(50) | Codul articolului (pentru referință) |
| OLD_CCCMINAUTO | DECIMAL(18,4) | Valoarea veche CCCMINAUTO |
| OLD_CCCMAXAUTO | DECIMAL(18,4) | Valoarea veche CCCMAXAUTO |
| RESETAT_LA | DATETIME | Timestamp resetare |
| RESETAT_DE | INT | User ID care a inițiat |
| FILTRU_FOLOSIT | NVARCHAR(100) | Filtrul folosit (ex: "FS%") |

### Indexes
```sql
CREATE INDEX IX_CCCZEROMINMAX_BATCHID ON CCCZEROMINMAX(BATCHID);
CREATE INDEX IX_CCCZEROMINMAX_RESETAT_LA ON CCCZEROMINMAX(RESETAT_LA);
CREATE INDEX IX_CCCZEROMINMAX_MTRL_BRANCH ON CCCZEROMINMAX(MTRL, BRANCH);
```

---

## Specificații Funcționale

### 1. Filtru Cod Articol
| Aspect | Detaliu |
|--------|---------|
| Valoare implicită | `FS` (hardcodat) |
| Editabil | ✅ Da |
| Wildcard | `%` adăugat automat în procesare (`FS` → `FS%`) |
| Comportament | `LIKE 'FS%'` = "începe cu" |
| Case sensitivity | ✅ Case-sensitive |
| Fără filtru | 🚫 Buton procesare dezactivat |

### 2. Selecție Branch-uri
| Aspect | Detaliu |
|--------|---------|
| UI Component | Reutilizare **fancy dropdown** din Branch Replenishment |
| Implicit | Toate branch-urile active **pre-selectate** (fără HQ) |
| HQ (1000) | 🚫 **EXCLUS** complet |
| Multiselect | ✅ Da |
| Nicio selecție | 🚫 Buton procesare dezactivat |

### 3. Criteriu Articole (SQL) - Optimizat
> **Notă**: Pornim de la `MTRBRNLIMITS` ca tabel principal pentru performanță optimă:
> - Filtrul pe BRANCH se aplică direct pe tabelul principal
> - Mai puține înregistrări de scanat (doar cele cu min/max diferit de 0)
> - JOIN cu MTRL doar pentru detalii și validări

```sql
SELECT 
    l.MTRL,
    m.CODE, 
    SUBSTRING(m.NAME, 1, 30) AS NAME,
    l.BRANCH,
    l.CCCMINAUTO,
    l.CCCMAXAUTO,
    l.REMAINLIMMIN,
    l.REMAINLIMMAX
FROM MTRBRNLIMITS l
INNER JOIN MTRL m ON l.MTRL = m.MTRL AND l.COMPANY = m.COMPANY
WHERE l.COMPANY = 1000                          -- X.SYS.COMPANY
  AND l.BRANCH IN (1200, 1300, ...)             -- branch-uri selectate (filtru principal)
  AND (l.CCCMINAUTO <> 0 OR l.CCCMAXAUTO <> 0)  -- skip cele deja pe 0
  AND m.ISACTIVE = 1                            -- articole active
  AND m.SODTYPE = 51                            -- tip articol
  AND m.CODE LIKE 'FS%'                         -- filtru cod dinamic
ORDER BY m.CODE, l.BRANCH
```

### 4. Acțiune Resetare (Tranzacție SQL) - Optimizat
> **Notă**: `MTRBRNLIMITS` ca tabel principal în ambele operații pentru consistență și performanță.

```sql
BEGIN TRANSACTION;

-- 1. Insert istoric (valorile vechi) - pornim de la MTRBRNLIMITS
INSERT INTO CCCZEROMINMAX (BATCHID, MTRL, BRANCH, CODE, OLD_CCCMINAUTO, OLD_CCCMAXAUTO, RESETAT_LA, RESETAT_DE, FILTRU_FOLOSIT)
SELECT 
    @batchId,
    l.MTRL,
    l.BRANCH,
    m.CODE,
    l.CCCMINAUTO,
    l.CCCMAXAUTO,
    GETDATE(),
    @userId,
    @filtru
FROM MTRBRNLIMITS l
INNER JOIN MTRL m ON l.MTRL = m.MTRL AND l.COMPANY = m.COMPANY
WHERE l.COMPANY = 1000
  AND l.BRANCH IN (@branches)
  AND (l.CCCMINAUTO <> 0 OR l.CCCMAXAUTO <> 0)
  AND m.ISACTIVE = 1
  AND m.SODTYPE = 51
  AND m.CODE LIKE @filtru;

-- 2. Update valorile la 0 - aceeași condiție pentru consistență
UPDATE l
SET l.CCCMINAUTO = 0,
    l.CCCMAXAUTO = 0
FROM MTRBRNLIMITS l
INNER JOIN MTRL m ON l.MTRL = m.MTRL AND l.COMPANY = m.COMPANY
WHERE l.COMPANY = 1000
  AND l.BRANCH IN (@branches)
  AND (l.CCCMINAUTO <> 0 OR l.CCCMAXAUTO <> 0)
  AND m.ISACTIVE = 1
  AND m.SODTYPE = 51
  AND m.CODE LIKE @filtru;

COMMIT;
```

---

## UI Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Achiziții > Min Max                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cod articol: [FS________] (începe cu)                     │
│                                                             │
│  Branch-uri:  [▼ 14 branch-uri selectate    ]              │
│               ☑ CLUJ (1200)    ☑ CONSTANTA (1300)          │
│               ☑ GALATI (1400)  ☑ PLOIESTI (1500)           │
│               ... (fancy dropdown multiselect)              │
│                                                             │
│  [🔍 Preview]  [🗑️ Resetează]                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Proces în curs inițiat de admin@mec.ro (opțional)       │
├─────────────────────────────────────────────────────────────┤
│  Preview: 1,234 articole vor fi afectate                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ CODE     │ NAME                  │BRANCH│MINAUTO│MAXAUTO││
│  ├─────────────────────────────────────────────────────────┤│
│  │ FS001234 │ Filtru aer BMW...     │ 1200 │  15   │  30   ││
│  │ FS001234 │ Filtru aer BMW...     │ 1300 │  10   │  20   ││
│  │ FS001235 │ Filtru ulei VW...     │ 1200 │   5   │  12   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [◀ Prev] Pagina 1 din 25 [Next ▶]  [50 ▼] per pagină      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Progress: 500/1234                                        │
│  ████████████████░░░░░░░░░░░░░░░░░░ 40%                    │
│                                                             │
│  ✓ Resetate: 500    ⏳ Rămase: 734                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Real-Time Events (FeathersJS Channels)

### Channel Setup
```javascript
// În channels.js sau app.js
app.on('login', (payload, { connection }) => {
  if (connection) {
    // Toți utilizatorii autentificați primesc notificări zero-minmax
    app.channel('zero-minmax').join(connection);
  }
});
```

### Events Published
| Event | Payload | Descriere |
|-------|---------|-----------|
| `zero-minmax-started` | `{ batchId, user, filter, branches, totalCount, startedAt }` | Proces pornit |
| `zero-minmax-progress` | `{ batchId, processed, total, percent }` | Update progres |
| `zero-minmax-completed` | `{ batchId, totalReset, duration, completedAt }` | Proces finalizat |
| `zero-minmax-error` | `{ batchId, error, failedAt }` | Eroare |

### Client Subscription
```javascript
// În componenta LitElement
app.service('zero-minmax').on('started', (data) => {
  if (data.batchId !== this.currentBatchId) {
    this.showWarning(`Proces în curs inițiat de ${data.user}`);
  }
});

app.service('zero-minmax').on('progress', (data) => {
  this.updateProgress(data);
});
```

---

## Implementation Checklist

### Phase 1: AJS Backend (ZeroMinMax.js)
- [x] **1.1** Creare fișier `S1-MEC/AJS/ZeroMinMax.js` cu structură de bază
- [x] **1.2** Funcție `setup()` - creează tabelul CCCZEROMINMAX + indexes
- [x] **1.3** Funcție `getPreviewData(obj)` - returnează articolele pentru preview cu paginare
- [x] **1.4** Funcție `getPreviewCount(obj)` - returnează doar COUNT pentru confirmare rapidă
- [x] **1.5** Funcție `processZeroMinMax(obj)` - execută resetarea în tranzacție SQL (X.RUNSQL)
- [x] **1.6** Funcție `getActiveBranches(obj)` - returnează branch-urile active (fără HQ)
- [x] **1.7** Funcție `getResetHistory(obj)` - returnează istoricul resetărilor
- [x] **1.8** Funcție `getResetSummary(obj)` - rezumat batches recente (bonus)
- [x] **1.9** Funcție `cleanup(obj)` - curățare istoric vechi (bonus)

### Phase 2: Feathers Service `zero-minmax`
- [x] **2.1** Creare clasa `ZeroMinMaxService` în `src/services/zero-minmax/zero-minmax.class.js`
- [x] **2.2** Metodă `initialize(data, params)` - setup tabel CCCZEROMINMAX
- [x] **2.3** Metodă `preview(data, params)` - preview articole cu paginare
- [x] **2.4** Metodă `count(data, params)` - count articole afectate
- [x] **2.5** Metodă `process(data, params)` - procesare cu progress și events
- [x] **2.6** Metodă `branches(data, params)` - lista branch-uri active
- [x] **2.7** Metodă `history(data, params)` - istoric resetări
- [x] **2.8** Configurare real-time channels pentru notificări (started, completed, error, progress)
- [x] **2.9** Înregistrare serviciu în `src/services/index.js`
- [x] **2.10** Declarare client în `public/socketConfig.js`

### Phase 3: LitElement Component
- [x] **3.1** Creare fișier `public/components/zero-minmax/zero-minmax-panel.js`
- [x] **3.2** Creare CSS `public/components/zero-minmax/zero-minmax-panel.css` (opțional, poate fi inline)
- [x] **3.3** Implementare UI filtru cod articol cu valoare default "FS"
- [x] **3.4** Reutilizare/adaptare fancy dropdown pentru branch-uri (din query-panel.js)
- [x] **3.5** Implementare tabel preview cu paginare
- [x] **3.6** Implementare buton Preview cu afișare count
- [x] **3.7** Implementare buton Resetează cu dialog confirmare
- [x] **3.8** Implementare progress bar și status indicators
- [x] **3.9** Implementare ascultare real-time events (warning pentru proces în curs)
- [x] **3.10** Validări UI (buton dezactivat când filtru gol sau niciun branch selectat)

### Phase 4: Integration
- [x] **4.1** Adăugare tab "Min Max" în index.html (primul tab în secțiunea Achiziții)
- [x] **4.2** Import component în index.html
- [x] **4.3** Adăugare handler pentru tab în userInteractions.js și hierarchical-navigation.js
- [x] **4.4** Configurare channel în Feathers pentru real-time events
- [ ] **4.5** Testare end-to-end flow complet

### Phase 5: Testing & Documentation
- [ ] **5.1** Test: Filtru gol → buton dezactivat
- [ ] **5.2** Test: Niciun branch selectat → buton dezactivat
- [ ] **5.3** Test: Preview cu diferite filtre
- [ ] **5.4** Test: Resetare cu confirmare
- [ ] **5.5** Test: Verificare istoric în CCCZEROMINMAX
- [ ] **5.6** Test: Real-time notification la alt utilizator
- [ ] **5.7** Test: Comportament cu volum mare de date
- [ ] **5.8** Documentare finală

---

## Progress Log

| Data | Etapă | Status | Note |
|------|-------|--------|------|
| 2026-02-02 | PRD creat | ✅ Complet | Document inițial |
| 2026-02-02 | Phase 1: AJS Backend | ✅ Complet | ZeroMinMax.js creat cu toate funcțiile |
| 2026-02-02 | Phase 2: Feathers Service | ✅ Complet | Serviciu în src/services/zero-minmax/ |
| 2026-02-02 | Phase 3: LitElement | ✅ Complet | zero-minmax-panel.js (801 linii) |
| 2026-02-02 | Phase 4: Integration | ✅ Complet | Tab, handler, socketConfig actualizate |
| | Phase 5: Testing | ⏳ Pending | Necesită testare manuală |

---

## Technical Notes

### AJS SQL Execution Pattern (din TopAbcAnalysis.js)
```javascript
// Pentru SELECT - returnează dataset
var ds = X.GETSQLDATASET(qry, null);
var jsonResult = ds.JSON;

// Pentru INSERT/UPDATE în tranzacție - folosim X.RUNSQL
// Construim query-ul complet cu toate valorile
var qry = "BEGIN TRANSACTION; " +
          "INSERT INTO ... " +
          "UPDATE ... " +
          "COMMIT;";
X.RUNSQL(qry, null);
```

### S1 Naming Conventions
- Tabel: `CCCZEROMINMAX` (prefix CCC pentru custom)
- Coloane: UPPERCASE fără underscore
- PK: `ID` (IDENTITY)

### AJS Constraints
- ES5 syntax (no arrow functions, no const/let)
- Funcții exportate prin `lib` object
- Conexiune DB:
  - `X.GETSQLDATASET(sql, params)` - SELECT queries → returnează TDataset
  - `X.RUNSQL(sql, params)` - INSERT/UPDATE/DELETE queries
  - `X.SQL(sql, params)` - SELECT single value → returnează string

### Paginare Pattern
```javascript
// Preview cu paginare
function getPreviewData(obj) {
    var page = obj.page || 1;
    var pageSize = obj.pageSize || 50;
    var offset = (page - 1) * pageSize;
    
    var qry = "SELECT ... " +
              "ORDER BY m.CODE, l.BRANCH " +
              "OFFSET " + offset + " ROWS " +
              "FETCH NEXT " + pageSize + " ROWS ONLY";
    // ...
}
```

### Real-Time Pattern (FeathersJS)
```javascript
// Server-side: publish event
app.service('zero-minmax').publish('started', (data, context) => {
  return app.channel('zero-minmax');
});

// Client-side: subscribe
app.service('zero-minmax').on('started', (data) => {
  console.log('Process started:', data);
});
```

---

## Dependencies
- LitElement (already loaded via lit-all.min.js)
- FeathersJS Client (already configured)
- Socket.io (for real-time channels)
- Fancy dropdown component (reutilizare din query-panel.js)

---

## Security Considerations
- **Permisiuni**: Deocamdată toți utilizatorii autentificați au acces
- **Audit Trail**: Toate modificările sunt logate în CCCZEROMINMAX cu user ID
- **Validare Input**: Filtrul este sanitizat pentru SQL injection (escaped quotes)

---

## Future Enhancements (Out of Scope)
- [ ] Rollback funcționalitate (anulare resetare din istoric)
- [ ] Export istoric în Excel
- [ ] Permisiuni granulare pe utilizator/rol
- [ ] Programare resetări automate (scheduler)
