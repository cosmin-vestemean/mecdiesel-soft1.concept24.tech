// Singurul loc care stie de unde vin rolurile MIN/MAX. Inlocuirea configuratiei
// server-side cu o tabela administrata trebuie sa ramana o schimbare in acest fisier.

export const ROLE_READ = 'minmax.read'
export const ROLE_EDIT = 'minmax.edit'

const WILDCARD = '*'

function parseList (value) {
  if (value === undefined || value === null) return null
  const items = Array.isArray(value) ? value : String(value).split(',')
  return items.map((item) => String(item).trim()).filter((item) => item.length > 0)
}

// Variabila de mediu, cand e definita, are prioritate peste config/default.json:
// altfel cheia din fisier ar face override-ul de deploy imposibil.
function listFor (cfg, key, envName, fallback) {
  const fromEnv = parseList(process.env[envName])
  if (fromEnv !== null) return fromEnv
  const fromConfig = parseList(cfg[key])
  if (fromConfig !== null) return fromConfig
  return fallback
}

function matches (list, refid) {
  return list.includes(WILDCARD) || list.includes(refid)
}

/**
 * @param {Application|null} app aplicatia Feathers, sursa configuratiei `minmaxEngine`
 * @param {string|number|null} refid identitatea verificata contra S1
 * @returns {Promise<string[]>} rolurile acordate; `minmax.edit` include intotdeauna `minmax.read`
 */
export async function resolveRoles (app, refid) {
  const id = refid === undefined || refid === null ? '' : String(refid).trim()
  if (!id) return []

  const cfg = (app && app.get('minmaxEngine')) || {}
  const readers = listFor(cfg, 'readers', 'MINMAX_ENGINE_READERS', [WILDCARD])
  const editors = listFor(cfg, 'editors', 'MINMAX_ENGINE_EDITORS', [])

  const canEdit = matches(editors, id)
  const roles = []
  if (canEdit || matches(readers, id)) roles.push(ROLE_READ)
  if (canEdit) roles.push(ROLE_EDIT)
  return roles
}
