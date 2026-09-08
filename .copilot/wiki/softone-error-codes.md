# Coduri de eroare SoftOne WS (platformă) — nu se reinventează

> Referință durabilă, nu documentație de fază. Sursa canonică rămâne
> [softone.gr/ws/#errorcodes](https://www.softone.gr/ws/#errorcodes) — acest fișier explică unde
> trăiește deja codul care le gestionează în acest repo și cum se reutilizează.

## Un singur helper, doi consumatori

Tabelul de coduri există o singură dată, în
[`public/shared/softone-error-codes.js`](../../public/shared/softone-error-codes.js) — ESM pur, fără
`window`/`document` sau API-uri specifice Node, ca să poată fi importat de ambele părți:

- **Browser** (`public/components/*.js`), cale relativă normală, ex.
  `import { isSoftOneErrorRetryable } from '../shared/softone-error-codes.js'`.
- **Backend** (`src/services/**/*.js`), printr-o cale relativă de filesystem care urcă până la
  rădăcina repo-ului, ex. `import { isSoftOneErrorRetryable } from '../../../public/shared/softone-error-codes.js'`.
  Node nu are nicio problemă să citească un fișier aflat sub `public/` — e doar singurul folder
  servit efectiv browserului (`"public": "./public/"` în config), nu o restricție de filesystem.

**Nu duplica tabelul** într-un al treilea loc. Dacă un modul nou are nevoie de el (frontend sau
backend), importă din `public/shared/softone-error-codes.js`.

## Ce exportă helper-ul

```js
export const SOFTONE_ERROR_DETAILS   // cod (string) -> { description, solution, category, retryable }
export function describeSoftOneError(errorCode)      // -> intrarea de mai sus, sau null
export function isSoftOneErrorRetryable(errorCode)    // -> bool, implicit false pentru cod necunoscut
export function formatSoftOneErrorMessage(errorCode)  // -> string multi-linie, gata de afișat (RO)
```

`retryable: true` marchează erori de sesiune/autentificare/tranzitorii (merită re-login + retry).
`retryable: false` marchează erori de business/permanente (eșuează rapid, nu reîncerca).

## Tabelul complet

| Cod | Mesaj | `retryable` | Categorie |
|---|---|---|---|
| -101 | Invalid Request, session has expired! (Web Account time expiration) | ✅ | Authentication |
| -100 | Invalid Request, session has expired! (Deep linking smart command) | ✅ | Authentication |
| -12 | Invalid Web Service call | ❌ | Request Validation |
| -11 | Licence must include a "Web Service Connector" module | ❌ | Licensing |
| -10 | Login fails. Username contains illegal characters | ❌ | Authentication |
| -9 | Invalid Request. Ensure that your request is valid | ❌ | Request Validation |
| -8 | Invalid request. User account is not active! | ❌ | Authentication |
| -7 | Session has expired (Web Account "FinalDate" expired) | ✅ | Authentication |
| -6 | Invalid AppId. Ensure that your request includes a valid AppId | ❌ | Configuration |
| -5 | Web Services Licenses Exceeded! | ❌ | Licensing |
| -4 | Number of registered devices exceeded! | ❌ | Licensing |
| -3 | Access denied. Selected module not activated! | ❌ | Licensing |
| -2 | Authenticate fails due to invalid credentials | ❌ | Authentication |
| **-1** | **Invalid request. Please login first** | ✅ | Authentication |
| 0 | Business error | ❌ | Business Logic |
| 11 | Internal error | ✅ | Internal |
| 12 | Deprecated service | ❌ | Deprecated |
| 13 | Invalid request, "reqID" expired | ✅ | Request Validation |
| 14 | Invalid request.(WS) | ❌ | Request Validation |
| 20 | Internal error | ✅ | Internal |
| 99 | Internal error | ✅ | Internal |
| 101 | Insufficient access rights to perform the operation! | ❌ | Authorization |
| 102 | "ReqId" not found on Server! | ✅ | Request Validation |
| 112 | Invalid editor | ❌ | Configuration |
| 213 | Invalid request, "reqID" expired | ✅ | Request Validation |
| 1001 | Username/Password/User active/Administrator right required | ❌ | Authentication |
| 1002 | Invalid domain ('DOMAIN') or already in use | ❌ | Configuration |
| 1010 | General Web Account Error | ❌ | Authentication |
| 2001 | Invalid request, Data does not exist | ❌ | Data Validation |

**-1 este codul care contează cel mai des în practică**: WSMCP (`/JS/WSMCP/execSql`) îl întoarce ca
`"Invalid request. Please login first"` de fiecare dată când `clientID` e prezent dar nu e o sesiune
S1 autentificată — confirmat live 08.09.2026 în timpul verificării §12.15 din
[FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md). Un `clientID` OMIS complet
trece garda (așa face `new_min_max/tools/validate-minmax-invariants.cjs`, read-only); serviciile care
scriu (`saveParams`/`params`) cer `data.token` obligatoriu, deci au nevoie de o sesiune S1 reală.

## Cine îl folosește azi

- **`public/components/branch-replenishment-container.js`** — `_isSoftOneErrorRetryable()` și
  `_lookupSoftOneErrorCode()` deleagă la helper (înainte: două copii hardcodate, ~150 linii).
- **`src/services/minmax-engine/minmax-engine.class.js`** — `_execSql()`/`_execStatements()` ata­șează
  `.softOneErrorCode` / `.softOneRetryable` / `.softOneDescription` pe eroarea aruncată, prin
  `annotateSoftOneError()` (local, extrage codul din `response.code` sau `response.errorcode` —
  numele câmpului diferă între transporturi S1, vezi mai jos).

## Gotcha: numele câmpului cu codul variază între transporturi

Nu presupune un singur nume de câmp în răspunsul S1:

- `src/app.js` (`setData`) → `response.code`.
- `mcp-server/src/softone-client.ts` → `response.errorcode` (litere mici, fără underscore).
- WSMCP-ul propriu (`S1-MEC/AJS/WSMCP.js`) folosește `code` doar pentru propriile erori (401 etc.),
  nu pentru codurile de platformă de mai sus — `"Invalid request. Please login first"` NU e generat
  de codul nostru, vine din platforma S1 înainte ca cererea să ajungă la funcția AJS.

Extragerea robustă (vezi `softOneErrorCode()` din `minmax-engine.class.js`) încearcă `response.code`,
apoi `response.errorcode`, înainte de a renunța.

## Când adaugi un modul nou care vorbește cu S1

1. Nu copia tabelul. Importă din `public/shared/softone-error-codes.js`.
2. Dacă modulul e backend și aruncă erori, atașează `.softOneErrorCode`/`.softOneRetryable` pe
   `Error`-ul aruncat (vezi `annotateSoftOneError()`), ca apelantul să poată decide retry vs. fail-fast
   fără să reinterpreteze mesajul text.
3. Dacă modulul e frontend și afișează erori utilizatorului, folosește `formatSoftOneErrorMessage()`
   pentru mesajul RO gata formatat, nu recompune propriul text.
