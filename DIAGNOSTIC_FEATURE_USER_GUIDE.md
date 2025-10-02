# 🐛 Diagnostic Feature - Ghid Rapid

## Ce Face Această Funcționalitate?

Când bifezi **"Mod Debug"** în Branch Replenishment, vei vedea **de ce** anumite materiale NU apar în rezultate.

## 📋 Cum Se Folosește

### Pas 1: Activează Mod Debug

1. Deschide tab **"Branch Replenishment"**
2. În Query Panel, găsește checkbox-ul: **🐞 Mod Debug (Diagnostic materiale excluse)**
3. **Bifează** checkbox-ul

### Pas 2: Încarcă Date

1. Selectează sucursale (ex: Source = BUCURESTI, Destination = GALATI)
2. Click **"Încarcă Date"**
3. Așteaptă 15-30 secunde (mai mult decât normal)

### Pas 3: Vezi Diagnosticele

După încărcare, vei vedea un **banner galben**:

```
⚠️ Diagnostic: 150 materiale au fost excluse din rezultate.
[🔍 Afișează Diagnostic] [X]
```

### Pas 4: Deschide Modal-ul

1. Click pe butonul **"Afișează Diagnostic"**
2. Se deschide un tabel cu toate materialele excluse
3. Fiecare material are:
   - **Cod** și **Denumire**
   - **Motiv** (cu badge colorat)
   - **Sucursale** (emițătoare și destinație)
   - **Detalii** explicative

### Pas 5: Export (Opțional)

1. Click butonul **"Export CSV"**
2. Se descarcă fișier Excel cu toate diagnosticele
3. Caractere românești (ă, â, î, ș, ț) apar corect

## 🎨 Coduri Culoare Motive

| Badge | Motiv | Semnificație |
|-------|-------|--------------|
| 🔴 Roșu | Lipsă Stoc Emitere | Material nu are stoc în sucursala emițătoare |
| 🟡 Galben | Fără Limite Emitere | Nu există limite configurate în MTRBRNLIMITS pentru sucursala emițătoare |
| 🟡 Galben | Fără Limite Destinație | Nu există limite configurate în MTRBRNLIMITS pentru sucursala destinație |
| 🔴 Roșu | Filială Inactivă | Sucursala destinație este inactivă în sistem |
| 🔵 Albastru | Limite Zero | Sucursala destinație are limite = 0 |
| ⚪ Gri | Necesar Zero | Necesarul calculat este 0 sau negativ |

## ❓ Întrebări Frecvente

### De ce durează mai mult cu Mod Debug activat?

Sistemul execută o interogare suplimentară în baza de date pentru a analiza toate materialele excluse. Acest lucru este normal.

### Pot folosi aplicația fără Mod Debug?

Da! Mod Debug este **opțional**. Dacă îl lași nebifat, aplicația funcționează normal (mai rapid).

### Câte materiale pot fi excluse?

De obicei între 100-1000 materiale. Modalul limitează la primele 1000 diagnostice per motiv pentru performanță.

### Ce înseamnă "Fără limite configurate"?

Materialul nu are înregistrare în tabelul MTRBRNLIMITS pentru acea sucursală. Trebuie configurate limite min/max pentru ca materialul să apară în rezultate.

### Cum rezolv problemele identificate?

- **Lipsă stoc:** Transferă stoc în sucursala emițătoare
- **Fără limite:** Configurează limite în MTRBRNLIMITS
- **Filială inactivă:** Activează sucursala în sistemul branch/whouse
- **Necesar zero:** Verifică stocul actual și limitele configurate

## 🚨 Troubleshooting

### Banner-ul nu apare

**Verifică:**
1. Checkbox-ul Mod Debug este **bifat**?
2. Datele s-au încărcat cu succes (fără eroare)?
3. Există materiale excluse? (poate toate apar în rezultate)

**Test în Console (F12):**
```javascript
replenishmentStore.getState().debugMode  // Trebuie true
replenishmentStore.getDiagnostics()      // Trebuie array cu obiecte
```

### Primesc eroare "Timeout"

Acest lucru se întâmplă dacă:
- Prea multe materiale în sistem
- SQL procedure nu este optimizată

**Soluție:** Contactează administratorul pentru a deploy versiunea optimizată a procedurii SQL.

### Modal-ul nu se deschide

**Test manual:**
```javascript
// În Browser Console (F12)
const modal = document.querySelector('diagnostic-modal');
modal.show([{Cod: 'TEST', Denumire: 'Test', Motiv: 'LIPSA_STOC_EMIT', FilEmit: '01', NumeFilEmit: 'Test', FilDest: '02', NumeFilDest: 'Test', Detalii: 'Test'}]);
```

Dacă modalul se deschide cu testul dar nu cu datele reale, problema este în date.

## 💡 Tips & Tricks

### Tip 1: Filtrare Rapidă

Folosește filtrul de cod material **împreună cu** Mod Debug pentru a vedea diagnostic doar pentru anumite materiale.

### Tip 2: Export pentru Rapoarte

Exportul CSV poate fi deschis în Excel pentru:
- Filtrare avansată
- Pivot tables
- Grafice
- Rapoarte pentru management

### Tip 3: Comparație Sucursale

Rulează diagnostic pentru **diferite combinații** de sucursale pentru a vedea unde lipsesc configurări.

Exemplu:
- BUCURESTI → GALATI
- BUCURESTI → CLUJ
- etc.

Compară CSV-urile pentru a identifica materiale care lipsesc universal vs. local.

## 📊 Exemple Uzuale

### Exemplu 1: Material Nou Adăugat

**Situație:** Material nou în sistem, nu apare în Branch Replenishment

**Diagnostic:** 
```
Cod: MAT12345
Motiv: Fără Limite Destinație
Detalii: Filiala destinatară 1400 (GALATI) nu are limite configurate în MTRBRNLIMITS
```

**Soluție:** Configurează limite pentru material în toate sucursalele relevante.

### Exemplu 2: Stoc Blocat

**Situație:** Material există în depozit dar nu apare pentru transfer

**Diagnostic:**
```
Cod: MAT67890
Motiv: Necesar Zero
Detalii: Filiala destinatară 1400 (GALATI) are necesar = 0 și setConditionForNecesar = 1
```

**Soluție:** Verifică stocul actual în GALATI - poate că este deja peste limita maximă configurată.

### Exemplu 3: Sucursală Nouă

**Situație:** Deschis sucursală nouă, nu apar materiale pentru reumplere

**Diagnostic:**
```
Cod: MAT11111, MAT22222, MAT33333, ... (1000+)
Motiv: Fără Limite Destinație
Detalii: Filiala destinatară 2900 (RAMNICU VALCEA) nu are limite configurate...
```

**Soluție:** Import masiv limite în MTRBRNLIMITS pentru noua sucursală.

---

## 📞 Contact Support

Pentru probleme tehnice sau întrebări:
- Verifică **DIAGNOSTIC_FEATURE_TROUBLESHOOTING.md** pentru debugging detaliat
- Contactează echipa IT cu screenshot-uri din Browser Console (F12)

---

**Versiune:** 1.0  
**Ultima actualizare:** 1 Octombrie 2025  
**Status:** ✅ FUNCȚIONAL (după deployment SQL optimized)
