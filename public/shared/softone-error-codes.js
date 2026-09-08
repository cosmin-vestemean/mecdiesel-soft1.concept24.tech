/**
 * SoftOne WS platform-level error codes (https://www.softone.gr/ws/#errorcodes).
 *
 * Lives under public/ deliberately: it's the only tree served to the browser,
 * so browser components (branch-replenishment-container.js) reach it via a
 * relative import; backend services (src/services/minmax-engine) reach the
 * SAME file via a plain relative filesystem import — no bundler/build step
 * either side depends on, just two consumers of one ES module.
 *
 * `retryable: true` marks session/authentication/transient errors, worth a
 * re-login + retry. `retryable: false` marks business/permanent errors that
 * should fail fast. Unknown codes default to non-retryable (safety).
 */
export const SOFTONE_ERROR_DETAILS = {
  '-101': {
    description: 'Invalid Request, session has expired! (Web Account time expiration)',
    solution: 'Sesiunea a expirat. Aplicația va încerca să se reconecteze automat.',
    category: 'Authentication',
    retryable: true
  },
  '-100': {
    description: 'Invalid Request, session has expired! (Deep linking smart command)',
    solution: 'Sesiunea a expirat în timpul execuției comenzii. Reîncercați operația.',
    category: 'Authentication',
    retryable: true
  },
  '-12': {
    description: 'Invalid Web Service call',
    solution: 'Apelul serviciului web este invalid. Verificați parametrii transmiși.',
    category: 'Request Validation',
    retryable: false
  },
  '-11': {
    description: 'Invalid Request. Licence must include a "Web Service Connector" module',
    solution: 'Licența SoftOne nu include modulul "Web Service Connector". Contactați administratorul.',
    category: 'Licensing',
    retryable: false
  },
  '-10': {
    description: 'Login fails. Username contains illegal characters',
    solution: 'Numele de utilizator conține caractere invalide. Verificați configurația.',
    category: 'Authentication',
    retryable: false
  },
  '-9': {
    description: 'Invalid Request. Ensure that your request is valid',
    solution: 'Cererea este invalidă. Verificați formatul și conținutul datelor transmise.',
    category: 'Request Validation',
    retryable: false
  },
  '-8': {
    description: 'Invalid request. User account is not active!',
    solution: 'Contul de utilizator nu este activ. Contactați administratorul.',
    category: 'Authentication',
    retryable: false
  },
  '-7': {
    description: 'Session has expired (Web Account "FinalDate" expired)',
    solution: 'Sesiunea a expirat. Aplicația va încerca să se reconecteze automat.',
    category: 'Authentication',
    retryable: true
  },
  '-6': {
    description: 'Invalid AppId. Ensure that your request includes a valid AppId',
    solution: 'AppId invalid. Verificați configurația aplicației.',
    category: 'Configuration',
    retryable: false
  },
  '-5': {
    description: 'Web Services Licenses Exceeded!',
    solution: 'S-a depășit numărul de licențe pentru servicii web. Contactați administratorul.',
    category: 'Licensing',
    retryable: false
  },
  '-4': {
    description: 'Number of registered devices exceeded!',
    solution: 'S-a depășit numărul de dispozitive înregistrate. Contactați administratorul.',
    category: 'Licensing',
    retryable: false
  },
  '-3': {
    description: 'Access denied. Selected module not activated!',
    solution: 'Modulul selectat nu este activat în licență. Contactați administratorul.',
    category: 'Licensing',
    retryable: false
  },
  '-2': {
    description: 'Authenticate fails due to invalid credentials',
    solution: 'Autentificare eșuată - credențiale invalide. Verificați username/password.',
    category: 'Authentication',
    retryable: false
  },
  '-1': {
    description: 'Invalid request. Please login first',
    solution: 'Cerere invalidă - este necesară autentificarea. Aplicația va încerca să se reconecteze.',
    category: 'Authentication',
    retryable: true
  },
  '0': {
    description: 'Business error',
    solution: 'Eroare de business logic. Verificați datele introduse și regulile de validare.',
    category: 'Business Logic',
    retryable: false
  },
  '11': {
    description: 'Internal error',
    solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
    category: 'Internal',
    retryable: true
  },
  '12': {
    description: 'Deprecated service',
    solution: 'Serviciul este depreciat. Contactați echipa de dezvoltare pentru actualizare.',
    category: 'Deprecated',
    retryable: false
  },
  '13': {
    description: 'Invalid request, "reqID" expired',
    solution: 'ID-ul cererii a expirat. Reîncercați operația.',
    category: 'Request Validation',
    retryable: true
  },
  '14': {
    description: 'Invalid request.(WS)',
    solution: 'Cerere invalidă pentru serviciul web. Verificați formatul datelor.',
    category: 'Request Validation',
    retryable: false
  },
  '20': {
    description: 'Internal error',
    solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
    category: 'Internal',
    retryable: true
  },
  '99': {
    description: 'Internal error',
    solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
    category: 'Internal',
    retryable: true
  },
  '101': {
    description: 'Invalid request. Insufficient access rights to perform the operation!',
    solution: 'Drepturi de acces insuficiente. Contactați administratorul pentru permisiuni.',
    category: 'Authorization',
    retryable: false
  },
  '102': {
    description: '"ReqId" not found on Server!',
    solution: 'ID-ul cererii nu a fost găsit pe server. Reîncercați operația.',
    category: 'Request Validation',
    retryable: true
  },
  '112': {
    description: 'Invalid editor',
    solution: 'Editor invalid. Verificați configurația editorului folosit.',
    category: 'Configuration',
    retryable: false
  },
  '213': {
    description: 'Invalid request, "reqID" expired',
    solution: 'ID-ul cererii a expirat. Reîncercați operația.',
    category: 'Request Validation',
    retryable: true
  },
  '1001': {
    description: 'Please ensure :Username, Password, User is Active and has Administrator right',
    solution: 'Verificați: username, password, utilizatorul este activ și are drepturi de administrator.',
    category: 'Authentication',
    retryable: false
  },
  '1002': {
    description: 'Invalid domain (\'DOMAIN\') or already in use',
    solution: 'Domeniul este invalid sau deja în folosire. Verificați configurația.',
    category: 'Configuration',
    retryable: false
  },
  '1010': {
    description: 'General Web Account Error',
    solution: 'Eroare generală de cont web. Verificați configurația contului.',
    category: 'Authentication',
    retryable: false
  },
  '2001': {
    description: 'Invalid request, Data does not exist',
    solution: 'Datele solicitate nu există. Verificați că înregistrările sunt valide.',
    category: 'Data Validation',
    retryable: false
  }
}

