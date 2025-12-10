# PRD: Batch Processing System - Persistent Queue

## Overview
Sistem persistent de procesare batch pentru operațiunile "Move items online" și "Stock evidence", cu UI feedback în timp real și logging dedicat.

---

## Problem Statement
1. **Volatilitate**: Array-ul `codes[]` din browser se pierde la refresh
2. **UI feedback slab**: Doar text simplu de status, fără progress tracking
3. **Logging amestecat**: CCCITALYSYNCLOG conține prea multe module mixate

---

## Solution Architecture

### Database
- **Tabel nou**: `CCCBATCHQUEUE` în SoftOne cloud (NU în Italy DB)
- **Retenție**: 6 luni cu auto-cleanup

### Backend
- **AJS**: `S1-MEC/AJS/BatchQueue.js` (ES5)
- **Feathers**: Serviciu batch-queue în `src/app.js`

### Frontend
- **Component**: `<batch-processing-container>` (LitElement)
- **Locație**: `public/components/batch-processing/batch-processing-container.js`

---

## Database Schema: CCCBATCHQUEUE

| Column | Type | Description |
|--------|------|-------------|
| CCCBATCHQUEUE | INT | PK, Identity |
| BATCHID | NVARCHAR(50) | UUID sesiune (ex: `batch_1733150400000_abc123`) |
| QUEUETYPE | NVARCHAR(20) | `MOVE_ONLINE` sau `STOCK_EVIDENCE` |
| CODE | NVARCHAR(50) | Codul procesat |
| MTRL | INT | ID material din SoftOne |
| STATUS | NVARCHAR(20) | `PENDING`, `PROCESSING`, `SUCCESS`, `ERROR`, `CANCELLED` |
| CREATEDAT | DATETIME | Timestamp creare |
| STARTEDAT | DATETIME | Timestamp start procesare |
| COMPLETEDAT | DATETIME | Timestamp finalizare |
| MESSAGE | NVARCHAR(500) | Mesaj rezultat |
| ERRORDETAILS | NVARCHAR(MAX) | Detalii eroare (dacă există) |
| ERPRESPONSE | NVARCHAR(MAX) | Răspuns raw de la ERP |
| DURATIONMS | INT | Durata procesare în ms |
| FILENAME | NVARCHAR(255) | Numele fișierului Excel uploadat |
| BATCHSIZE | INT | Numărul total de coduri în batch |
| BATCHNUMBER | INT | Index în batch (1, 2, 3...) |
| TOTALINBATCH | INT | Total items în batch |
| USR | INT | ID user care a inițiat |

---

## Implementation Checklist

### Phase 1: AJS Backend (BatchQueue.js)
- [x] **1.1** Creare fișier `S1-MEC/AJS/BatchQueue.js` cu structură de bază
- [x] **1.2** Funcție `createBatchQueueTable()` - creează tabelul CCCBATCHQUEUE
- [x] **1.3** Funcție `cleanupOldBatchRecords()` - șterge înregistrări >6 luni
- [x] **1.4** Funcție `insertBatchCodes(obj)` - inserează coduri în queue
- [x] **1.5** Funcție `updateBatchStatus(obj)` - actualizează status cod
- [x] **1.6** Funcție `getBatchByBatchId(obj)` - returnează toate codurile unui batch
- [x] **1.7** Funcție `getBatchSummary(obj)` - returnează statistici agregate
- [x] **1.8** Funcție `getPendingBatches(obj)` - returnează batch-uri incomplete
- [x] **1.9** Funcție `cancelBatch(obj)` - marchează PENDING ca CANCELLED
- [x] **1.10** Funcție `retryErrorCodes(obj)` - resetează ERROR la PENDING
- [x] **1.11** Funcție `logBatchStartStop(obj)` - log minimal în CCCITALYSYNCLOG

**Funcții adiționale implementate:**
- [x] `getNextPendingCode(obj)` - returnează următorul cod PENDING pentru procesare
- [x] `getRecentBatches(obj)` - returnează batch-urile din ultimele 30 zile

