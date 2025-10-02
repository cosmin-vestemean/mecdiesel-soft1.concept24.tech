# Analiză Performanță sp_GetMtrlsDiagnostics

**Data:** 1 Octombrie 2025  
**Issue:** Timeout 503/408 când debug mode este activat  
**Procedură:** sp_GetMtrlsDiagnostics.sql

---

## 🔴 Probleme Critice Identificate

### 1. **CROSS JOIN cu mtrl (Scenariile 1-6)**

**Locație:** Toate cele 6 scenarii folosesc `CROSS JOIN #EmitBranches` sau `CROSS JOIN #DestBranches`

**Problema:**
```sql
FROM mtrl m
CROSS JOIN #EmitBranches eb  -- SAU #DestBranches db
```

**Impact:**
- Dacă `mtrl` are **50,000 materiale** și selectezi **1 sucursală emițătoare** și **1 sucursală destinație**
- **SCENARIO 1:** 50,000 materiale × 1 emit = **50,000 rânduri** verificate
- **SCENARIO 2:** 50,000 materiale × 1 emit = **50,000 rânduri** verificate
- **SCENARIO 3:** 50,000 materiale × 1 dest = **50,000 rânduri** verificate
- **SCENARIO 4:** 50,000 materiale × 1 dest = **50,000 rânduri** verificate
- **SCENARIO 5:** 50,000 materiale × 1 dest = **50,000 rânduri** verificate
- **SCENARIO 6:** 50,000 materiale × 1 dest = **50,000 rânduri** verificate

**TOTAL verificări:** 50,000 × 6 = **300,000 rânduri procesate!**

Dacă selectezi **2 emițătoare** și **5 destinații:**
- (50,000 × 2) + (50,000 × 5 × 4 scenarii) = **1,100,000 rânduri**

---

### 2. **NOT EXISTS cu Subquery Complex (Scenariul 1)**

**Locație:** Linia 113-125

```sql
AND NOT EXISTS (
    SELECT 1 
    FROM mtrfindata a
    INNER JOIN whouse w ON w.whouse = a.whouse
    INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = w.company AND br.company = @company
    WHERE a.mtrl = m.mtrl
    AND a.company = @company
    AND a.FISCPRD = @fiscalYear
    AND br.branch = eb.branch
    AND br.isactive = 1
    HAVING SUM(a.qty1) > 0
)
```

**Problema:**
- Executat pentru **FIECARE material** din CROSS JOIN
- Join-uri multiple: `mtrfindata` → `whouse` → `branch`
- `HAVING SUM(a.qty1) > 0` necesită agregare

**Impact:** Dacă 50,000 materiale, această subquery se execută de **50,000 ori** pentru SCENARIO 1 singur!

---

### 3. **Filtrare Material Code în TOATE Scenario-urile**

**Locație:** Linie 118-121 (și în toate scenariile)

```sql
AND (@materialCodeFilter IS NULL OR (
    (@materialCodeFilterExclude = 0 AND m.Code LIKE @materialCodeFilter + '%') OR
    (@materialCodeFilterExclude = 1 AND m.Code NOT LIKE @materialCodeFilter + '%')
))
```

**Problema:**
- Această filtrare se aplică **DUPĂ** CROSS JOIN
- Dacă filtrul nu există, toate cele 50,000 materiale intră în procesare
- Dacă filtrul există, SQL Server tot face CROSS JOIN întâi, apoi filtrează

**Impact:** CPU processing inutil pentru materiale care oricum vor fi filtrate

---

### 4. **Lipsa Limitării Rezultatelor**

**Problema:**
- Procedura returnează **TOATE** materialele excluse
- Nicio limită de tip `TOP 1000` sau paginare

**Impact:**
- Dacă sunt 40,000 materiale excluse, toate 40,000 sunt returnate
- JSON parsing în AJS devine extrem de lent
- Network transfer mare

---

### 5. **Duplicate Checking cu NOT EXISTS**

