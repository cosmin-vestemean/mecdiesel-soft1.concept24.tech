# MIN/MAX: puncte care necesită decizia dumneavoastră

Data: 16.09.2026. Destinatar: beneficiar. Statut: document de lucru, se trimite după validare internă.

Fiecare punct de mai jos are aceeași structură: ce spune documentația, ce am constatat, ce propunem. Am separat deliberat două situații care nu trebuie confundate:

- **Contradicție** — materialele din septembrie spun altceva decât ce am consemnat noi ca fiind confirmat de dumneavoastră în august. Nu alegem tacit varianta mai recentă.
- **Gol** — specificația nu tratează cazul, iar orice valoare am pune ar fi invenția noastră prezentată ca regulă.

Punctele unde specificația este clară și codul nostru devia nu apar aici: le corectăm noi, fără să vă cerem timp.

Până la răspuns, motorul rămâne pe comportamentul actual, iar raportul fiecărei rulări declară explicit ce valoare a folosit. Nu adoptăm nimic în tăcere.

---

## 1. Coeficientul de siguranță pe clasă *(contradicție)*

**Septembrie, S 5.4**: `safety = z(ABC) × σ × √(LT/7)`, cu `z` = 1,65 pentru A, 1,04 pentru B, 0,67 pentru C. Același document precizează că `SSF = 1,28` rămâne informativ și **nu** se folosește în v5.

**August**: am consemnat `SSF = 1,28 flat`, aplicat tuturor claselor. Așa calculează motorul astăzi.

**Impact**: clasele A primesc cu ~29% mai mult stoc de siguranță în varianta din septembrie, clasele C cu ~48% mai puțin. Diferența se propagă în `ENG_MIN`, `ENG_MAX` și în cantitatea de cumpărat, pentru tot portofoliul.

**Întrebare**: `z` diferențiat pe ABC (1,65 / 1,04 / 0,67) sau `1,28` uniform?

---

## 2. Articole cu cerere perfect constantă *(contradicție)*

**Septembrie, S 7.1 și S 9**: dacă deviația standard este zero, stocul de siguranță este zero. Spus de două ori, explicit.

**August**: am consemnat un prag minim de siguranță — σ ridicat la 1,3 bucăți/săptămână înainte de a intra în formulă. Așa calculează motorul astăzi.

**Precizare de transparență**: valoarea 1,3 nu apare în niciun material primit de la dumneavoastră; provine dintr-o propunere internă. O tratăm ca atare, nu ca pe o confirmare a dumneavoastră.

**Întrebare**: siguranță zero pentru cererea perfect constantă, sau plafon minim? Dacă plafon, cu ce valoare?

---

## 3. Regulile de ambalare *(contradicție + informație lipsă)*

**Septembrie, S 3.9 și S 5.5**: reguli pe familii de produs, aplicate pe MIN și MAX — disc de frână multiplu de 2, bucșă/silentbloc minimum 4, piston/cămașă multiplu de 4 sau 6, injector zero dacă MAX < 3 și minimum 4 altfel.

**August**: am consemnat ambalarea prin câmpul `N_PACK` din fișa articolului, aplicată numai la cantitatea de cumpărat.

**Constatare**: câmpul de ambalare din ERP este **gol pentru toate articolele**. În practică, astăzi, nicio regulă de ambalare nu se aplică.

**Ce lipsește dacă alegem familiile**: alegerea între 4 și 6 la piston/cămașă, sensul rotunjirii, ce se întâmplă când un articol se potrivește la două familii și dacă plafoanele se reverifică după rotunjire.

**Întrebare**: familii de produs pe MIN/MAX, sau `N_PACK` pe cantitatea de cumpărat? În primul caz, avem nevoie de completările de mai sus.

---

## 4. Clasa CZ *(contradicție)*

**Septembrie**: CZ primește acoperire pozitivă (1,50 la HQ și filialele mari, 1,00 la celelalte), deci și cantitate de ciclu. O notă din foaia de parametri spune totuși „C-lent — nu stocăm".

**August**: am consemnat cantitate de ciclu zero pentru CZ, adică stoc limitat strict la nivelul bufferului.

**Întrebare**: CZ se tratează ca orice altă clasă, cu acoperirea din tabel, sau rămâne fără cantitate de ciclu?

---

## 5. Efectul marcajelor Blocat / Exclus / În lichidare *(contradicție internă a materialelor dumneavoastră)*

**Septembrie, S 6**: „În lichidare" anulează cumpărarea; „Blocat" și „Exclus" anulează și MIN, și MAX, și cumpărarea.