### Phase 2: Feathers Service `batch-queue` (Arhitectură FeathersJS)
Serviciul va fi înregistrat cu `app.use('batch-queue', new BatchQueueService(), { methods: [...] })`

**Standard CRUD Methods:**
- [x] **2.1** `find(params)` - Returnează batch-uri/coduri cu filtrare prin `params.query`
  - Query: `{ batchId }` → toate codurile unui batch
  - Query: `{ pending: true }` → batch-uri incomplete
  - Query: `{ limit, usr }` → batch-uri recente
- [x] **2.2** `get(id, params)` - Returnează summary pentru un batch (id = batchId)
- [x] **2.3** `create(data, params)` - Inserează coduri noi în queue
  - `data`: `{ batchId, queueType, codes: [...], filename, usr, token }`
  - Suportă array de coduri (bulk insert)
- [x] **2.4** `patch(id, data, params)` - Actualizează status/rezultat cod
  - `id`: PK (CCCBATCHQUEUE)
  - `data`: `{ status, mtrl, message, errorDetails, erpResponse, durationMs, token }`

**Custom Methods (înregistrate în `methods` option):**
- [x] **2.5** `cancel(data, params)` - Marchează toate PENDING ca CANCELLED
  - `data`: `{ batchId, token }`
- [x] **2.6** `retry(data, params)` - Resetează ERROR la PENDING
  - `data`: `{ batchId, token }`
- [x] **2.7** `summary(data, params)` - Returnează statistici pentru un batch
  - `data`: `{ batchId, token }`

**Metode adiționale implementate:**
- [x] `next(data, params)` - Returnează următorul cod PENDING pentru procesare
- [x] `process(data, params)` - Procesează un cod complet (PROCESSING → ERP call → SUCCESS/ERROR)
- [x] `initialize(data, params)` - Inițializează tabelul CCCBATCHQUEUE (apelat la startup sau prima utilizare)
- [x] `cleanup(data, params)` - Șterge înregistrări vechi (apelat periodic)

**⚠️ Important: AJS nu execută cod automat la încărcare!**
Funcțiile `createBatchQueueTable()` și `cleanupOldBatchRecords()` trebuie apelate explicit din Feathers.
- `initialize()` - apelat la prima utilizare sau la startup (NU `setup` - rezervat de FeathersJS)
- `cleanup()` - apelat periodic (zilnic/săptămânal)

**Service Registration:**
```javascript
app.use('batch-queue', new BatchQueueService(), {
  methods: ['find', 'get', 'create', 'patch', 'cancel', 'retry', 'summary', 'next', 'process', 'initialize', 'cleanup']
});
```

### Phase 3: LitElement Component
- [x] **3.1** Creare fișier component și structură de bază
- [x] **3.2** Implementare upload Excel și parsare cu XLSX.js
- [x] **3.3** Implementare afișare progress (pending/processing/success/error counts)
- [x] **3.4** Implementare listă sesiuni cu detalii
- [x] **3.5** Implementare buton Cancel batch
- [x] **3.6** Implementare buton Retry errors
- [x] **3.7** Implementare Export rezultate (XLSX.js)
- [x] **3.8** Implementare detectare sesiune incompletă la refresh
- [x] **3.9** Implementare auto-refresh status (polling)

### Phase 4: Integration
- [x] **4.1** CSS încorporat în component (LitElement styles)
- [x] **4.2** Actualizare index.html - înlocuire #batchApp cu `<batch-processing-container>`
- [x] **4.3** Import component în index.html
- [ ] **4.4** Testare end-to-end flow complet

### Phase 5: Cleanup & Documentation
- [x] **5.1** Curățare cod vechi din userInteractions.js (comentat legacy code)
- [ ] **5.2** Testare recovery după refresh
- [ ] **5.3** Documentare finală

---

## Progress Log

