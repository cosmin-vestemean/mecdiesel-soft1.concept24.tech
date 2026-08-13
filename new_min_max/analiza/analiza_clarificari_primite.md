# Analiză — Clarificări primite de la beneficiar (Dubhe Romania SRL)

**Data analiză:** 21.07.2026
**Documente sursă:** `Raspuns_Clarificari_MinMax.docx` (răspuns client) + `Spec_ERP_MinMax_v5_FINAL.docx` (specificație finală, înlocuiește versiunile anterioare)
**Document de referință comparat:** `sinteza_cerinte_clarificari.md` (22.06.2026)
**Metodă:** parsing automat al celor două fișiere `.docx` (via `mcp_python-execut_run_python`, extragere XML din `word/document.xml`)

---

## 0. Rezumat executiv

Clientul a răspuns punctual la toate cele 12 observații din sinteza anterioară (5 critice, 3 importante, 4 minore) și a adăugat **2 corecții critice noi**, cu prioritate maximă, la propriul document de analiză precedent (nu la engine):

| Status | Nr. puncte | Puncte |
|---|---|---|
| ✅ REZOLVAT | 3 | C1, C3, M3 |
| 📋 DECIZIE client necesară | 3 | C2, I2, I3 |
| 💬 RĂSPUNS/CLARIFICARE (nu mai necesită acțiune) | 4 | C4, C5, I1, M2 |
| 🔧 DE ALINIAT / OPERAȚIONAL | 2 | M1, M4 |
| 🔴 CORECȚII NOI, prioritate maximă | 2 | C0.1, C0.2 |

**Un singur blocaj real rămâne deschis:** confirmarea listei de filiale active (C2/I3). Restul e rezolvat sau e o decizie minoră de parametru (I2).

---

## 1. Corecții critice noi (nu erau în sinteza inițială)

### C0.1 — Excluderea clientului INTE79 era GREȘITĂ în analiza anterioară

Sinteza noastră (bazată pe prezentarea veche) recomanda excluderea lui `INTE79` ca fiind clientul intern Dubhe S.R.L. (57.285 buc / 7,1M RON). **Este incorect.**

| | Cine e | Acțiune corectă |
|---|---|---|
| `INTE79` | Client **extern real** | **NU se exclude** |
| `C.000003` | Client intern DUBHE S.R.L. (adevăratul cod) | Se exclude |
| `MECDIS` | Client intern | Se exclude |

**Impact:** dacă se păstrează excluderea greșită, engine-ul elimină ~7,2M RON de cerere reală din baza de calcul — afectează direct VZ_*, ABC (valoare) și toate nivelurile MIN/MAX din amonte. Acesta este cel mai important corectiv din tot răspunsul — trebuie propagat imediat în orice implementare/document ERP care a preluat lista veche de excludere.

### C0.2 — Winsorizare p95, pas nou obligatoriu (lipsea complet din documentația anterioară)

```
cap = quantile(Cantitate_SKU, 0.95)     # doar SKU cu ≥ 8 linii
Cantitate = min(Cantitate, cap)          # doar liniile pozitive
```

Se aplică **după excluderi, înainte de calculul ferestrelor VZ**. Nu modifică valoarea netă (ABC rămâne corect). Scop: o comandă unică de proiect (ex. 180 buc la un client) nu trebuie să umfle media (AVG_POND) și deci MAX-ul → stoc mort.

**Legătură cu validarea teoretică (vezi [validare_teoretica_formula.md](validare_teoretica_formula.md), secțiunea L2):** acolo semnalam că $\sigma_D$ e estimat ca proxy (`AVG × 0.30`), nu calculat, ceea ce subestimează variabilitatea pentru cerere sporadică cu outlieri. **Winsorizarea rezolvă parțial exact această lacună** — este o tehnică standard de trimming a outlierilor înainte de estimarea mediei/varianței, folosită frecvent în forecasting de cerere. Recomandare: actualizați secțiunea L2 din documentul de validare teoretică pentru a reflecta acest pas.

> **🔴 Actualizare 13.08.2026 — L2 închisă complet.** Proxy-ul `AVG × 0.30` a fost retras: safety stock-ul se calculează acum pe deviația standard **reală** a vânzărilor săptămânale — `safety = STDEV.S(vânzări_săptămânale[52]) × SSF × sqrt(LT/7)`, cu `SSF = 1.28` flat. Winsorizarea p95 descrisă mai sus devine un **prerechizit** al acestui calcul (σ se calculează pe seria winsorizată), nu doar o mitigare parțială. Vezi [SINTEZA_FINALA.md](SINTEZA_FINALA.md) secțiunile 3.4 și 9.0.