export function describeSoftOneError (errorCode) {
  if (errorCode === undefined || errorCode === null) return null
  return SOFTONE_ERROR_DETAILS[String(errorCode)] || null
}

// Unknown codes default to false — matching the original behaviour ("default
// to non-retryable for safety") rather than assuming a new code is transient.
export function isSoftOneErrorRetryable (errorCode) {
  const entry = describeSoftOneError(errorCode)
  return entry ? entry.retryable : false
}

// The exact multi-line message branch-replenishment-container.js has shown
// in its error modal since ENHANCED_ERROR_DETAILS_IMPLEMENTATION_COMPLETE.md.
export function formatSoftOneErrorMessage (errorCode) {
  const info = describeSoftOneError(errorCode)
  if (info) {
    return `🔍 ${info.description}\n\n💡 Soluție: ${info.solution}\n\n📂 Categorie: ${info.category}\n\n` +
      '📖 Pentru mai multe detalii, consultați documentația oficială SoftOne la:\nhttps://www.softone.gr/ws/#errorcodes'
  }
  return `⚠️ Cod de eroare necunoscut: ${errorCode}\n\n` +
    'Acest cod de eroare nu este recunoscut în baza de date comună de erori SoftOne.\n\n' +
    '💡 Recomandări:\n' +
    '• Verificați că toate câmpurile obligatorii sunt completate corect\n' +
    '• Asigurați-vă că datele respectă formatul așteptat\n' +
    '• Verificați că utilizatorul are permisiunile necesare\n' +
    '• Consultați logurile SoftOne pentru detalii suplimentare\n\n' +
    '📖 Pentru documentația completă și coduri de eroare actualizate:\nhttps://www.softone.gr/ws/#errorcodes\n\n' +
    `🆘 Dacă problema persistă, contactați echipa de suport cu codul ${errorCode}.`
}