**Locație:** Sfârșitul fiecărui scenario

```sql
AND NOT EXISTS (
    SELECT 1 FROM #Diagnostics d WHERE d.mtrl = m.mtrl AND d.branchEmit = eb.branch
)
```

**Problema:**
- Verificare în temp table care crește pe măsură ce scenariile se execută
- Fără index pe #Diagnostics pentru această căutare

**Impact:** O(n²) complexity pe măsură ce #Diagnostics crește

---

## 📊 Estimare Timp de Execuție

### Scenarii Realiste:

| Materiale | Emit | Dest | Timp Estimat | Status |
|-----------|------|------|--------------|--------|
| 10,000 | 1 | 1 | ~15-30 sec | ⚠️ Warning |
| 25,000 | 1 | 1 | ~45-90 sec | 🔴 Likely Timeout |
| 50,000 | 1 | 1 | ~2-5 min | 🔴 Definit Timeout |
| 50,000 | 2 | 3 | ~10-15 min | 🔴 Imposibil |

**Timeout-uri tipice:**
- Soft1 API: ~30-60 secunde
- Browser: ~120 secunde
- Node.js request-promise: Default 120 secunde

---

## 🎯 Soluții Propuse

### Soluție 1: **LIMITĂ STRICT pe Materiale** ⭐⭐⭐⭐⭐

**Concept:** Diagnostica doar materialele care apar în rezultatul principal + top 1000 excluse

```sql
-- La început, creează temp table cu materiale relevante
CREATE TABLE #RelevantMaterials (mtrl INT PRIMARY KEY);

-- Populează cu materiale din rezultatul principal (sp_GetMtrlsData)
-- SAU cu materiale care au avut activitate recentă
INSERT INTO #RelevantMaterials
SELECT DISTINCT TOP 5000 mtrl  -- HARD LIMIT
FROM mtrfindata
WHERE company = @company
AND FISCPRD = @fiscalYear
ORDER BY mtrl;

-- Apoi în scenarii, înlocuiește:
-- FROM mtrl m
-- Cu:
FROM #RelevantMaterials rm
INNER JOIN mtrl m ON m.mtrl = rm.mtrl
```

**Avantaje:**
✅ Reduce CROSS JOIN de la 50,000 la 5,000 materiale  
✅ Diagnostice relevante (materiale active recent)  
✅ Timp de execuție predictibil

---

### Soluție 2: **Pre-calculează Stoc o Singură Dată** ⭐⭐⭐⭐⭐

**Concept:** Scenariul 1 calculează stoc per material-branch o singură dată

```sql
-- Creează temp table cu stocuri
CREATE TABLE #MaterialStock (
    mtrl INT,
    branch INT,
    stockQty DECIMAL(18,4),
    PRIMARY KEY (mtrl, branch)
);

INSERT INTO #MaterialStock
SELECT 
    a.mtrl,
    br.branch,
    SUM(a.qty1) AS stockQty
FROM mtrfindata a
INNER JOIN whouse w ON w.whouse = a.whouse
INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = @company
WHERE a.company = @company
AND a.FISCPRD = @fiscalYear
AND br.isactive = 1
GROUP BY a.mtrl, br.branch;

-- Apoi în SCENARIO 1, înlocuiește NOT EXISTS cu:
AND NOT EXISTS (
    SELECT 1 FROM #MaterialStock ms
    WHERE ms.mtrl = m.mtrl 
    AND ms.branch = eb.branch
    AND ms.stockQty > 0
)
```

**Avantaje:**
✅ O singură agregare pe mtrfindata (cea mai scumpă operație)  
✅ NOT EXISTS devine simple index lookup  
✅ Reutilizabil în alte scenarii

---

### Soluție 3: **Filtrare Materiale la Începutul Procedurii** ⭐⭐⭐⭐

**Concept:** Creează #FilteredMaterials o singură dată

