---
applyTo: "**"
---

# Model Policy

## Principiu

- Obiectivul este modelul *potrivit* pentru sarcină, nu cel mai ieftin. Optim = capacitate suficientă la context minim necesar.
- Modelul NU se schimbă singur în timpul sesiunii. Această policy face agentul „aware": el semnalează când modelul activ nu se potrivește; comutarea efectivă o faci tu din model picker sau prin invocarea unui prompt/agent cu `model:` în frontmatter.

## Maparea sarcină → model

- Planificare / arhitectură / decizii ireversibile → **Opus** (raționament adânc, context mic-mediu).
- Implementare multi-fișier / refactor pe mai multe module → **Sonnet** (debit + competență agentică susținută).
- Task izolat / boilerplate / edit mecanic / rename / scaffold → **model de bază sau completions**.
- Validare / review output / verificare diff → **Opus, context mic** (sesiune nouă focalizată, NU sesiunea lungă de implementare).

## Garda generală (se evaluează la începutul fiecărei sarcini)

- Clasifică tipul sarcinii și compară cu modelul activ. Dacă diferă, semnalează scurt: „Sarcină <tip> → recomand <model>".
- Salt în sus (spre Opus): propune comutarea și așteaptă confirmarea înainte de muncă scumpă.
- Coborâre (boilerplate/mecanic): propune comutarea spre model de bază, dar nu bloca execuția.
- Nu rămâne pe Opus pentru execuție mecanică; nu face arhitectură/decizii ireversibile pe model de bază.

## Garda de context (sesiune lungă)

- Lungimea sesiunii este un semnal în sine: contextul devine zgomotos, iar costul și latența cresc neliniar. Tratează lungimea, nu doar conținutul.
- Prag de igienă: când sesiunea a acoperit mai multe sub-obiective sau a depășit o fază de lucru, propune `session-handoff` (snapshot) + sesiune nouă, în loc să continui pe context umflat.
- Pentru review/validare pornește o sesiune nouă pe Opus context mic; nu reutiliza sesiunea de implementare (evită „forgetting yourself on Opus").
- Dacă suprafața de context a crescut din abstracții sau fire deschise inutile, propune `session-compress` înainte de a continua.

## Plan mode

- Când produci un plan de execuție (todo list), adnotează fiecare pas cu modelul recomandat, ex: `- [ ] Refactor modul X (model: Claude Sonnet 4.6)`.
- Lista de planificare devine sursa de adevăr pentru comutările de model în faza de execuție; garda generală o folosește ca să-ți reamintească comutarea la fiecare pas.