---

## 2. Mapare punct-cu-punct (întrebare → răspuns)

### Critice

| Punct | Întrebarea noastră | Răspuns client | Status |
|---|---|---|---|
| C1 | STANDARD/ON DEMAND inversate în prezentare? | Confirmat: STANDARD = 12.502, ON DEMAND = 33.223. Slide 5 avea numere vechi; logica engine e corectă. | ✅ REZOLVAT |
| C2 | Câte filiale active — 13, 14, sau mai multe? | Nerezolvat — cere confirmare explicită client pe lista din secțiunea 2 a răspunsului. **Blocaj #1.** | 📋 DECIZIE |
| C3 | COV_HQ pentru AX: 2.50 sau 2.75? | 2.75 e valoarea reală de producție. „2.25→2.50" de pe slide 15 era informație veche. | ✅ REZOLVAT |
| C4 | Ce este MIN_DOC? | Cea mai mică cantitate de vânzare a SKU-ului din ultimele 52S (unitate minimă tipică de livrare), default 1. Se calculează din vânzări, nu e parametru ERP separat. | 💬 RĂSPUNS |
| C5 | COV_BR nedefinit — filialele ce coeficienți folosesc? | COV_BR există și se folosește. HQ + filialele mari (București, Galați, Constanța, Timișoara, Cluj) → COV_HQ; restul filialelor → COV_BR (tabel separat, vezi secțiunea 3). | 💬 RĂSPUNS |

### Importante

| Punct | Întrebarea noastră | Răspuns client | Status |
|---|---|---|---|
| I1 | SAPT_VZ + SAPT_FARA = 52 → condiție redundantă? | Nu sunt redundante: SAPT_VZ = frecvență (săpt. distincte cu vânzări), SAPT_FARA = recență (de la ultima vânzare). Un SKU cu vânzări grupate acum 45 săpt. trece SAPT_VZ≥3 dar pică SAPT_FARA≤39. | 💬 CLARIFICARE |
| I2 | CX (2.00) > BY (1.75) — bug sau intenționat? | E valoare de parametru aleasă, nu bug. Necesită confirmare explicită de la client. | 📋 DECIZIE (deschis) |
| I3 | Filialele noi (Voluntari, Mihăilești, Târgoviște, Rm. Vâlcea, Buc. Automotive) intră în calcul? | Identic cu C2 — parte din aceeași decizie de listă filiale. | 📋 DECIZIE |

### Minore

| Punct | Întrebarea noastră | Răspuns client | Status |
|---|---|---|---|
| M1 | Nume engine inconsistent (v5 HYBRID vs fișiere versionate) | Confirmat inconsistent — motorul = „v5 HYBRID", fișierele pot avea sufix de dată. De standardizat pentru ERP. | 🔧 DE ALINIAT |
| M2 | AVG_POND simplificat greșit în email? | Corect semnalat — formula reală normalizează ferestrele (`VZ_13S/3`, `VZ_26S/6`, `VZ_52S/12`). Trebuie să intre exact așa în documentația ERP. | 💬 CORECT (confirmat) |
| M3 | ON DEMAND cu COV_TGT=1.0 — ambiguu? | Ambiguitate de layout în deck-ul vechi. Corect: ON DEMAND → MIN=MAX=0; COV_TGT=1.0 e pentru NOU. | ✅ REZOLVAT |
| M4 | Decalaj date (~3 săptămâni) în runul analizat | Era din rularea veche; rulările curente folosesc date proaspete (AZI = max data vânzări). Cadență săptămânală respectată. | 🔧 OPERAȚIONAL |

---

## 3. Modificări la parametrii de coverage (COV_HQ / COV_BR)

Comparând tabelul din prezentarea veche (`sinteza_cerinte_clarificari.md`) cu tabelul confirmat acum, **valorile COV_HQ s-au schimbat** pentru mai multe clase — nu doar AX (C3):

| Clasă | COV_HQ vechi (prezentare) | COV_HQ nou (confirmat) | Diferență |
|---|---|---|---|
| AX | 2.75 | 2.75 | — |
| AY | 2.25 | 2.50 | ⚠️ schimbat |
| AZ | 1.75 | 2.00 | ⚠️ schimbat |
| BX | — (nedefinit) | 2.50 | nou |
| BY | 1.75 | 2.00 | ⚠️ schimbat |
| BZ | 1.50 | 1.75 | ⚠️ schimbat |
| CX | 2.00 | 2.00 | — |
| CY | 1.50 | 1.50 | — |
| CZ | 0 | 0 | — |
| NOU | 1.00 | 0.75 | ⚠️ schimbat |

