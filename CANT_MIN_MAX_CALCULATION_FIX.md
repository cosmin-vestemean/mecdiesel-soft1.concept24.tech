# Fix: Calcul Corect cant_min și cant_max

## Data: 13 Octombrie 2025

## Problema Raportată de Client

### Context
Material **MEC 170501** rezervat în comanda de transfer **3130-0000001**:
- ✅ `disp_min_emit` = 0 (corect)
- ✅ `disp_max_emit` = 0 (corect)
- ❌ `cant_min` > 0 (GREȘIT!)
- ❌ `cant_max` > 0 (GREȘIT!)

### Impact
Când clientul aplică strategia "Apply Max Quantity", sistemul trimite un transfer **chiar dacă disponibilul real este 0**, ceea ce eșuează în ERP.

### Citatul Clientului
> "Daca Disponibil =0 nu am cum sa am cantitate pozitiva pe aceste doua campuri. Ar fi trebuit sa apara "0"
> Pentru ca am cantitate pozitiva pe CantMin si CantMax, atunci cand aloc strategia "Apply Max Quantitys", imi duce valoare in campul Transf si imi trimite in Soft1 comanda de transfer..
> 
> CONCLUZIE: Trebuie recalculate corect campurile CantMin si CantMax, in baza DispoMin si DispoMax"

## Cauza Problemei

În `sp_GetMtrlsData`, calculul pentru `cant_min` și `cant_max` (liniile 355-391) folosea:

```sql
-- ÎNAINTE (GREȘIT):
CASE 
    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(dm.MinE, 0)) <= 0 
    THEN 0 
    ...
END AS cant_min
```

### De ce era greșit?
Formula **NU** includea scăderea:
- `po_emit` (comenzi pending din sucursala emitentă)
- `ut_emit` (transferuri în drum din sucursala emitentă)

Deci chiar dacă `disp_min_emit` era calculat corect (incluzând pending și transferuri), `cant_min` și `cant_max` **ignorau** aceste rezervări.

## Soluția Aplicată

### Formula Corectă
```sql
-- DUPĂ (CORECT):
CASE 
    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0)) <= 0 
    THEN 0 
    WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0)) - ISNULL(bl_dest.MinNecessity, 0) < 0 
    THEN (ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0))
    ELSE 
        CASE 
            WHEN (ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0)) > 
                ISNULL(bl_dest.MinNecessity, 0)
            THEN 
                CASE 
                    WHEN ISNULL(bl_dest.MinNecessity, 0) > 0 
                    THEN ISNULL(bl_dest.MinNecessity, 0)
                    ELSE 0 
                END
            ELSE (ISNULL(dm.cantitateE, 0) - ISNULL(po_emit.qty, 0) - ISNULL(ut_emit.qty, 0) - ISNULL(dm.MinE, 0))
        END
END AS cant_min
```

### Logica Simplificată
```
disponibil_real = stoc - pending_orders - transferuri_in_drum - limita

cant_min = MIN(disponibil_real, necesar_destinatie)

DACĂ disponibil_real <= 0 ATUNCI cant_min = 0
```

## Exemplu Concret: Material MEC 170501

### Date Inițiale
- **Stoc București**: 100 buc
- **Limită minimă**: 20 buc
- **Limită maximă**: 40 buc
- **Comandă pending 3130-0000001**: 80 buc (București → Cluj)
- **Necesar Cluj**: 50 buc

### Calcul ÎNAINTE (GREȘIT):

| Câmp | Calcul | Rezultat |
|------|--------|----------|
| `disp_min_emit` | 100 - 80 - 20 | **0** ✅ |
| `disp_max_emit` | 100 - 80 - 40 | **-20 → 0** ✅ |
| `cant_min` | MIN(100 - 20, 50) | **50** ❌ GREȘIT! |
| `cant_max` | MIN(100 - 40, 50) | **50** ❌ GREȘIT! |

**Problema**: `cant_min` și `cant_max` ignorau comanda pending de 80 buc!

### Calcul DUPĂ (CORECT):

| Câmp | Calcul | Rezultat |
|------|--------|----------|
| `disp_min_emit` | 100 - 80 - 20 | **0** ✅ |
| `disp_max_emit` | 100 - 80 - 40 | **-20 → 0** ✅ |
| `cant_min` | MIN(100 - 80 - 20, 50) = MIN(0, 50) | **0** ✅ |
| `cant_max` | MIN(100 - 80 - 40, 50) = MIN(-20, 50) | **0** ✅ |

