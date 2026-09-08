// Tokenul de aplicatie (§12.8): DOAR in memoria paginii, niciodata in
// sessionStorage/localStorage. Orice reload il pierde - comportament dorit,
// nu un bug; vezi FAZA5_CONTRACT.md §12.8.
import { client, socket } from '../socketConfig.js';

let appToken = null;
let connectionAuth = null;

export function setAppToken (token) {
  appToken = (typeof token === 'string' && token) ? token : null;
  connectionAuth = null;
}

export function getAppToken () {
  return appToken;
}

export function clearAppToken () {
  appToken = null;
  connectionAuth = null;
}

// Decodes ONLY the JWT payload, no signature check — for UI gating (which
// button to show), never for authorization: the server re-checks the real,
// signed token on every call (minmax.edit hook, FAZA6_CONTRACT.md §8).
function decodeJwtPayload (token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (err) {
    return null;
  }
}

// Roles claimed by the current app token (see src/app.js's appToken mint),
// read-only/UI-only per the comment above.
export function getAppTokenRoles () {
  if (!appToken) return [];
  const payload = decodeJwtPayload(appToken);
  return (payload && Array.isArray(payload.roles)) ? payload.roles : [];
}

// Clientul socket trimite din `params` doar `query`, deci un `params.authentication`
// atasat per apel se pierde pe drum: sesiunea se stabileste O SINGURA DATA pe
// conexiune, iar serverul o retine in `connection.authentication`.
export function ensureConnectionAuth () {
  if (!appToken) return Promise.resolve(false);
  if (!connectionAuth) {
    const token = appToken;
    connectionAuth = client.service('authentication')
      .create({ strategy: 'jwt', accessToken: token })
      .then(() => true)
      .catch((err) => {
        if (appToken === token) connectionAuth = null; // urmatorul apel reincearca
        throw err;
      });
  }
  return connectionAuth;
}

// O reconectare inseamna alta conexiune pe server, care nu mosteneste
// autentificarea celei vechi.
socket.on('connect', () => {
  connectionAuth = null;
  if (appToken) {
    ensureConnectionAuth().catch((err) => {
      console.error('Re-authentication after socket reconnect failed:', err);
    });
  }
});
