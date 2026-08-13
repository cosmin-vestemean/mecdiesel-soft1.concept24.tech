# Evaluare — TimesFM și TabFm în contextul MIN/MAX Engine v5 HYBRID

**Data:** 21.07.2026
**Scop:** evaluarea aplicabilității a două modele foundation Google Research — **TimesFM** (forecasting serii de timp) și **TabFM** (date tabelare) — pentru engine-ul MIN/MAX descris în [Spec_ERP_MinMax_v5_FINAL.docx](Spec_ERP_MinMax_v5_FINAL.docx) și [analiza_clarificari_primite.md](analiza_clarificari_primite.md).
**Metodă:** research pe documentația oficială (Google Research blog + repo-uri GitHub `google-research/timesfm` și `google-research/tabfm`), mapare pe cerințele concrete ale proiectului.

---

## 0. Concluzie pe scurt

| | Recomandare |
|---|---|
| **TimesFM** | Nu ca înlocuitor de producție al formulei AVG_POND/safety stock acum. Util ca **benchmark paralel** pentru validarea preciziei de forecast pe SKU STANDARD clasa A/Z. ⚠️ *Actualizare 13.08.2026: motivația secundară — rafinarea proxy-ului $\sigma_D$ (gap L2) — a devenit caducă, σ se calculează acum real din vânzările săptămânale.* |
| **TabFM** | Cel mai promițător caz de utilizare: **estimarea cererii inițiale pentru SKU NOU/REACTIVAT** (cold-start), prin regresie zero-shot pe atribute + SKU-uri similare, ca alternativă la proxy-ul simplist `AVG = VZ_13S/3`. Nu e potrivit pentru ABC/XYZ (deja deterministe, nu au nevoie de ML). |

Ambele sunt **experimente de tip POC (proof of concept)**, în afara scope-ului actual de implementare ERP — nu blochează și nu înlocuiesc decizia de prioritate 1 (lista de filiale, vezi [analiza_clarificari_primite.md](analiza_clarificari_primite.md)).

---

## 1. TimesFM — ce este