```sql
-- Imediat după crearea #EmitBranches și #DestBranches
CREATE TABLE #FilteredMaterials (mtrl INT PRIMARY KEY, Code VARCHAR(50), Name NVARCHAR(200));

INSERT INTO #FilteredMaterials
SELECT mtrl, Code, Name
FROM mtrl
WHERE sodtype = 51
AND (@materialCodeFilter IS NULL OR (
    (@materialCodeFilterExclude = 0 AND Code LIKE @materialCodeFilter + '%') OR
    (@materialCodeFilterExclude = 1 AND Code NOT LIKE @materialCodeFilter + '%')
));

-- Apoi în toate scenariile:
-- FROM mtrl m
-- Devine:
FROM #FilteredMaterials m
```

**Avantaje:**
✅ Filtrarea se face o singură dată  
✅ Elimină filtrare repetată în WHERE clause  
✅ Reduce materiale procesate dacă filter există

---

### Soluție 4: **TOP N Diagnostics per Scenario** ⭐⭐⭐

**Concept:** Limitează la primele 500 diagnostice per motiv

```sql
-- În fiecare INSERT INTO #Diagnostics, adaugă TOP:
INSERT INTO #Diagnostics (...)
SELECT TOP 500  -- LIMIT per scenario
    m.mtrl,
    ...
```

**Avantaje:**
✅ Previne result sets uriașe  
✅ Utilizatorul primește sample reprezentativ  
✅ Performance predictibil

---

### Soluție 5: **Index pe #Diagnostics** ⭐⭐⭐

**Concept:** Adaugă index pentru NOT EXISTS check

```sql
-- După CREATE TABLE #Diagnostics
CREATE NONCLUSTERED INDEX IX_Diagnostics_MtrlBranch 
ON #Diagnostics(mtrl, branchEmit, branchDest);
```

**Avantaje:**
✅ NOT EXISTS devine index seek  
✅ Reduce O(n²) la O(n log n)

---

### Soluție 6: **Timeout Mai Mare în Request** ⭐⭐

**Concept:** Crește timeout-ul doar pentru debug mode

În `src/app.js`:
```javascript
async getAnalyticsForBranchReplenishment(data, params) {
    const timeout = data.debug ? 300000 : 120000; // 5 min vs 2 min
    
    return request({
        method: "POST",
        uri: "/JS/ReumplereSucursale/getAnalytics",
        body: { ... },
        json: true,
        gzip: true,
        timeout: timeout  // ADD THIS
    });
}
```

**Avantaje:**
✅ Quick fix  
✅ Permite mai mult timp pentru debug

**Dezavantaje:**
⚠️ Nu rezolvă problema fundamentală  
⚠️ Utilizatorul așteaptă mai mult

---

## 🏆 Recomandare Implementare

### **Implementare Prioritate 1 (Must Have):**

1. ✅ **Soluția 2:** Pre-calculează stoc (elimină cel mai costisitor NOT EXISTS)
2. ✅ **Soluția 3:** #FilteredMaterials (aplică filtrare o singură dată)
3. ✅ **Soluția 4:** TOP 1000 per scenario (previne result sets uriașe)
4. ✅ **Soluția 5:** Index pe #Diagnostics

### **Implementare Prioritate 2 (Should Have):**

5. ✅ **Soluția 1:** #RelevantMaterials (limitare hard la materiale active)
6. ✅ **Soluția 6:** Timeout mai mare (safety net)

---

## 📝 Cod Optimizat - Exemplu SCENARIO 1

