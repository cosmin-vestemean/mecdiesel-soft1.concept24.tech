# Deviz Lucrări - Noiembrie & Decembrie 2025

**Proiect:** MEC Diesel - Sistem de Reumplere Sucursale  
**Perioadă:** 01.11.2025 - 31.12.2025

---

## Lista Livrabile

### 1. Modul Procesare Batch (Move Items Online / Stock Evidence)
- Sistem persistent de procesare batch pentru operațiuni în masă
- Upload și parsare fișiere Excel cu coduri produse
- Coadă de procesare persistentă (rezistentă la refresh browser)
- Tracking progres în timp real
- Funcționalitate Cancel/Retry pentru operațiuni eșuate
- Export rezultate în Excel
- Logging dedicat și istoric operațiuni (6 luni retenție)
- Integrare backend Feathers + SoftOne ERP

### 2. Îmbunătățiri Modul Reumplere Sucursale
- Componentă StrategyBar pentru selecție și aplicare strategii de reumplere
- Opțiune nouă în filtru ABC: clasificare "AB" (doar clase A și B)
- Filtru stoc destinație cu suport pentru interval de valori (range)
- Panoul de filtre nu se mai ascunde automat (decizia rămâne la utilizator)

### 3. Refactorizare și Optimizări UI/UX
- Refactorizare completă stiluri CSS pentru consistență vizuală
- Variabile CSS pentru culori, spațiere și tipografie
- Îmbunătățiri design componente (query-panel, manipulation-panel, data-table)

### 4. Infrastructură
- Integrare submodul extern MEC pentru management dependințe
- Serviciu backend batch-queue cu metodele: create, find, get, patch, cancel, retry, summary

---

**Observații:** Toate funcționalitățile au fost livrate și integrate în sistemul de producție.