| Data | Etapă | Status | Note |
|------|-------|--------|------|
| 2024-12-02 | PRD creat | ✅ Complet | Document inițial |
| 2024-12-02 | Phase 1: AJS Backend | ✅ Complet | BatchQueue.js cu toate funcțiile |
| 2024-12-02 | Phase 2: Feathers Service | ✅ Complet | BatchQueueService cu CRUD + custom methods |
| 2024-12-02 | Phase 3: LitElement | ✅ Complet | batch-processing-container.js |
| 2024-12-02 | Phase 4: Integration | ✅ Complet | index.html actualizat |
| 2024-12-02 | Phase 5.1: Cleanup | ✅ Complet | Legacy code comentat în userInteractions.js |

---

## Technical Notes

### FeathersJS Service Architecture
```javascript
// Service class structure
class BatchQueueService {
  constructor(app) {
    this.app = app;
  }
  
  // Standard CRUD
  async find(params) { }      // GET /batch-queue?query=...
  async get(id, params) { }   // GET /batch-queue/:id
  async create(data, params) { }  // POST /batch-queue
  async patch(id, data, params) { }  // PATCH /batch-queue/:id
  async remove(id, params) { }  // DELETE /batch-queue/:id
  
  // Custom methods (require methods option)
  async cancel(data, params) { }  // POST /batch-queue/cancel
  async retry(data, params) { }   // POST /batch-queue/retry
  async summary(data, params) { } // POST /batch-queue/summary
}

// Registration with custom methods exposed
app.use('batch-queue', new BatchQueueService(app), {
  methods: ['find', 'get', 'create', 'patch', 'remove', 'cancel', 'retry', 'summary']
});
```

### Client Usage (Frontend)
```javascript
// Standard methods
const batches = await app.service('batch-queue').find({ query: { batchId: 'xxx' } });
const item = await app.service('batch-queue').get(123);
await app.service('batch-queue').create({ batchId, codes: [...] });
await app.service('batch-queue').patch(123, { status: 'SUCCESS' });

// Custom methods
await app.service('batch-queue').cancel({ batchId: 'xxx' });
await app.service('batch-queue').retry({ batchId: 'xxx' });
const stats = await app.service('batch-queue').summary({ batchId: 'xxx' });
```

### S1 Naming Conventions
- Tabel: `CCCBATCHQUEUE` (prefix CCC pentru custom)
- Coloane: UPPERCASE fără underscore
- PK: același nume cu tabelul

### AJS Constraints
- ES5 syntax (no arrow functions, no const/let)
- Funcții exportate prin `lib` object
- Conexiune DB:
  - `X.GETSQLDATASET(sql, params)` - SELECT queries → returnează TDataset
  - `X.RUNSQL(sql, params)` - INSERT/UPDATE/DELETE queries
  - `X.SQL(sql, params)` - SELECT single row → returnează string CSV

### Existing Functions Reference
- `SyncItaly.js`: `processListOfCodes()`, `logMessage()`
- `StockAvailChange.js`: `processListOfStocks()`
- `app.js`: `makeBatchRequest()`, `processListOfStocks()`

---

## UI Wireframe (Text)

```
┌─────────────────────────────────────────────────────────────┐
│  Batch Processing                                           │
├─────────────────────────────────────────────────────────────┤
│  ○ Move items online    ○ Stock evidence                   │
│                                                             │
│  [Choose file...] file.xlsx    [▶ Process] [⏹ Stop]        │
├─────────────────────────────────────────────────────────────┤
│  Progress: 45/100                                          │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░ 45%             │
│                                                             │
│  ✓ Success: 40    ✗ Error: 3    ◷ Pending: 55    ⟳ Processing: 2  │
├─────────────────────────────────────────────────────────────┤
│  Recent Sessions                          [↻ Retry Errors] │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ batch_1733150400000  │ MOVE_ONLINE │ 100 │ In Progress│ │
│  │ batch_1733064000000  │ STOCK_EVID  │ 50  │ Completed  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [📥 Export Results]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies
- XLSX.js (already loaded)
- LitElement (already loaded via lit-all.min.js)
- Socket.io (available for future real-time updates)
- Feathers client (already configured)
