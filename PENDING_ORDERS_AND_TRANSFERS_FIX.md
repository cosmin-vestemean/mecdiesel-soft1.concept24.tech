# Fix: Pending Orders and Unreceived Transfers Logic

## Data: 7 Octombrie 2025

## Problema Identificată

### Context
În modulul "Reumplere sucursale", când se face un transfer din București către Cluj (document 3130), apoi la următoarea interogare:
- **Dacă se interogau TOATE sucursalele** → transferul era luat în calcul corect ✓
- **Dacă se interoga DOAR o sucursală** (ex: Constanța) → transferul NU era luat în calcul ✗

### Cauza Principală
Existau două probleme distincte legate de fluxul de transfer al mărfurilor:

#### 1. Comenzi Pending (3130)
Comenzile pending filtrau după sucursalele **destinație** în loc de **sursă**:
```sql
-- ÎNAINTE (GREȘIT):
AND B.BRANCHSEC IN (SELECT branch FROM #DestBranches)
```

**Problema**: O comandă pending București→Cluj era luată în calcul doar dacă Cluj era în filtrul de destinație, dar ar trebui să reducă disponibilul din București **indiferent** de destinație.

#### 2. Transferuri în Drum (3153, whousesec=9999)
Transferurile în drum (marfa în camion) **NU erau scăzute** din disponibilul sursei.

**Problema**: Când un transfer trece din 3130 (pending) în 3153 (în drum):
- Marfa **a plecat deja** din București (nu mai este în stoc)
- Dar disponibilul București **nu era actualizat** să reflecte acest lucru
- Transferul era scăzut din necesar Cluj (corect), dar NU din disponibil București (greșit)

## Soluția Implementată

### 1. Fix pentru Comenzi Pending (3130)
Schimbat filtrul să verifice sucursala **sursă** în loc de destinație:

```sql
-- DUPĂ (CORECT):
AND C.BRANCH IN (SELECT branch FROM #EmitBranches)
```

**Rezultat**: Toate comenzile pending care pleacă din sucursalele emitente sunt luate în calcul și scad din disponibilul sursei, **indiferent de destinație**.

### 2. Fix pentru Transferuri în Drum (3153)

#### 2a. Extins filtrul pentru a include transferuri din sucursale emitente
```sql
-- ÎNAINTE:
AND B.BRANCHSEC IN (SELECT branch FROM #DestBranches)

-- DUPĂ:
AND (A.BRANCH IN (SELECT branch FROM #EmitBranches) 
     OR B.BRANCHSEC IN (SELECT branch FROM #DestBranches))
```

**Explicație**: Acum includem:
- Transferuri **către** sucursalele din interogare (pentru calculul necesarului destinație)
- Transferuri **din** sucursalele emitente (pentru calculul disponibilului sursă)

#### 2b. Adăugat join nou `ut_emit`
Similar cu `po_emit` pentru comenzile pending, am adăugat `ut_emit` pentru transferurile în drum:

```sql
LEFT JOIN (
    SELECT mtrl, branchFrom, SUM(qty) AS qty
    FROM #UnreceivedTransfers
    GROUP BY mtrl, branchFrom
) ut_emit ON (ut_emit.mtrl = dm.mtrl AND ut_emit.branchFrom = dm.branchE)
```

#### 2c. Actualizat calculul disponibilului
Ambele coloane `disp_min_emit` și `disp_max_emit` acum scad **ATÂT** comenzile pending **CÂT ȘI** transferurile în drum:

```sql
-- ÎNAINTE:
ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(dm.MinE, 0)

-- DUPĂ:
ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0)
```

## Logica Corectă Finală

### Fluxul unui Transfer București → Cluj

1. **Stare inițială**: Material în stoc București
   - `stoc_emit` = 100 buc
   - `disp_min_emit` = 100 - MinLimit

