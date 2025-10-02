# Quick Test - Diagnostic Feature

**Data:** 1 Octombrie 2025

---

## 🎯 Pași Rapizi de Testare

### Pasul 1: Activează Debug Mode

1. Deschide aplicația: `http://mecdiesel-soft1.concept24.tech/#top`
2. Click pe tab "Branch Replenishment"
3. Asigură-te că Query Panel este vizibil (buton verde "Încarcă Date")
4. **Găsește și bifează checkbox-ul "Mod Debug (Diagnostic materiale excluse)"**
   - Icon: 🐞 (bug icon)
   - Locație: În Query Panel, în secțiunea de opțiuni

### Pasul 2: Load Data

1. Selectează:
   - **Source:** 2200 - BUCURESTI
   - **Destination:** 1400 - GALATI (sau orice altă sucursală)
2. Click "Încarcă Date"
3. Așteaptă încărcarea

### Pasul 3: Verifică Banner-ul

După încărcare, ar trebui să apară un **banner galben** deasupra tabelului cu:
- Icon: ⚠️
- Text: **"Diagnostic: X materiale au fost excluse din rezultate."**
- Buton: **"🔍 Afișează Diagnostic"**
- Buton X pentru închidere

### Pasul 4: Deschide Modal-ul

1. Click pe butonul **"Afișează Diagnostic"**
2. Se deschide un modal mare cu:
   - Header galben: "⚠️ Diagnostic Materiale Excluse"
   - Tabel cu materiale excluse
   - Coloane: Cod Material, Denumire, Motiv, Fil. Emit, etc.
   - Badge-uri colorate pentru fiecare motiv
   - Secțiune "Sumar" cu statistici
   - Secțiune "Ajutor" cu explicații
   - Buton "Export CSV"

---

## 🔍 Ce Să Verifici în Browser Console

Deschide Developer Tools (F12) → Console tab

### Log-uri Așteptate:

```
📋 QueryPanel received store update: SET_DEBUG_MODE
🐛 QueryPanel: debugMode changed from false to true

[După Load Data]
🐛 Debug: X diagnostic entries received
🐛 Debug: First diagnostic entry: {Cod: "...", Denumire: "...", Motiv: "..."}
📦 Container received store update: SET_DIAGNOSTICS
🐛 Render - diagnostics: [...], debugMode: true
Render - filtered count: Y, total: Y
```

---

## 🧪 Test Manual (Dacă Nu Funcționează)

Copiază și execută în Browser Console:

```javascript
// 1. Verifică store state
console.log('Debug Mode:', replenishmentStore.getState().debugMode);
console.log('Diagnostics:', replenishmentStore.getState().diagnostics);

// 2. Force enable debug mode
replenishmentStore.setDebugMode(true);

// 3. Add test diagnostics
replenishmentStore.setDiagnostics([
    {
        Cod: 'TEST001',
        Denumire: 'Material de Test 1',
        Motiv: 'LIPSA_STOC_EMIT',
        FilEmit: '2200',
        NumeFilEmit: 'BUCURESTI',
        FilDest: '1400',
        NumeFilDest: 'GALATI',
        Detalii: 'Test - Material nu are stoc în sucursala emițătoare'
    },
    {
        Cod: 'TEST002',
        Denumire: 'Material de Test 2',
        Motiv: 'LIMITE_INEXISTENTE_DEST',
        FilEmit: '2200',
        NumeFilEmit: 'BUCURESTI',
        FilDest: '1400',
        NumeFilDest: 'GALATI',
        Detalii: 'Test - Nu există limite configurate în MTRBRNLIMITS pentru destinație'
    }
]);

// 4. Verifică dacă banner apare
const container = document.querySelector('branch-replenishment-container');
console.log('Container diagnostics:', container.diagnostics);
console.log('Should show banner:', container.diagnostics && container.diagnostics.length > 0);

// 5. Force open modal
const modal = document.querySelector('diagnostic-modal');
if (modal) {
    modal.show(replenishmentStore.getDiagnostics());
} else {
    console.error('❌ Modal element not found!');
}
```

---

## ✅ Checklist Success Criteria

Banner apare:
- [ ] Banner galben vizibil după Load Data
- [ ] Text corect: "X materiale au fost excluse"
- [ ] Buton "Afișează Diagnostic" funcționează

Modal funcționează:
- [ ] Modal se deschide la click pe buton
- [ ] Tabel cu diagnostice este populat
- [ ] Badge-uri colorate pentru fiecare motiv
- [ ] Export CSV funcționează
- [ ] Caractere românești (ă, â, î, ș, ț) apar corect în CSV

Debug Mode:
- [ ] Checkbox vizibil în Query Panel
- [ ] Toggle ON/OFF funcționează
- [ ] La OFF, diagnostics sunt șterse
- [ ] La ON + Load Data, diagnostics sunt populate

---

## 🚨 Troubleshooting Rapid

### Banner NU apare:

**Check 1:** Debug mode activat?
```javascript
replenishmentStore.getState().debugMode  // Trebuie TRUE
```

**Check 2:** Diagnostics există?
```javascript
replenishmentStore.getDiagnostics()  // Trebuie array cu obiecte
```

**Check 3:** Container are diagnostics?
```javascript
document.querySelector('branch-replenishment-container').diagnostics
```

### Modal NU se deschide:

**Check 1:** Element există?
```javascript
document.querySelector('diagnostic-modal')  // Trebuie să returneze element
```

**Check 2:** Bootstrap loaded?
```javascript
typeof bootstrap  // Trebuie "object"
```

**Check 3:** Test manual:
```javascript
const modal = document.querySelector('diagnostic-modal');
modal.show([{Cod: 'TEST', Denumire: 'Test', Motiv: 'LIPSA_STOC_EMIT', FilEmit: '01', NumeFilEmit: 'Test', FilDest: '02', NumeFilDest: 'Test', Detalii: 'Test'}]);
```

---

## 📸 Screenshots Expected

### 1. Query Panel cu Debug Checkbox
- Checkbox vizibil cu 🐞 icon
- Label: "Mod Debug (Diagnostic materiale excluse)"

### 2. Banner După Load Data
- Banner galben deasupra tabelului
- Text: "Diagnostic: X materiale..."
- Buton albastru: "🔍 Afișează Diagnostic"

### 3. Modal Deschis
- Header galben cu ⚠️
- Tabel cu multiple coloane
- Badge-uri roșii/galbene/albastre pentru Motiv
- Secțiune Sumar cu count per motiv
- Secțiune Ajutor cu explicații

---

## 📞 Contact Support

Dacă după toate testele banner-ul încă nu apare, raportează cu:

1. **Screenshot** din Browser Console (F12) după Load Data
2. **Network tab** - Request/Response pentru `getAnalyticsForBranchReplenishment`
3. **Value-uri din store:**
   ```javascript
   {
       debugMode: replenishmentStore.getState().debugMode,
       diagnosticsLength: replenishmentStore.getDiagnostics().length,
       firstDiagnostic: replenishmentStore.getDiagnostics()[0]
   }
   ```

---

**Timp estimat de testare:** 5-10 minute  
**Dificultate:** 🟢 LOW (user-friendly)  
**Status:** ✅ READY FOR TESTING
