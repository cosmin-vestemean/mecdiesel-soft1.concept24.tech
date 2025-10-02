# Analiză Business: INNER JOIN cu MTRBRNLIMITS

**Data Analiză:** 1 Octombrie 2025  
**Context:** Procedură sp_GetMtrlsData - Branch Replenishment  
**Focalizare:** Necesitatea INNER JOIN vs LEFT JOIN cu tabelul MTRBRNLIMITS

---

## 📋 Executive Summary

### Situația Actuală:
În procedura `sp_GetMtrlsData`, există un **INNER JOIN** cu tabelul `MTRBRNLIMITS` la linia 402:

```sql
INNER JOIN MTRBRNLIMITS ml ON (
    ml.mtrl = dm.mtrl 
    AND ml.branch = br.branch 
    AND ml.company = br.company 
    AND ml.company = @company
)
```

### Problema Identificată:
**INNER JOIN elimină materialele care nu au înregistrări în MTRBRNLIMITS**, chiar dacă acele materiale:
- Au stoc disponibil în sucursala emițătoare
- Ar putea fi transferate
- Sunt active și valide din punct de vedere business

### Impact Business:
**CRITIC** - Această relație restrictivă contrazice logica business fundamentală a reumplerii între sucursale.

---

## 🔍 Analiza Detaliată

### 1. Scopul Business al MTRBRNLIMITS

Tabelul `MTRBRNLIMITS` conține:
- **RemainLimMin / cccminauto**: Limite minime de stoc pe sucursală
- **RemainLimMax / cccmaxauto**: Limite maxime de stoc pe sucursală  
- **cccisblacklisted**: Indicator dacă materialul este blocat pentru sucursală

**Scop Business:**
- Configurare limite de siguranță pentru stoc
- Calcul necesități de reumplere
- Control asupra blacklist-ului per material-sucursală

### 2. Locurile Unde MTRBRNLIMITS Este Folosit

#### 2.1 În #BranchLimits (Temp Table - Liniile 128-137)

```sql
INSERT INTO #BranchLimits (mtrl, branch, MinLimit, MaxLimit)
SELECT 
    mtrl, 
    branch,
    CASE WHEN ISNULL(RemainLimMin, 0) > ISNULL(cccminauto, 0) 
         THEN ISNULL(RemainLimMin, 0) 
         ELSE ISNULL(cccminauto, 0) END AS MinLimit,
    CASE WHEN ISNULL(RemainLimMax, 0) > ISNULL(cccmaxauto, 0) 
         THEN ISNULL(RemainLimMax, 0) 
         ELSE ISNULL(cccmaxauto, 0) END AS MaxLimit
FROM MTRBRNLIMITS 
WHERE company = @company;
```

**Observație:** Temp table `#BranchLimits` este populat DOAR cu materiale care au limite configurate.

#### 2.2 În CTE pentru Stoc Emițător (Liniile 258-283)

```sql
FROM mtrfindata a
INNER JOIN whouse b ON (b.whouse = a.whouse)
INNER JOIN branch c ON (...)
INNER JOIN mtrl d ON (d.mtrl = a.mtrl)
INNER JOIN #BranchLimits bl ON (a.mtrl = bl.mtrl AND c.branch = bl.branch)  -- AICI!
WHERE 
    a.company = @company
    AND a.FISCPRD = @fiscalYear
    AND d.sodtype = 51
    AND c.branch IN (SELECT branch FROM #EmitBranches)
GROUP BY c.BRANCH, a.MTRL, bl.MaxLimit, bl.MinLimit
HAVING SUM(a.qty1) > 0
```

**Impact:** Materialele fără limite în sucursala emițătoare sunt excluse din CTE.

#### 2.3 În Final SELECT pentru Blacklist (Liniile 400-407)

```sql
INNER JOIN MTRBRNLIMITS ml ON (
    ml.mtrl = dm.mtrl 
    AND ml.branch = br.branch 
    AND ml.company = br.company 
    AND ml.company = @company
)
```

**Scop aparent:** Verificare `cccisblacklisted` pentru afișare în coloana "Blacklisted":

```sql
CASE WHEN ml.cccisblacklisted IS NULL THEN '-' 
     ELSE CASE WHEN ml.cccisblacklisted = 0 THEN 'Nu' ELSE 'Da' END 
END Blacklisted,
```