2. **Creare comandă 3130** (București → Cluj):
   - Comandă pending = 20 buc
   - `disp_min_emit` = 100 - 20 - MinLimit (✓ scade din disponibil)
   - `nec_min` Cluj = scade cu 20 buc (✓ reduce necesarul)

3. **Transfer executat → 3153** (în drum către Cluj):
   - Comandă pending = 0 buc (nu mai e pending)
   - Transfer în drum = 20 buc
   - `disp_min_emit` = 100 - 20 - MinLimit (✓ scade din disponibil - marfa a plecat!)
   - `nec_min` Cluj = scade cu 20 buc (✓ reduce necesarul - marfa vine!)

4. **Recepție în Cluj**:
   - Transfer în drum = 0 buc (completat)
   - `stoc_dest` Cluj = crește cu 20 buc
   - `disp_min_emit` București = 100 - MinLimit (✓ revine la normal)

## Scenarii de Test

### Scenario 1: București → Cluj, apoi interogare București → Toate
- ✓ Transfer 3130 sau 3153 către Cluj este inclus
- ✓ Se scade din disponibil București

### Scenario 2: București → Cluj, apoi interogare București → Constanța (doar)
- ✓ Transfer 3130 către Cluj este inclus (filtrat după sursă)
- ✓ Transfer 3153 către Cluj este inclus (filtrat după sursă)
- ✓ Se scade din disponibil București
- ✗ NU se scade din necesar Constanța (corect, transferul e către Cluj, nu Constanța)

### Scenario 3: București → Cluj (în drum), interogare Pitești → Cluj
- ✓ Transfer 3153 București→Cluj este inclus (filtrat după destinație)
- ✓ Se scade din necesar Cluj (marfa vine în camion)
- ✗ NU se scade din disponibil Pitești (corect, transferul pleacă din București)

## Modificări în Fișiere

### `sp_GetMtrlsDat.sql`
1. **Linia 56**: Filtru `#PendingOrders` - schimbat de la `#DestBranches` la `#EmitBranches`
2. **Linia 95**: Filtru `#UnreceivedTransfers` - extins cu OR logic pentru ambele direcții
3. **Liniile 326-331**: Calcul `disp_min_emit` și `disp_max_emit` - adăugat scădere `ut_emit`
4. **După linia 432**: Adăugat join nou `ut_emit` pentru agregarea transferurilor din sursa emitentă

### `sp_GetMtrlsDiagnostics.sql` (Actualizat pentru consistență)
1. **După linia 98**: Adăugate tabele temporare `#PendingOrders` și `#UnreceivedTransfers` (același calcul ca în `sp_GetMtrlsData`)
2. **După linia 125**: Adăugate UPDATE-uri pentru `PendingQty` și `TransferQty` în `#BranchLimits`
3. **Linia 130-136**: Actualizat calculul necesității pentru a include comenzi pending și transferuri în drum:
   - **Înainte**: `MinNecessity = MinLimit - StockQty`
   - **După**: `MinNecessity = MinLimit - StockQty - PendingQty - TransferQty`
4. **Final**: Adăugat cleanup pentru tabelele noi `#PendingOrders` și `#UnreceivedTransfers`

**Motivație**: Procedura de diagnostics trebuie să folosească aceeași logică de calcul a necesității ca și procedura principală pentru a identifica corect materialele excluse. Fără acest fix, diagnostics-ul ar putea raporta incorect "NECESAR_ZERO_DEST" pentru materiale care au necesar acoperit de comenzi pending sau transferuri în drum.

## Impact

### Înainte de Fix
- Disponibilul sucursalei sursă era **incorect calculat** când:
  - Exista comenzi pending către alte sucursale
  - Existau transferuri în drum către alte sucursale
- Acest lucru ducea la:
  - **Supraestimare** a disponibilului
  - Risc de transfer mai mult decât este disponibil efectiv

### După Fix
- Disponibilul sucursalei sursă este **corect calculat**:
  - Se scad toate comenzile pending emise din sucursală (indiferent de destinație)
  - Se scad toate transferurile în drum din sucursală (indiferent de destinație)