**Fix**: `cant_min` și `cant_max` acum includ comanda pending!

## Modificări în Fișiere

### `sp_GetMtrlsData` (Liniile 355-391)

**Modificări:**
1. Actualizat calculul `cant_min` pentru a include `po_emit.qty` și `ut_emit.qty`
2. Actualizat calculul `cant_max` pentru a include `po_emit.qty` și `ut_emit.qty`

**Formula generală:**
```
disponibil = stoc - po_emit - ut_emit - limit
cant = MIN(disponibil, necesar)
DACĂ disponibil <= 0 ATUNCI cant = 0
```

### `sp_GetMtrlsDiagnostics`

**NU necesită modificări** - procedura de diagnostics nu calculează `cant_min` sau `cant_max`.

## Scenarii de Test

### Scenario 1: Material Complet Rezervat
**Input:**
- Stoc: 100 buc
- Pending: 80 buc
- MinLimit: 20 buc
- Necesar: 50 buc

**Output:**
- `disp_min_emit` = 0 ✅
- `cant_min` = 0 ✅
- **Rezultat**: NU trimite transfer (corect!)

### Scenario 2: Material Parțial Disponibil
**Input:**
- Stoc: 100 buc
- Pending: 50 buc
- MinLimit: 20 buc
- Necesar: 50 buc

**Output:**
- `disp_min_emit` = 30 ✅
- `cant_min` = 30 ✅ (MIN(30, 50))
- **Rezultat**: Trimite doar 30 buc (corect!)

### Scenario 3: Material Complet Disponibil
**Input:**
- Stoc: 100 buc
- Pending: 0 buc
- MinLimit: 20 buc
- Necesar: 50 buc

**Output:**
- `disp_min_emit` = 80 ✅
- `cant_min` = 50 ✅ (MIN(80, 50))
- **Rezultat**: Trimite 50 buc (corect!)

### Scenario 4: Transfer în Drum
**Input:**
- Stoc: 100 buc
- Pending: 0 buc
- Transfer în drum: 30 buc
- MinLimit: 20 buc
- Necesar: 50 buc

**Output:**
- `disp_min_emit` = 50 ✅
- `cant_min` = 50 ✅ (MIN(50, 50))
- **Rezultat**: Trimite 50 buc (corect!)

## Impact

### Înainte de Fix ❌
- `cant_min` și `cant_max` puteau fi > 0 chiar dacă `disp_min_emit` = 0
- Strategia "Apply Max Quantity" trimitea transferuri **incorecte**
- Risc de **erori în ERP** (transfer mai mult decât disponibil)

### După Fix ✅
- `cant_min` și `cant_max` sunt **întotdeauna <= disponibil real**
- Strategia "Apply Max Quantity" trimite **doar** ce este efectiv disponibil
- **Consistență completă** între toate câmpurile calculate
- **NU** mai există risc de transfer incorect

## Relația cu Fix-urile Anterioare

Acest fix este **complementar** cu fix-urile anterioare:

### Fix #1: Pending Orders și Unreceived Transfers
- **Scopul**: Calculul corect al `disp_min_emit` și `disp_max_emit`
- **Efectul**: Disponibilul afișat este corect

### Fix #2: Calcul cant_min și cant_max (ACEST FIX)
- **Scopul**: Folosirea disponibilului real în calculul cantităților de transfer
- **Efectul**: Cantitățile de transfer sunt corecte și consistente cu disponibilul

### Împreună
```
Fix #1: disp_min_emit = stoc - pending - transferuri - limit ✅
Fix #2: cant_min = MIN(disp_min_emit, necesar) ✅
Rezultat: Sistem complet consistent și corect! 🎯
```

## Concluzie

Fix-ul asigură că:
1. ✅ `cant_min` și `cant_max` nu pot fi niciodată > disponibilul real
2. ✅ Strategia "Apply Max Quantity" funcționează corect
3. ✅ NU mai există risc de transfer incorect în ERP
4. ✅ Toate câmpurile calculate sunt **perfect consistente**

Formula finală corectă:
```
disponibil_real = stoc - comenzi_pending - transferuri_in_drum - limita
cantitate_transfer = MIN(disponibil_real, necesar_destinatie)
DACĂ disponibil_real <= 0 ATUNCI cantitate_transfer = 0
```

---

**Fix verificat și funcțional pe:** 13 Octombrie 2025
**Testat cu:** Material MEC 170501, Comandă 3130-0000001
