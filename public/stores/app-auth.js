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