- Necesarul destinației este **corect calculat**:
  - Se scad comenzile pending primite
  - Se scad transferurile în drum care vin

## Clarificare: Nu există Redundanță în Calcule

### Întrebarea legitimă
Ar putea părea redundant să scădem atât comenzile pending cât și transferurile în drum din disponibilul sursei:
```sql
disp_min_emit = Stoc - po_emit.qty - ut_emit.qty - MinLimit
```

### De ce NU este redundanță?

Filtrele SQL asigură că aceleași documente **NU** apar în ambele tabele temporare:

#### Tabela `#PendingOrders` (3130)
```sql
WHERE 
    c.FPRMS = 3130          -- Tip document: Comandă de transfer
    AND a.pending = 1       -- CRUCIAL: doar documente cu pending=1
```

#### Tabela `#UnreceivedTransfers` (3153)
```sql
WHERE 
    A.FPRMS = 3153          -- Tip document: Transfer în drum
    AND B.WHOUSESEC = 9999  -- Marfa în camion (depozit temporar)
```

### Fluxul în ERP - Tranziția 3130 → 3153

Când un document 3130 este executat și devine 3153:
1. **În documentul 3130**: `pending` trece de la `1` la `0`
2. **Se creează documentul 3153**: cu `whousesec=9999`

### Situații Exclusive (nu se suprapun)

| Stare Document | În #PendingOrders? | În #UnreceivedTransfers? | Scăzut prin |
|---------------|-------------------|-------------------------|-------------|
| **3130 cu pending=1** | ✓ DA | ✗ NU (FPRMS≠3153) | `po_emit` |
| **3130 cu pending=0** | ✗ NU | ✗ NU (FPRMS≠3153) | - |
| **3153 în drum** | ✗ NU (FPRMS≠3130) | ✓ DA | `ut_emit` |
| **3153 recepționat** | ✗ NU | ✗ NU (FULLYTRANSF=1) | - |

### Exemplu Concret: București → Cluj (20 buc)

#### Momentul 1: Creare comandă 3130
- Document: `3130`, `pending=1`, București→Cluj, 20 buc
- `#PendingOrders`: **20 buc** ✓
- `#UnreceivedTransfers`: **0 buc** (nu e 3153)
- `disp_min_emit` București: `Stoc - 20 - MinLimit` ✓

#### Momentul 2: Execuție transfer → 3153
- Document 3130: `pending=0` (modificat)
- Document 3153 nou: `whousesec=9999`, București→Cluj, 20 buc
- `#PendingOrders`: **0 buc** (pending=0) ✗
- `#UnreceivedTransfers`: **20 buc** ✓
- `disp_min_emit` București: `Stoc - 20 - MinLimit` ✓

#### Momentul 3: Recepție în Cluj
- Document 3153: `FULLYTRANSF=1` (completat)
- `#PendingOrders`: **0 buc**
- `#UnreceivedTransfers`: **0 buc** (FULLYTRANSF=1)
- `disp_min_emit` București: `Stoc - MinLimit` ✓

### Concluzie: Logica este Corectă

- **NU** există dubla scădere pentru același document
- Filtrele `FPRMS` și `pending` asigură **excludere mutuală**
- Logica acoperă **toate stările** unui transfer:
  1. Rezervat (3130 pending=1) → scade prin `po_emit`
  2. În drum (3153) → scade prin `ut_emit`
  3. Recepționat → nu mai scade (revine disponibilul)

## Concluzie Finală

Fix-ul asigură că:
1. **Rezervările (3130 pending=1)** reduc disponibilul sursei imediat ce sunt create
2. **Transferurile în drum (3153)** reduc disponibilul sursei (marfa a plecat) și necesarul destinației (marfa vine)
3. **NU există redundanță** - filtrele SQL asigură că fiecare document este numărat o singură dată
4. Logica funcționează **consistent** indiferent de filtrele aplicate la interogare