---

## 🎯 Impactul Business al INNER JOIN

### Scenarii Problematice

#### Scenariu 1: Material Nou în Sistem
**Situație:**
- Material nou achiziționat, adăugat în sistemul ERP
- Stoc disponibil în Depozit Central (sucursala 01)
- Încă nu au fost configurate limite în MTRBRNLIMITS pentru toate sucursalele

**Rezultat cu INNER JOIN:**
- ❌ Materialul NU apare deloc în rezultate
- ❌ Utilizatorul nu știe că există stoc disponibil
- ❌ Oportunitate de transfer pierdută

**Impact Business:**
- Stoc blocat inutil în depozit
- Sucursale pot rămâne fără stoc necesar
- Lipsă vizibilitate pentru planificare

#### Scenariu 2: Sucursală Nouă / Reorganizare
**Situație:**
- Se deschide o nouă sucursală sau punct de lucru
- Stoc existent în depozit central pentru toate materialele
- Limitele nu au fost încă configurate în MTRBRNLIMITS

**Rezultat cu INNER JOIN:**
- ❌ ZERO materiale apar pentru noua sucursală
- ❌ Imposibil de planificat reumplerea inițială
- ❌ Echipa trebuie să configureze manual mii de limite înainte de primul transfer

**Impact Business:**
- Delay în operarea noii sucursale
- Risc de ruptură de stoc la debut
- Overhead administrativ masiv

#### Scenariu 3: Categorii de Materiale Neconfigurate
**Situație:**
- Anumite categorii de materiale (ex: consumabile birou) nu au limite stricte
- Policy business: "Se transferă la cerere, nu e necesar minim/maxim"
- Stoc disponibil, materiale valide, dar fără limite în MTRBRNLIMITS

**Rezultat cu INNER JOIN:**
- ❌ Materialele nu apar în analiză
- ❌ Imposibil de transferat prin sistemul de reumplere
- ❌ Utilizatorii trebuie să creeze transferuri manuale ad-hoc

**Impact Business:**
- Pierdere beneficii sistem automatizat
- Creștere workload manual
- Inconsistență în procesul de reumplere

#### Scenariu 4: Eroare de Configurare / Ștergere Accidentală
**Situație:**
- Administrator șterge accidental o înregistrare din MTRBRNLIMITS
- Sau face update masiv care omite anumite combinații material-sucursală

**Rezultat cu INNER JOIN:**
- ❌ Materialele afectate dispar instant din sistem
- ❌ Utilizatorii nu înțeleg de ce stocul disponibil nu apare
- ❌ Debugging dificil (lipsă eroare explicită)

**Impact Business:**
- Ruptură de continuitate operațională
- Timp pierdut pentru investigare
- Posibile comenzi duplicate din lipsă vizibilitate

---

## 📊 Analiza Logicii Business Actuale

### Fluxul Actual de Filtrare

```
1. Materiale din mtrfindata (stoc real)
   ↓
2. INNER JOIN cu #BranchLimits (doar cele cu limite configurate)
   ↓
3. CTE pentru stoc emițător (doar stoc > 0 ȘI limite există)
   ↓
4. CROSS JOIN cu sucursale destinație
   ↓
5. INNER JOIN cu MTRBRNLIMITS (a doua verificare - elimină materialele fără limite în dest)
   ↓
6. Filtre @setConditionForLimits și @setConditionForNecesar
   ↓
REZULTAT FINAL: Doar materiale cu limite configurate în TOATE sucursalele implicate
```

### Problemele Identificate

#### Problema 1: **Filtru Duplicat și Restrictiv**

INNER JOIN cu MTRBRNLIMITS la final (linia 402) este **redundant** deoarece:

1. Temp table `#BranchLimits` deja conține doar materiale din MTRBRNLIMITS
2. CTE-ul pentru emițător deja face JOIN cu `#BranchLimits`
3. Se face JOIN cu `bl_dest` (din `#BranchLimits`) pentru destinație

**Concluzie:** A treia verificare cu MTRBRNLIMITS nu adaugă filtru suplimentar semnificativ, doar **îngreunează logica**.

#### Problema 2: **Scopul Real Este Doar Blacklist**

