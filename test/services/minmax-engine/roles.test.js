// Unit tests pentru resolveRoles: sursa rolurilor e configuratia server-side,
// deci testele acopera precedenta env vs config, comparatia REFID ca String si
// comportamentul fail-closed cand identitatea lipseste.
import assert from 'assert'
import { resolveRoles, ROLE_READ, ROLE_EDIT } from '../../../src/services/minmax-engine/roles.js'

function makeApp (minmaxEngine) {
  return { get: (key) => (key === 'minmaxEngine' ? minmaxEngine : undefined) }
}

const ENV_KEYS = ['MINMAX_ENGINE_READERS', 'MINMAX_ENGINE_EDITORS']

describe('minmax-engine roles', () => {
  let savedEnv

  beforeEach(() => {
    savedEnv = {}
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  })

  it('implicit: orice identitate citeste, nimeni nu editeaza', async () => {
    assert.deepStrictEqual(await resolveRoles(makeApp({}), '1234'), [ROLE_READ])
  })

  it('editorul din configuratie primeste si minmax.read', async () => {
    const app = makeApp({ readers: '*', editors: ['1234'] })
    assert.deepStrictEqual(await resolveRoles(app, '1234'), [ROLE_READ, ROLE_EDIT])
    assert.deepStrictEqual(await resolveRoles(app, '5678'), [ROLE_READ])
  })

  it('compara REFID ca String, indiferent de tipul din configuratie sau apel', async () => {
    const app = makeApp({ editors: [1234] })
    assert.ok((await resolveRoles(app, '1234')).includes(ROLE_EDIT))
    assert.ok((await resolveRoles(app, 1234)).includes(ROLE_EDIT))
  })

  it('lista de readers restrictiva refuza identitatile din afara ei', async () => {
    const app = makeApp({ readers: ['1234'], editors: [] })
    assert.deepStrictEqual(await resolveRoles(app, '1234'), [ROLE_READ])
    assert.deepStrictEqual(await resolveRoles(app, '5678'), [])
  })

  it('editorul citeste chiar daca nu e in lista de readers', async () => {
    const app = makeApp({ readers: ['5678'], editors: ['1234'] })
    assert.deepStrictEqual(await resolveRoles(app, '1234'), [ROLE_READ, ROLE_EDIT])
  })

  it('variabila de mediu are prioritate peste configuratie', async () => {
    process.env.MINMAX_ENGINE_EDITORS = ' 5678 , 9012 '
    const app = makeApp({ editors: ['1234'] })
    assert.deepStrictEqual(await resolveRoles(app, '1234'), [ROLE_READ])
    assert.deepStrictEqual(await resolveRoles(app, '5678'), [ROLE_READ, ROLE_EDIT])
    assert.deepStrictEqual(await resolveRoles(app, '9012'), [ROLE_READ, ROLE_EDIT])
  })

  it('variabila de mediu goala inseamna lista goala, nu absenta override-ului', async () => {
    process.env.MINMAX_ENGINE_EDITORS = ''
    const app = makeApp({ editors: ['1234'] })
    assert.deepStrictEqual(await resolveRoles(app, '1234'), [ROLE_READ])
  })

  it('fara identitate nu se acorda niciun rol, nici macar cu readers "*"', async () => {
    const app = makeApp({ readers: '*', editors: ['1234'] })
    for (const refid of [undefined, null, '', '   ']) {
      assert.deepStrictEqual(await resolveRoles(app, refid), [])
    }
  })

  it('fara configuratie de aplicatie ramane pe implicitele fail-closed', async () => {
    assert.deepStrictEqual(await resolveRoles(null, '1234'), [ROLE_READ])
  })
})