**Recomandare:** confirmați cu clientul dacă acesta este într-adevăr tabelul final de producție (pare să fie, conform `Spec_ERP_MinMax_v5_FINAL.docx`) — dacă da, orice document sau implementare care folosește valorile vechi trebuie actualizată.

**Tabel COV_BR (nou, nu exista anterior — rezolvă C5):**

| Clasă | COV_BR |
|---|---|
| AX | 1.25 |
| AY | 1.10 |
| AZ | 0.95 |
| BX | 1.25 |
| BY | 1.00 |
| BZ | 0.50 |
| CX | 0.75 |
| CY | 0.50 |
| CZ | 0 |
| NOU | 0.75 |

---

## 4. Detaliu nou, nesemnalat anterior: ABC calculat per grupă de produs

Specificația finală precizează: *„ABC — cumulativ pe VAL_52S, **ÎN INTERIORUL fiecărei grupe de produs** (nu global)"*. Sinteza inițială nu menționa această granularitate (părea implicit un cumul global pe tot portofoliul). Este o diferență materială de metodologie — un SKU poate fi clasificat A în grupa lui chiar dacă valoarea absolută e mică față de restul portofoliului. Recomandare: confirmați explicit cu clientul definiția exactă a „grupei de produs" (câmpul GRUPA din output) folosită la calculul cumulativului.

---

## 5. Blocaj rămas deschis — Lista de filiale active

Engine-ul calculează exact **13 filiale**. Tabelul din răspunsul clientului arată situația completă:

| Filială | În engine acum | În ERP | Decizie |
|---|---|---|---|
| București, Galați, Constanța, Timișoara, Cluj, Iași, Brașov, Oradea, Pitești, Ploiești, Sibiu, Craiova, Tg. Mureș | DA (13) | prezent | — |
| Arad | NU | prezent | exclus (de confirmat) |
| Voluntari, Mihăilești, Târgoviște, Rm. Vâlcea | NU | nou | exclus (de confirmat) |
| București Automotive | NU | necunoscut | exclus (de confirmat) |
| Bacău | NU | absent | exclus |

Notă corectată: „Alba" din deck-ul vechi era de fapt **Sibiu**.

⚠️ Risc conex: regula „București 30%" presupune că Bucureștiul rămâne cea mai mare filială. Dacă se activează filiale mari noi, regula trebuie revizuită.

**Acesta este singurul blocaj real de prioritate 1** care oprește finalizarea listei de coloane per filială în `minmax_union.xlsx`.

---

## 6. Item deschis — parametru de confirmat (nu blochează)

**I2 / CX > BY:** `CX = 2.00` (clasă C, cerere stabilă) > `BY = 1.75/2.00` (clasă B, cerere medie) în tabelul de coverage. Clientul confirmă că e o valoare de parametru aleasă deliberat, dar cere confirmare finală înainte de a o considera definitivă.

---

## 7. Recomandări / pași următori

1. **Prioritate 1 (blocaj):** obțineți de la client lista finală de filiale active + confirmarea filtrului `INACTIVE` din ERP — fără asta nu se poate finaliza structura de sheet-uri/coloane din output.
2. **Corectați imediat** orice listă de excludere clienți existentă: `INTE79` rămâne în calcul; excludeți `C.000003` + `MECDIS`.
3. **Implementați pasul de winsorizare p95** înainte de calculul ferestrelor VZ (doar SKU cu ≥ 8 linii, doar cantități pozitive).
4. **Actualizați tabelul COV_HQ** cu valorile noi (AY, AZ, BX, BY, BZ, NOU) și adăugați tabelul **COV_BR** pentru filialele mici.
5. **Confirmați cu clientul** definiția exactă a „grupei de produs" pentru calculul ABC per grupă (secțiunea 4) și decizia CX > BY (secțiunea 6).
6. **Tratați `Spec_ERP_MinMax_v5_FINAL.docx` ca sursă unică de adevăr** de acum înainte — documentele `MinMax_ERP_Implementation.md` și `email_body.txt` conțin cifre/tabele depășite (COV_HQ vechi, lista de excludere greșită, fără winsorizare) și nu ar trebui refolosite ca referință tehnică fără a fi marcate ca istoric/context.
7. **Standardizați nomenclatura** (M1): documentație și fișiere de output să folosească consecvent „v5 HYBRID".