Analizând SELECT-ul final, singurul motiv pentru INNER JOIN cu MTRBRNLIMITS este:

```sql
CASE WHEN ml.cccisblacklisted IS NULL THEN '-' 
     ELSE CASE WHEN ml.cccisblacklisted = 0 THEN 'Nu' ELSE 'Da' END 
END Blacklisted,
```

**Această coloană de afișare NU justifică eliminarea materialelor din rezultate!**

Soluție corectă business:
- LEFT JOIN pentru a obține blacklist status
- Dacă lipsește înregistrare → afișează "Neconfigurat" sau "N/A"
- Materialul rămâne în rezultate pentru decizie utilizator

#### Problema 3: **Parametrul @setConditionForLimits Este Inutil**

La linia 429:
```sql
WHERE (@setConditionForLimits = 0 OR (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0))
```

**Logica actuală:**
- Dacă `@setConditionForLimits = 1` → filtrează doar materiale cu limite > 0
- Dacă `@setConditionForLimits = 0` → include toate materialele

**Problema:** 
Datorită INNER JOIN cu MTRBRNLIMITS mai sus, chiar dacă setezi `@setConditionForLimits = 0`, tot nu primești materiale fără limite, pentru că ele sunt deja eliminate de INNER JOIN!

**Concluzie:** Parametrul este o "iluzie" de flexibilitate - nu funcționează conform intenției.

---

## 🔧 Analiza Câmpurilor Necesare din MTRBRNLIMITS

### Câmpuri Folosite în Query:

1. **ml.cccisblacklisted** (linia 334)
   - Scop: Afișare status blacklist
   - Necesitate business: **Informativ, nu restrictiv**
   - Soluție: LEFT JOIN suficient

2. **Limite (MinLimit, MaxLimit)** - Via `#BranchLimits`
   - Scop: Calcul necesități reumplere
   - Necesitate business: **Optional pentru afișare**
   - Soluție: LEFT JOIN + valori default (0 sau NULL)

### Câmpuri NEUTILIZATE Direct:

- `ml.mtrl`, `ml.branch`, `ml.company` - folosite doar pentru JOIN condition
- Niciun alt câmp din MTRBRNLIMITS nu este selectat direct

**Concluzie:** Nu există dependency business care să justifice INNER JOIN. Toate valorile pot fi obținute prin LEFT JOIN cu handling explicit pentru NULL.

---

## 💡 Propuneri de Soluție

### Soluția 1: **LEFT JOIN + Handling Explicit** (Recomandat ⭐⭐⭐⭐⭐)

**Modificări necesare:**

#### 1.1 Schimbă INNER JOIN în LEFT JOIN (linia 402)

```sql
-- ÎNAINTE:
INNER JOIN MTRBRNLIMITS ml ON (
    ml.mtrl = dm.mtrl 
    AND ml.branch = br.branch 
    AND ml.company = br.company 
    AND ml.company = @company
)

-- DUPĂ:
LEFT JOIN MTRBRNLIMITS ml ON (
    ml.mtrl = dm.mtrl 
    AND ml.branch = br.branch 
    AND ml.company = br.company 
    AND ml.company = @company
)
```

#### 1.2 Adaptează SELECT pentru NULL handling

```sql
-- Blacklisted (cu tratare NULL explicit)
CASE 
    WHEN ml.cccisblacklisted IS NULL THEN 'Neconfigurat'
    WHEN ml.cccisblacklisted = 0 THEN 'Nu' 
    ELSE 'Da' 
END Blacklisted,
```

#### 1.3 Păstrează filtrul @setConditionForLimits funcțional

Filtrul de la linia 429 va funcționa corect după modificare:

```sql
WHERE (@setConditionForLimits = 0 OR (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0))
```

Acum:
- Cu `@setConditionForLimits = 1` → doar materiale cu limite configurate
- Cu `@setConditionForLimits = 0` → **toate materialele**, inclusiv cele fără limite

### Avantaje Soluția 1:

✅ **Flexibilitate maximă:** Utilizatorul vede tot stocul disponibil  
✅ **Compatibilitate:** Menține logica existentă de calcul  
✅ **Transparență:** Materialele neconfigure apar explicit ca "Neconfigurat"  
✅ **Minimal invasive:** O singură modificare (INNER → LEFT)  
✅ **Backward compatible:** Filtrele existente continuă să funcționeze