- Model foundation **decoder-only** pentru forecasting de serii de timp, dezvoltat de Google Research (ICML 2024, [arXiv:2310.10688](https://arxiv.org/abs/2310.10688)).
- Antrenat pe ~100 miliarde de puncte temporale reale (Google Trends, Wikipedia pageviews etc.) + date sintetice.
- **Zero-shot**: nu necesită antrenare/fine-tuning pe seria țintă — primește contextul istoric și generează forecast direct.
- Versiune curentă: **TimesFM 2.5** (200M parametri, context până la 16k puncte, suportă forecast pe cuantile continue până la orizont 1000, suportă covariate/regresori externi via XReg din oct. 2025).
- Output: `point_forecast` + `quantile_forecast` (mediană + cuantile 10–90%) — relevant direct pentru estimarea nivelului de siguranță al stocului.
- Licență Apache-2.0, disponibil pe GitHub/HuggingFace, integrat și în BigQuery ML, Google Sheets, Vertex Model Garden.

## 2. Aplicabilitate TimesFM în acest proiect

### Unde s-ar potrivi
Singura zonă relevantă e calculul `AVG_POND` + `safety` pentru SKU **STANDARD** (12.502 SKU, ~27%). TimesFM ar putea:
- Genera direct un forecast punctual pe orizont scurt (ex. 4-8 săptămâni), ca alternativă/validare la media ponderată `VZ_4S×0.30 + (VZ_13S/3)×0.40 + ...`.
- Genera **cuantile** (ex. 90%/95%) direct din model. ⚠️ *Actualizare 13.08.2026:* acest argument și-a pierdut forța — gap-ul **L2** din [validare_teoretica_formula.md](validare_teoretica_formula.md#5-lacune-față-de-teoria-completă) e închis, `safety` folosește deja deviația standard empirică `STDEV.S(vânzări_săptămânale[52])`. Cuantilele modelului ar aduce cel mult o estimare **prospectivă** a variabilității (vs. cea istorică de acum), nu înlocuirea unui proxy.

### Constrângeri concrete pentru acest proiect
1. **Acoperire limitată** — modelul ar aduce valoare doar pentru cele 12.502 SKU STANDARD (× 14 locații ≈ 175.000 serii săptămânale). Cele 33.223 SKU ON DEMAND (72%) rămân MIN=MAX=0, nu beneficiază de forecast.
2. **Volum/latență** — inferența pe ~175k serii săptămânal e un salt operațional față de calculul actual (~80s în Python). Necesită infrastructură dedicată (serviciu Python + PyTorch/JAX, eventual GPU) — nu se integrează "gratis" într-un job SQL/ERP clasic.
3. **Transparență & audit** — cerința explicită din specificație este: *"Toți parametrii citiți din tabel configurabil — nimic hardcodat"* (secțiunea 5, cerințe tehnice). Un model neural de 200M parametri e opac — greu de justificat în fața unui audit ERP clasic (SAP/Dynamics/Oracle), spre deosebire de formula actuală, care e complet auditabilă și mapată 1:1 pe literatura academică (vezi validarea teoretică existentă).
4. **Context istoric disponibil** — proiectul are minim 52 puncte săptămânale per SKU, mult sub capacitatea maximă a modelului (16k), dar suficient pentru zero-shot forecasting (modelul e conceput să funcționeze bine și cu context scurt).
5. **Nu adresează gap L1** (variabilitatea lead time-ului furnizorului) — TimesFM prezice cererea, nu lead time-ul; ar necesita un forecast separat pe seriile de livrare furnizor dacă se dorește și asta.

### Recomandare
**Nu îl introduc în calculul de producție acum.** Recomand un POC izolat: rulare TimesFM zero-shot pe seriile istorice ale SKU-urilor clasa **AZ/BZ/CZ** (cele mai volatile) și comparare MAE față de `AVG_POND` curent, pe fereastra de validare paralelă deja planificată în spec (secțiunea 5 — "rulare paralelă Python vs ERP, 1-2 săptămâni"). Dacă TimesFM reduce eroarea semnificativ pe clasele volatile, poate deveni un input suplimentar (nu înlocuitor) pentru `AVG_POND`.

---

## 3. TabFM — ce este

- Model foundation Google Research pentru **date tabelare** (clasificare + regresie), lansat 30.06.2026 ([blog](https://research.google/blog/introducing-tabfm-a-zero-shot-foundation-model-for-tabular-data/)).
- Bazat pe **in-context learning (ICL)**: primește întregul tabel (rânduri de antrenare cu etichetă cunoscută + rândurile țintă) ca un singur context, fără fine-tuning sau hyperparameter tuning.
- Arhitectură hibridă: atenție alternantă rând/coloană (similar TabPFN) + compresie de rând + transformer ICL peste vectorii comprimați (similar TabICL) — permite scalare la seturi de date mai mari.
- Antrenat exclusiv pe **date sintetice** generate prin modele cauzale structurale (SCM) — generalizează bine la tabele reale nevăzute, conform benchmark-urilor TabArena (38 seturi clasificare, 13 regresie).
- Se integrează în BigQuery via `AI.PREDICT`.

## 4. Aplicabilitate TabFM în acest proiect

### Cel mai bun caz de utilizare: cold-start pentru SKU NOU/REACTIVAT
Azi, clasa **NOU/REACTIVAT** (~123 SKU) folosește un proxy simplist: `AVG = VZ_13S/3` (media ultimelor 13 săptămâni împărțită la 3 luni) — fără nicio informație despre produs în sine. TabFM ar putea:
- Primi ca "context" (exemple de antrenare) SKU-urile STANDARD existente, cu atribute (GRUPA, FURNIZOR, COST_MED_RON, PREFIX, clasă ABC-XYZ istorică) + cererea lor reală (VAL_52S sau AVG_POND).
- Face **regresie zero-shot** pentru a estima cererea așteptată a unui SKU nou pe baza similarității cu SKU-uri comparabile din aceeași grupă/furnizor — un cold-start informat, în loc de un proxy generic pe 13 săptămâni.
- Similar, ar putea ajuta la o primă estimare pentru SKU-uri aflate la limita ON DEMAND / NOU (graniță SAPT_8S ≥ 2).

### Alt caz posibil (secundar): predicție/prioritizare a divergențelor FLAG
Coloana `FLAG` (raport ENG_MAX/ERP_MAX) ar putea fi modelată ca task de clasificare (OK / ENG>ERP / ENG<ERP / divergență majoră) pe baza atributelor SKU, pentru a prioritiza SKU-urile de verificat manual în etapa de validare paralelă — dar aceasta e o comoditate, nu o necesitate (FLAG-ul se calculează deja direct din formulă).

### Ce NU se pretează la TabFM
Clasificarea **ABC-XYZ** este deja un algoritm determinist, simplu (cumulativ pe valoare + coeficient de variație), validat ca fiind conform 100% cu literatura (vezi [validare_teoretica_formula.md](validare_teoretica_formula.md#34-clasificare-abc-xyz)). Nu are sens să fie înlocuit cu un model ML — ar adăuga opacitate fără beneficiu, pentru un calcul care e deja optim și auditabil.

### Constrângeri
1. Modelul e antrenat **exclusiv pe date sintetice** (SCM) — performanța pe domeniul specific (piese auto, distribuție B2B) nu e garantată din benchmark-urile publice (TabArena); ar trebui validată empiric pe un eșantion real înainte de orice decizie.
2. Necesită aceeași infrastructură de inferență (serviciu Python separat de ERP), cu aceleași probleme de auditabilitate ca la TimesFM.
3. Volumul (123 SKU NOU) e mic — beneficiul, deși util calitativ, are impact limitat cantitativ pe total (45.848 SKU).

### Recomandare
POC limitat, offline: comparare `AVG = VZ_13S/3` (proxy curent) vs. predicție TabFM pe un eșantion de SKU-uri STANDARD "mascate" ca fiind noi (ascundem istoricul lor și lăsăm TabFM să prezică cererea din atribute + context), verificând MAE față de cererea reală cunoscută. Dacă rezultatul e semnificativ mai bun, se poate propune ca îmbunătățire punctuală pentru clasa NOU, fără să afecteze restul formulei v5 HYBRID.

---

## 5. Sinteză riscuri comune (ambele modele)

| Risc | Detaliu |
|---|---|
| **Auditabilitate** | Contrastează cu cerința explicită "nimic hardcodat, tot parametrizabil" — un model black-box nu poate fi "citit" dintr-un tabel de parametri de un auditor ERP. |
| **Infrastructură nouă** | Ambele necesită un serviciu de inferență separat (Python + PyTorch/JAX/HuggingFace), în afara stack-ului SQL/ERP clasic descris în spec. |
| **Overhead operațional** | Adaugă o dependință externă (Google Research repo, actualizări de model) peste un sistem gândit ca fiind complet intern/configurabil. |
| **Validare pe domeniu specific** | Niciunul dintre modele nu a fost testat public pe date de tip "distribuție piese auto B2B" — orice adopție necesită backtesting intern înainte de a fi luată în considerare, chiar și ca instrument auxiliar. |
| **Scop actual al proiectului** | Prioritatea 1 rămâne confirmarea listei de filiale active (blocaj real, vezi [analiza_clarificari_primite.md](analiza_clarificari_primite.md#5-blocaj-rămas-deschis--lista-de-filiale-active)) — introducerea de modele ML ar fi prematură înainte de stabilizarea specificației de bază.

**Concluzie generală:** ambele modele sunt interesante ca instrumente de *validare/benchmark* și pentru cazul punctual de cold-start (TabFM → NOU), dar nu se justifică înlocuirea formulei v5 HYBRID — care e deja conformă cu standardele academice și ERP enterprise (SAP, Dynamics, Oracle) — cu modele foundation opace, într-un proiect al cărui obiectiv explicit e un engine transparent, parametrizabil și auditabil.
