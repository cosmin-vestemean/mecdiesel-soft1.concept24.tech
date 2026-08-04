# Deviz Lucrări - Iunie 2026

**Proiect:** MEC Diesel - Sistem de Reumplere Sucursale & Integrare WebShop  
**Perioadă:** 01.06.2026 - 30.06.2026

---

## Lista Livrabile

### 1. Integrare WebShop - API Prețuri & Stocuri
- Serviciu `getPretStocSingleByCode` — returnează prețul și stocul pe sucursale pentru un cod de produs, în funcție de clientul (TRDR) autentificat
- Serviciu `getMinMax` — expunere valori min/max per articol
- Validări complete pe parametrii de intrare (clientID, cod, TRDR) și mesaje de eroare în limba română
- **Estimat: 16 ore**

### 2. Modul Logare Comenzi Online (Backend SoftOne)
- Infrastructură auto-creată pentru log-ul comenzilor online (`ensureOnlineOrdersLogInfrastructure`)
- Endpoint-uri: `setupOnlineOrdersLog`, `logOnlineOrderPayload`, `getOnlineOrdersLog`
- Normalizare și validare payload comenzi, extragere metadate, înregistrare status validare
- Curățare automată log (retenție) și utilizator curent S1 pe fiecare înregistrare
- **Estimat: 14 ore**

### 3. Panou Vizualizare Comenzi Online (Frontend)
- Componentă `online-orders-log-panel` (LitElement) integrată în Feathers
- Căutare, paginare (25/pagină) și filtrare pe dată
- Integrare serviciu `s1` și gestionare token sesiune
- **Estimat: 10 ore**

### 4. Navigare WebShop în Meniul Ierarhic
- Adăugare secțiune WebShop și configurare în `hierarchical-navigation`
- Integrare în `index.html` și fluxul de navigare
- **Estimat: 3 ore**

### 5. Actualizare Modul Zero Min/Max
- Ajustare logică panou și serviciu `zero-minmax`
- Documentație tehnică completă a condițiilor de resetare CCCMINAUTO / CCCMAXAUTO (UI + SQL, procesare normală și batch)
- **Estimat: 5 ore**

### 6. Server MCP - Integrare SoftOne S1 (Tooling)
- Server MCP cu acces la baza de date și schema SoftOne S1
- Tool-uri: autentificare/login/ping/refresh, execuție query T-SQL, listare obiecte / tabele / câmpuri
- Suport configurare prin variabile de mediu
- **Estimat: 9 ore**

---

## Total Estimat

| # | Livrabil | Ore |
|---|----------|-----|
| 1 | API Prețuri & Stocuri WebShop | 16 |
| 2 | Logare Comenzi Online (Backend) | 14 |
| 3 | Panou Comenzi Online (Frontend) | 10 |
| 4 | Navigare WebShop meniu ierarhic | 3 |
| 5 | Actualizare Zero Min/Max + documentație | 5 |
| 6 | Server MCP integrare S1 | 9 |
| | **TOTAL** | **57 ore** |

---

**Observații:** Toate funcționalitățile au fost livrate și integrate în sistemul de producție. Orele reprezintă o estimare a efortului de analiză, dezvoltare, testare și integrare.