### Dezavantaje Soluția 1:

⚠️ Rezultate mai mari (mai multe rânduri în output)  
⚠️ Utilizatorii pot vedea materiale fără limite configurate  
⚠️ Necesită documentare pentru interpretare coloană "Blacklisted = Neconfigurat"

---

### Soluția 2: **Parametru Nou @requireLimitsConfig** (Moderat ⭐⭐⭐)

**Concept:** Adaugă parametru explicit pentru control business policy.

```sql
CREATE OR ALTER PROCEDURE sp_GetMtrlsData
    @branchesEmit VARCHAR(100),
    @branchesDest VARCHAR(100),
    @company INT = 1000,
    @setConditionForNecesar BIT = 1,
    @setConditionForLimits BIT = 1,
    @requireLimitsConfig BIT = 0,  -- NOU: 0=permite materiale fără limite, 1=elimină
    @fiscalYear INT = NULL,
    @materialCodeFilter VARCHAR(100) = NULL,
    @materialCodeFilterExclude BIT = 0
AS
BEGIN
    -- ...

    -- În final SELECT:
    LEFT JOIN MTRBRNLIMITS ml ON (...)  -- Schimbat în LEFT JOIN
    
    WHERE 
        (@requireLimitsConfig = 0 OR ml.mtrl IS NOT NULL)  -- Filtru explicit pe existență înregistrare
        AND (@setConditionForLimits = 0 OR (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0))
        AND (...)
END
```

### Avantaje Soluția 2:

✅ Control explicit și transparent  
✅ Backward compatible (default = 0 permite toate)  
✅ Documentare clară a policy-ului business  
✅ Ușor de testat ambele scenarii

### Dezavantaje Soluția 2:

⚠️ Modificare semnătură procedură (breaking change pentru client code)  
⚠️ Mai multă complexitate în parametrii  
⚠️ Necesită update în frontend și AJS layer

---

### Soluția 3: **Eliminare INNER JOIN + Adăugare în Diagnostic** (Pragmatic ⭐⭐⭐⭐)

**Concept:** Materiale fără limite apar în rezultate + diagnostic separat pentru lipsă configurare.

#### 3.1 Modifică sp_GetMtrlsData

```sql
LEFT JOIN MTRBRNLIMITS ml ON (
    ml.mtrl = dm.mtrl 
    AND ml.branch = br.branch 
    AND ml.company = br.company
)

-- În SELECT:
CASE 
    WHEN ml.mtrl IS NULL THEN 'Neconfigurat (Lipsă limite)'
    WHEN ml.cccisblacklisted IS NULL THEN '-'
    WHEN ml.cccisblacklisted = 0 THEN 'Nu' 
    ELSE 'Da' 
END Blacklisted,
```

#### 3.2 Actualizează sp_GetMtrlsDiagnostics

Adaugă scenariu nou (SCENARIO 7 - deși ai exclus FILTRU_COD_MATERIAL, acesta e diferit):

```sql
-- ========================================
-- SCENARIO 7: No MTRBRNLIMITS configuration
-- ========================================
INSERT INTO #Diagnostics (mtrl, materialCode, materialName, reason, branchDest, branchDestName, details)
SELECT 
    m.mtrl,
    m.Code,
    m.Name,
    'CONFIG_LIPSA_DEST',
    db.branch,
    b.name,
    'Material are stoc disponibil dar nu există configurare limite în MTRBRNLIMITS pentru sucursala ' + 
    CAST(db.branch AS VARCHAR) + ' (' + b.name + '). ' +
    'Adăugați înregistrare în MTRBRNLIMITS pentru a calcula necesități automat.'
FROM mtrl m
CROSS JOIN #DestBranches db
INNER JOIN branch b ON b.branch = db.branch AND b.company = @company
WHERE m.sodtype = 51
AND (@materialCodeFilter IS NULL OR (
    (@materialCodeFilterExclude = 0 AND m.Code LIKE @materialCodeFilter + '%') OR
    (@materialCodeFilterExclude = 1 AND m.Code NOT LIKE @materialCodeFilter + '%')
))
AND EXISTS (
    -- Material has stock in emitting branch
    SELECT 1 
    FROM mtrfindata a
    INNER JOIN whouse w ON w.whouse = a.whouse
    INNER JOIN branch br ON br.branch = w.cccbranch AND br.company = @company
    WHERE a.mtrl = m.mtrl
    AND a.company = @company
    AND a.FISCPRD = @fiscalYear
    AND br.branch IN (SELECT branch FROM #EmitBranches)
    AND br.isactive = 1
    HAVING SUM(a.qty1) > 0
)
AND NOT EXISTS (
    -- No limits configured for destination branch
    SELECT 1 FROM MTRBRNLIMITS lim
    WHERE lim.mtrl = m.mtrl
    AND lim.branch = db.branch
    AND lim.company = @company
);
```

