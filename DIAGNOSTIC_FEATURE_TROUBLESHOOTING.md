# Diagnostic Feature - Troubleshooting Guide

**Data:** 1 Octombrie 2025  
**Issue:** Banner diagnostic și buton "Afișează Diagnostic" nu apar în UI

---

## 🔍 Checklist de Debugging

### 1. Verifică Checkbox-ul Debug Mode

**În Query Panel:**
- [ ] Checkbox-ul "Mod Debug (Diagnostic materiale excluse)" este vizibil?
- [ ] Checkbox-ul este CHECKED (bifat)?
- [ ] Icon `fas fa-bug` apare lângă text?

**Cum să verifici:**
```javascript
// În Browser Console
replenishmentStore.getState().debugMode  // Trebuie să fie TRUE
```

---

### 2. Verifică Răspunsul de la Backend

**După Load Data, verifică în Console:**

```javascript
// Ar trebui să vezi aceste log-uri:
// 🐛 Debug: X diagnostic entries received
// 🐛 Debug: First diagnostic entry: {...}
// 🐛 Render - diagnostics: [...], debugMode: true
```

**Verifică manual response-ul:**
```javascript
// În Browser Console, după ce ai făcut Load Data
replenishmentStore.getState().diagnostics  // Ar trebui să fie array cu obiecte
replenishmentStore.getDiagnostics()        // Metoda convenience
```

---

### 3. Verifică Structura Diagnostics

**Format așteptat:**
```javascript
{
    Cod: "MTRL001",
    Denumire: "Nume Material",
    Motiv: "LIPSA_STOC_EMIT",  // Unul din cele 6 coduri
    FilEmit: "2200",
    NumeFilEmit: "BUCURESTI",
    FilDest: "1400",
    NumeFilDest: "GALATI",
    Detalii: "Descriere detalii..."
}
```

**Coduri Motiv valide:**
- `LIPSA_STOC_EMIT`
- `LIMITE_INEXISTENTE_EMIT`
- `LIMITE_INEXISTENTE_DEST`
- `BRANCH_INACTIV_DEST`
- `LIMITE_ZERO_DEST`
- `NECESAR_ZERO_DEST`

---

### 4. Verifică SQL Procedure

**Test sp_GetMtrlsDiagnostics direct în SQL Server:**

```sql
EXEC sp_GetMtrlsDiagnostics
    @branchesEmit = '2200',
    @branchesDest = '1400',
    @company = 1000,
    @setConditionForNecesar = 1,
    @setConditionForLimits = 1,
    @fiscalYear = 2025,
    @materialCodeFilter = NULL,
    @materialCodeFilterExclude = 0
```

**Verifică:**
- [ ] Procedura returnează rânduri?
- [ ] Coloanele returnate sunt: `Cod`, `Denumire`, `Motiv`, `FilEmit`, `NumeFilEmit`, `FilDest`, `NumeFilDest`, `Detalii`
- [ ] Coloana `Motiv` conține unul din cele 6 coduri valide

---

### 5. Verifică AJS Script (Soft1)

**În ReumplereSucursale.js, verifică:**

```javascript
// Parametrul debug trebuie transmis
var debug = apiObj.hasOwnProperty('debug') ? apiObj.debug : false;

// Response trebuie să conțină diagnostics
var obj = {
    rows: rows,
    diagnostics: [],  // <- Ar trebui populat când debug=true
    duration: d,
    debug: debug
};
```

**Test manual în Soft1:**
- Accesează `/JS/ReumplereSucursale/getAnalytics`
- Trimite POST cu `debug: true`
- Verifică că response conține `diagnostics` array

---

### 6. Verifică Backend Node.js

**În src/app.js, verifică:**

```javascript
// La linia 280
debug: data.debug !== undefined ? data.debug : false
```

**Test:**
```bash
# În terminal, verifică log-urile backend-ului
tail -f /var/log/pm2/app-error.log
# Sau
pm2 logs app
```

Caută pentru requests către `/JS/ReumplereSucursale/getAnalytics` și verifică dacă parametrul `debug` este transmis.

---

### 7. Verifică Render Condition

**În branch-replenishment-container.js, la linia ~1285:**

```javascript
${this.diagnostics && this.diagnostics.length > 0 ? html`
  <div class="alert alert-warning...">
    ...banner...
  </div>
` : ''}
```

**Debugging:**
```javascript
// În Browser Console, după render
const container = document.querySelector('branch-replenishment-container');
console.log('Container diagnostics:', container.diagnostics);
console.log('Is array?', Array.isArray(container.diagnostics));
console.log('Length:', container.diagnostics?.length);
```

---

## 🔧 Soluții Rapide

### Problema 1: debugMode FALSE

**Cauză:** Checkbox nu setează state-ul corect

**Soluție:**
```javascript
// În Browser Console
replenishmentStore.setDebugMode(true);
replenishmentStore.getState().debugMode  // Verifică că e true

// Apoi reload data
```

---

### Problema 2: diagnostics array gol

**Cauză:** SQL procedure nu returnează date SAU filtrele elimină toate rezultatele

**Soluție:**

**Option A - Test cu date dummy:**
```javascript
// În Browser Console
replenishmentStore.setDiagnostics([
    {
        Cod: 'TEST001',
        Denumire: 'Material Test',
        Motiv: 'LIPSA_STOC_EMIT',
        FilEmit: '2200',
        NumeFilEmit: 'BUCURESTI',
        FilDest: '1400',
        NumeFilDest: 'GALATI',
        Detalii: 'Test entry'
    }
]);

// Banner ar trebui să apară imediat
```