**Fișierul de rezultate pe care ni l-ați trimis**: din 48.444 de rânduri cu Blocat sau Exclus activ, **8.377 păstrează MIN sau MAX pozitiv**. Regula literală și rezultatul livrat nu coincid.

**Variante**: marcajele rămân informative; anulează numai la scrierea în ERP; anulează în calcul, conform S 6.

**Întrebare**: care dintre cele trei? Precizați și dacă marcajul se citește din ERP, din fișier extern, sau din oricare dintre ele.

---

## 6. Lista de prefixe de furnizor și valoarea implicită *(informație lipsă)*

**Regula este clară** (S 3.8): se alege cel mai lung prefix care se potrivește codului. Nu o contestăm.

**Ce ne lipsește**: configurația trimisă conține 12 prefixe concrete și o trimitere la „restul listei"; fișierul de rezultate conține 37 plus un rând implicit. Există și neconcordanțe de formă: un prefix cu spațiu final, iar trei furnizori apar sub nume diferite în cele două fișiere.

**Punctul decisiv**: rândul implicit, cel care se aplică oricărui cod nerecunoscut. Documentația scrie termen de livrare 14 zile și frecvență 30. Fișierul dumneavoastră de rezultate conține 30 la termenul de livrare, iar exemplul pe care l-am reconstituit numeric din el se potrivește cu 30, nu cu 14.

**Întrebare**: lista canonică completă, în formă unică, și valoarea implicită — 14 sau 30? Până la răspuns, motorul folosește un fallback tehnic, semnalat ca atare în raportul fiecărei rulări.

---

## 7. Articolele noi sau reactivate *(gol)*

**Septembrie**: clasificarea ABC este definită numai pentru articolele cu istoric complet, dar formula de siguranță cere `z` și nivel de serviciu pe clasă, inclusiv pentru articolele noi. Fișierul de rezultate le atribuie totuși litere A/B/C — 784 de rânduri, distribuite 202 / 233 / 349.

**Astăzi**: motorul le tratează la nivelul B, o valoare aleasă de noi în lipsa unei reguli.

**Riscul**: un articol cu două săptămâni de vânzări mari poate deveni temporar A, deși istoricul nu este reprezentativ.

**Întrebare**: articolele noi primesc politică proprie, litera din istoricul disponibil, sau rămân la nivelul B până acumulează istoric?

---

## 8. Când este o perioadă „cu cerere" *(gol)*

**Regula de compensare este clară**: retururile unui client se scad din vânzările aceluiași client, iar rezultatul nu coboară sub zero.

**Ce nu precizează specificația**: ce se întâmplă când vânzarea și returul cad în perioade diferite. Astăzi compensăm corect volumele pe toată fereastra, dar indicatorul de vechime a cererii compensează numai în interiorul aceleiași săptămâni. Concret: 10 bucăți vândute în ianuarie și returnate în martie corectează volumele, dar săptămâna din ianuarie rămâne marcată drept „săptămână cu cerere".

**Propunerea noastră**: o perioadă contează ca activă numai dacă, după compensare, cererea netă rămâne pozitivă.

**De reținut**: indicatorul intră în criteriile de vechime, deci confirmarea schimbă și încadrarea articolelor între categorii, nu doar o dată afișată.

**Întrebare**: confirmați definiția propusă?

---

## 9. Cantitatea minimă vândută *(clarificare simplă)*

**Septembrie, S 4.6**: pragul „cea mai mică cantitate vândută" este listat între mărimile calculate per articol **și per locație**.

**Astăzi**: îl calculăm o singură dată pe companie și îl aplicăm tuturor filialelor.

**Ce înseamnă diferența**: dacă un articol se livrează în mod obișnuit în cutii de 12, dar undeva în rețea a existat o vânzare izolată de 1 bucată, varianta actuală coboară pragul la 1 în toate filialele.

**Propunerea noastră**: calcul pe filială, conform specificației, fără corecții suplimentare. Dacă doriți o protecție împotriva tranzacțiilor izolate, o proiectăm separat — nu o introducem tacit, fiindcă ar fi o regulă a noastră, nu a dumneavoastră.

**Întrebare**: confirmați calculul pe filială?

---

## 10. Foaia de parametri a primei rulări aliniate

Independent de cele nouă puncte, avem nevoie de **o singură foaie de parametri semnată**, care devine configurația de referință: matricea de acoperire, inclusiv coloana pentru filialele medii, rămasă necompletată; încadrarea fiecărei filiale pe mărime; podeaua Bucureștiului (documentația spune 40%, motorul folosește 30%); nivelurile de serviciu; coeficienții HQ.

Aceasta este oricum cerută de specificație pentru auditul fiecărei rulări. Vă propunem să o tratăm ca livrabil unic, nu ca pe zece confirmări separate.