### Avantaje Soluția 3:

✅ **Best of both worlds:** Materiale apar în rezultate + notificare utilizator  
✅ **Actionable insights:** Utilizatorul știe ce trebuie configurat  
✅ **Suport pentru debug mode:** Folosește feature-ul diagnostic recent implementat  
✅ **Minimizează surprizele:** Transparent pentru utilizator de ce lipsesc calcule

### Dezavantaje Soluția 3:

⚠️ Coloane nec_min / nec_max vor fi 0 sau NULL pentru materiale neconfigurate  
⚠️ Utilizatorul trebuie să înțeleagă că "Neconfigurat" înseamnă "Lipsă calcul necesități"  
⚠️ Mai multe rânduri în diagnostic (dar asta e scopul lui!)

---

## 🎯 Recomandare Finală

### **Recomandare Primară: Soluția 3 (LEFT JOIN + Diagnostic)**

**Motivație:**

1. **Aliniată cu business logic:** Reumplerea între sucursale nu ar trebui blocată de lipsă configurare limite
2. **Leverages recent work:** Folosește feature-ul diagnostic implementat recent
3. **Transparency over restriction:** Utilizatorul vede tot stocul, primește warning dacă ceva lipsește
4. **Gradual adoption:** Companii pot configura limite progresiv, sistemul funcționează între timp
5. **Minimizează support requests:** Erori de configurare devin vizibile instant în diagnostic

### Pași de Implementare:

1. ✅ **Modifică sp_GetMtrlsData:**
   - Schimbă INNER JOIN în LEFT JOIN la linia 402
   - Actualizează CASE pentru Blacklisted (linia 334)

2. ✅ **Actualizează sp_GetMtrlsDiagnostics:**
   - Adaugă SCENARIO 7: CONFIG_LIPSA_DEST
   - Include în help section din diagnostic-modal.js

3. ✅ **Update diagnostic-modal.js:**
   - Adaugă label pentru 'CONFIG_LIPSA_DEST'
   - Badge color: bg-warning (similar cu LIMITE_INEXISTENTE)
   - Help text: "Material disponibil dar fără configurare limite în MTRBRNLIMITS"

4. ✅ **Test scenarios:**
   - Material cu limite configurate (business as usual)
   - Material fără limite în destinație (apare cu warning)
   - Material fără limite în emițător (apare în diagnostic)
   - Combinații mixte (unele sucursale configurate, altele nu)

5. ✅ **Documentație:**
   - Update README cu explicație LEFT JOIN vs INNER JOIN
   - User guide pentru interpretare "Neconfigurat" în coloana Blacklisted
   - Admin guide pentru configurare MTRBRNLIMITS

---

## 📈 Impact Business Așteptat

### Îmbunătățiri Immediate:

✅ **Vizibilitate completă:** 100% din stocul disponibil apare în rezultate  
✅ **Flexibilitate operațională:** Transferuri posibile chiar fără limite configurate  
✅ **Reducere timp configurare:** Nu mai e necesar să configurezi toate limitele înaintea utilizării sistemului  
✅ **Self-service diagnostics:** Utilizatorii identifică singuri ce trebuie configurat

### Beneficii pe Termen Lung:

✅ **Adoption rate crescut:** Sisteme noi pot fi activate rapid, configurare poate fi graduală  
✅ **Reducere support tickets:** Lipsă configurare devine evidentă prin UI, nu necesită investigație IT  
✅ **Better data quality:** Warning-urile din diagnostic motivează configurare corectă  
✅ **Scalabilitate:** Onboarding sucursale noi devine trivial