**Option B - Verifică parametrii SQL:**
- Asigură-te că `@setConditionForLimits` și `@setConditionForNecesar` permit returnarea de diagnostice
- Verifică că există materiale care satisfac condițiile de excludere

---

### Problema 3: Render nu se actualizează

**Cauză:** LitElement nu detectează change în diagnostics array

**Soluție:**
```javascript
// Force re-render în Browser Console
const container = document.querySelector('branch-replenishment-container');
container.requestUpdate();
```

SAU modifică în cod să folosească spread operator:

```javascript
// În _syncStateFromStore
this.diagnostics = [...state.diagnostics];  // Force new array reference
```

---

### Problema 4: Modal nu se deschide

**Cauză:** Bootstrap modal nu e inițializat sau selector-ul e greșit

**Soluție:**

**Test modal manual:**
```javascript
// În Browser Console
const modal = document.querySelector('diagnostic-modal');
console.log('Modal element:', modal);

const sampleData = [{
    Cod: 'TEST',
    Denumire: 'Test',
    Motiv: 'LIPSA_STOC_EMIT',
    FilEmit: '01',
    NumeFilEmit: 'Test',
    FilDest: '02',
    NumeFilDest: 'Test',
    Detalii: 'Test'
}];

modal.show(sampleData);
```

---

## 🧪 Test Script

**Accesează:** `http://mecdiesel-soft1.concept24.tech/#top` apoi în console:

```javascript
// 1. Set debug mode
replenishmentStore.setDebugMode(true);

// 2. Set sample diagnostics
replenishmentStore.setDiagnostics([
    {
        Cod: 'TEST001',
        Denumire: 'Material Test 1',
        Motiv: 'LIPSA_STOC_EMIT',
        FilEmit: '2200',
        NumeFilEmit: 'BUCURESTI',
        FilDest: '1400',
        NumeFilDest: 'GALATI',
        Detalii: 'Test - Lipsă stoc'
    }
]);

// 3. Verify banner appears
const container = document.querySelector('branch-replenishment-container');
console.log('Diagnostics in container:', container.diagnostics);

// 4. If banner appears, click "Afișează Diagnostic" button
// If modal doesn't open, force it:
const modal = document.querySelector('diagnostic-modal');
modal.show(replenishmentStore.getDiagnostics());
```

---

## 📝 Checklist Final

Înainte de a declara feature-ul funcțional, verifică:

- [ ] Checkbox "Mod Debug" este vizibil în Query Panel
- [ ] La check, `debugMode` devine `true` în store
- [ ] La "Load Data", se trimite `debug: true` către backend
- [ ] Backend trimite `debug: true` către Soft1 AJS
- [ ] AJS execută `sp_GetMtrlsDiagnostics`
- [ ] SQL returnează rânduri cu materiale excluse
- [ ] AJS returnează `{rows: [...], diagnostics: [...], debug: true}`
- [ ] Container setează `diagnostics` în store
- [ ] Banner galben apare cu textul "X materiale au fost excluse"
- [ ] Buton "Afișează Diagnostic" este vizibil în banner
- [ ] Click pe buton deschide modal-ul Bootstrap
- [ ] Modal arată tabel cu diagnostice
- [ ] Badge-uri colorate corespund motivelor
- [ ] Buton "Export CSV" funcționează
- [ ] CSV conține caractere românești corect (BOM)

---

## 🚨 Erori Comune

### Error: "diagnostics is undefined"

**Cauză:** Container nu primește diagnostics din store

**Soluție:**
```javascript
// Verifică _syncStateFromStore
this.diagnostics = state.diagnostics || [];  // Asigură array gol implicit
```

---

### Error: "Cannot read property 'show' of null"

**Cauză:** Modal element nu există în DOM

**Soluție:**
```javascript
// În _showDiagnosticModal
_showDiagnosticModal() {
    const modal = this.querySelector('diagnostic-modal');
    if (!modal) {
        console.error('❌ diagnostic-modal element not found in DOM');
        return;
    }
    
    const diagnostics = replenishmentStore.getDiagnostics();
    if (!diagnostics || diagnostics.length === 0) {
        console.warn('⚠️ No diagnostics to display');
        return;
    }
    
    modal.show(diagnostics);
}
```

---

### Error: Bootstrap modal nu se deschide

**Cauză:** Bootstrap JS nu e loaded SAU modal-ul e în Shadow DOM

**Soluție:**
```javascript
// Verifică că Bootstrap e loaded
console.log('Bootstrap:', typeof bootstrap);  // Trebuie "object"

// Verifică că modal folosește Light DOM
createRenderRoot() {
    return this;  // Light DOM - CORECT
}
```

---

## 📊 Timeline de Debugging

1. **0-2 min:** Verifică checkbox debug mode (secțiunea 1)
2. **2-5 min:** Verifică console logs după Load Data (secțiunea 2)
3. **5-10 min:** Test manual cu date dummy în console (secțiunea 8, Problema 2)
4. **10-15 min:** Verifică SQL procedure direct (secțiunea 4)
5. **15-20 min:** Verifică AJS response în Soft1 (secțiunea 5)
6. **20-25 min:** Verifică backend logs (secțiunea 6)
7. **25-30 min:** Deep dive în code cu breakpoints

**Dacă după 30 min încă nu funcționează:** Contactează echipa de dezvoltare cu rezultatele din checklist-uri.

---

**Creat:** 1 Octombrie 2025  
**Ultima actualizare:** 1 Octombrie 2025  
**Status:** 🔧 TROUBLESHOOTING GUIDE