**ÎNAINTE (problematic):**
```sql
-- SCENARIO 1: No stock in emitting branch
INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchEmit, branchEmitName, details)
SELECT 
    m.mtrl,
    m.Code,
    m.Name,
    'LIPSA_STOC_EMIT',
    eb.branch,
    b.name,
    'Filiala emițătoare ' + CAST(eb.branch AS VARCHAR) + ' (' + b.name + ') nu are stoc pozitiv'
FROM mtrl m
CROSS JOIN #EmitBranches eb
INNER JOIN branch b ON b.branch = eb.branch AND b.company = @company
WHERE m.sodtype = 51
AND (@materialCodeFilter IS NULL OR (...))
AND NOT EXISTS (
    SELECT 1 FROM mtrfindata a
    INNER JOIN whouse w ON w.whouse = a.whouse
    INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = @company
    WHERE a.mtrl = m.mtrl
    AND a.company = @company
    AND a.FISCPRD = @fiscalYear
    AND br.branch = eb.branch
    AND br.isactive = 1
    HAVING SUM(a.qty1) > 0
)
AND NOT EXISTS (SELECT 1 FROM #Diagnostics d WHERE d.mtrl = m.mtrl AND d.branchEmit = eb.branch);
```

**DUPĂ (optimizat):**
```sql
-- SCENARIO 1: No stock in emitting branch
INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchEmit, branchEmitName, details)
SELECT TOP 1000  -- LIMIT
    fm.mtrl,
    fm.Code,
    fm.Name,
    'LIPSA_STOC_EMIT',
    eb.branch,
    b.name,
    'Filiala emițătoare ' + CAST(eb.branch AS VARCHAR) + ' (' + b.name + ') nu are stoc pozitiv'
FROM #FilteredMaterials fm  -- Pre-filtered
CROSS JOIN #EmitBranches eb
INNER JOIN branch b ON b.branch = eb.branch AND b.company = @company
WHERE NOT EXISTS (
    SELECT 1 FROM #MaterialStock ms  -- Pre-calculated
    WHERE ms.mtrl = fm.mtrl
    AND ms.branch = eb.branch
    AND ms.stockQty > 0
)
AND NOT EXISTS (
    SELECT 1 FROM #Diagnostics d 
    WHERE d.mtrl = fm.mtrl AND d.branchEmit = eb.branch
);
```

**Îmbunătățiri:**
- ✅ `#FilteredMaterials` în loc de `mtrl` (filtrare pre-calculată)
- ✅ `#MaterialStock` în loc de subquery complex (stoc pre-calculat)
- ✅ `TOP 1000` limită rezultate
- ✅ Eliminat WHERE clause redundant (deja filtrat)

**Performance gain estimat:** **50x - 100x mai rapid** pentru SCENARIO 1

---

## 🔧 Plan de Implementare

### Faza 1: Quick Wins (1-2 ore)
- [ ] Adaugă `TOP 1000` în toate scenario-urile
- [ ] Adaugă index pe `#Diagnostics`
- [ ] Crește timeout în `app.js` la 300 secunde pentru debug mode

### Faza 2: Optimizări Majore (4-6 ore)
- [ ] Creează `#FilteredMaterials` la început
- [ ] Creează `#MaterialStock` pentru SCENARIO 1
- [ ] Refactor toate scenario-urile să folosească temp tables

### Faza 3: Testing (2-3 ore)
- [ ] Test cu 1 emit × 1 dest
- [ ] Test cu 2 emit × 5 dest
- [ ] Test cu material code filter
- [ ] Test cu setConditionForNecesar/Limits variations

---

## 📊 Rezultate Așteptate După Optimizare

| Scenari | Înainte | După | Îmbunătățire |
|---------|---------|------|--------------|
| 1 emit × 1 dest | 2-5 min | 5-15 sec | **~20x** |
| 2 emit × 3 dest | Timeout | 15-30 sec | **∞ (de la timeout la success)** |
| Cu filter cod | Timeout | 3-8 sec | **~50x** |

---

**Concluzie:** Procedura actuală are probleme fundamentale de performanță cauzate de CROSS JOIN-uri cu tabela `mtrl` și subquery-uri complexe executate pentru fiecare material. Optimizările propuse pot reduce timpul de execuție de la **timeout (>2min)** la **sub 30 secunde** pentru scenarii tipice.

**Acțiune recomandată:** Implementează Faza 1 (quick wins) imediat pentru a face feature-ul utilizabil, apoi Faza 2 pentru performanță optimă.