### Potențiale Riscuri (Mitigare):

⚠️ **Risc:** Utilizatori transferă materiale fără a verifica limite  
🛡️ **Mitigare:** Warning visible în UI + Diagnostic Mode activat default  

⚠️ **Risc:** Rezultate prea mari, performance issues  
🛡️ **Mitigare:** Index-urile existente pe #BranchLimits rămân eficiente; LEFT JOIN are impact minim  

⚠️ **Risc:** Confuzie utilizatori cu "Neconfigurat"  
🛡️ **Mitigare:** Tooltip explicit + Help section în diagnostic modal  

---

## 📊 Comparație Soluții

| Criteriu | Soluția 1 (LEFT JOIN) | Soluția 2 (Parametru Nou) | Soluția 3 (LEFT + Diagnostic) |
|----------|----------------------|---------------------------|------------------------------|
| **Flexibilitate Business** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Backward Compatibility** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Transparență pentru User** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Effort Implementare** | ⭐⭐⭐⭐⭐ (minimal) | ⭐⭐⭐ (mediu) | ⭐⭐⭐⭐ (moderat) |
| **Testabilitate** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Risc Regresie** | ⭐⭐⭐⭐ (scăzut) | ⭐⭐⭐ (mediu) | ⭐⭐⭐⭐ (scăzut) |
| **Suport pentru Debug** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Future-proof** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Câștigător:** 🏆 **Soluția 3 - LEFT JOIN + Diagnostic**

---

## 🔍 Concluzie Analiză Business

### Verdict:

**INNER JOIN cu MTRBRNLIMITS este un ANTI-PATTERN business** în contextul actual, deoarece:

1. ❌ **Restrictivitate nejustificată:** Elimină materiale valide din rezultate
2. ❌ **Scop îndoielnic:** Singurul câmp folosit (blacklist) poate fi obținut prin LEFT JOIN
3. ❌ **Conflictă cu parametri:** Face @setConditionForLimits inutil
4. ❌ **Blocare operațională:** Previne transferuri chiar când stoc este disponibil
5. ❌ **Complexitate fără beneficiu:** Adaugă dependency fără valoare business

### Acțiune Recomandată:

**🎯 Implementează Soluția 3 (LEFT JOIN + Diagnostic Scenario 7)**

**Timeline sugerată:**
- [ ] **Ziua 1:** Modifică INNER JOIN → LEFT JOIN în sp_GetMtrlsData
- [ ] **Ziua 1:** Update SELECT pentru handling NULL (Blacklisted column)
- [ ] **Ziua 2:** Adaugă SCENARIO 7 în sp_GetMtrlsDiagnostics
- [ ] **Ziua 2:** Update diagnostic-modal.js cu label și badge pentru CONFIG_LIPSA_DEST
- [ ] **Ziua 3:** Testing comprehensiv (4 scenarii principale)
- [ ] **Ziua 3:** Update documentație utilizatori și admin

**Estimated effort:** 2-3 zile dezvoltare + testare  
**Risk level:** 🟢 LOW (backward compatible, non-breaking change)  
**Business impact:** 🟢 HIGH (unlock blocked functionality, improve visibility)

---

## 📞 Întrebări de Follow-up

Pentru a finaliza implementarea, ar fi util să clarificăm:

1. **Policy Business:**
   - Este permis transferul de materiale fără limite configurate?
   - Sau ar trebui să fie blocat transferul dar materialul să apară în rezultate?

2. **UI/UX:**
   - Preferință pentru afișare "Neconfigurat" vs "N/A" vs "-" în coloana Blacklisted?
   - Ar trebui să fie o coloană separată pentru "Status Configurare"?

3. **Data Quality:**
   - Câte materiale active există FĂRĂ limite configurate în prezent?
   - Câte sucursale au configurări incomplete în MTRBRNLIMITS?

4. **Migration Path:**
   - Există un plan pentru configurare retroactivă a limitelor?
   - Sau politica business acceptă operare fără limite pentru anumite categorii?

---

**Document creat:** 1 Octombrie 2025  
**Autor:** Copilot Analysis  
**Versiune:** 1.0  
**Status:** ✅ DRAFT PENTRU REVIEW
