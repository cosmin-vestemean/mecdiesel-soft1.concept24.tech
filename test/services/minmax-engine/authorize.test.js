// Integration test pentru lantul de hook-uri (§12.8): authenticate('jwt') +
// requireRole, cablate exact ca in minmax-engine.js, dar pe un serviciu-stub
// intr-o app Feathers de unica folosinta - nu testam SQL/S1 aici (asta e deja
// acoperit de minmax-engine.class.test.js), doar RASPUNSUL autorizarii.
import assert from 'assert'
import { feathers } from '@feathersjs/feathers'
import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication'
import { requireRole } from '../../../src/services/minmax-engine/authorize.js'
import { ROLE_READ, ROLE_EDIT } from '../../../src/services/minmax-engine/roles.js'

function makeApp () {
  const app = feathers()
  app.set('authentication', {
    secret: 'unit-test-secret',
    entity: null,
    authStrategies: ['jwt'],
    jwtOptions: { expiresIn: '8h' }
  })

  const authService = new AuthenticationService(app)
  authService.register('jwt', new JWTStrategy())
  app.use('authentication', authService)

  app.use('minmax-engine', {
    async results () { return { ok: true, method: 'results' } },
    async saveParams () { return { ok: true, method: 'saveParams' } },
    async runEngine () { return { ok: true, method: 'runEngine' } },
    async abandonRun () { return { ok: true, method: 'abandonRun' } },
    async purgeRun () { return { ok: true, method: 'purgeRun' } }
  }, { methods: ['results', 'saveParams', 'runEngine', 'abandonRun', 'purgeRun'] })

  app.service('minmax-engine').hooks({
    around: {
      all: [authenticate('jwt'), requireRole(ROLE_READ)],
      abandonRun: [requireRole(ROLE_EDIT)],
      purgeRun: [requireRole(ROLE_EDIT)],
      runEngine: [requireRole(ROLE_EDIT)],
      saveParams: [requireRole(ROLE_EDIT)]
    }
  })

  return app
}

async function mintToken (app, roles, refid = '1234') {
  return app.service('authentication').createAccessToken({ sub: refid, roles })
}

describe('minmax-engine authorization hooks (§12.8, unit — no S1/DB)', () => {
  it('rejects an anonymous socket call with NotAuthenticated', async () => {
    const app = makeApp()
    await assert.rejects(
      app.service('minmax-engine').results({}, { provider: 'socketio' }),
      (err) => err.name === 'NotAuthenticated'
    )
  })

  it('an internal call without a provider is never gated (trusted server-side call)', async () => {
    const app = makeApp()
    const result = await app.service('minmax-engine').results({}, {})
    assert.deepStrictEqual(result, { ok: true, method: 'results' })
  })

  it('minmax.read allows results() to run', async () => {
    const app = makeApp()
    const accessToken = await mintToken(app, [ROLE_READ])
    const result = await app.service('minmax-engine').results({}, {
      provider: 'socketio',
      authentication: { strategy: 'jwt', accessToken }
    })
    assert.deepStrictEqual(result, { ok: true, method: 'results' })
  })

  it('minmax.read alone is rejected on saveParams() with Forbidden (403)', async () => {
    const app = makeApp()
    const accessToken = await mintToken(app, [ROLE_READ])
    await assert.rejects(
      app.service('minmax-engine').saveParams({}, {
        provider: 'socketio',
        authentication: { strategy: 'jwt', accessToken }
      }),
      (err) => err.name === 'Forbidden'
    )
  })

  it('minmax.edit reaches saveParams()', async () => {
    const app = makeApp()
    const accessToken = await mintToken(app, [ROLE_READ, ROLE_EDIT])
    const result = await app.service('minmax-engine').saveParams({}, {
      provider: 'socketio',
      authentication: { strategy: 'jwt', accessToken }
    })
    assert.deepStrictEqual(result, { ok: true, method: 'saveParams' })
  })

  // FAZA6_CONTRACT.md §8: runEngine/abandonRun/purgeRun are gated exactly
  // like saveParams — same role, same hook chain.
  for (const method of ['runEngine', 'abandonRun', 'purgeRun']) {
    it(`minmax.read alone is rejected on ${method}() with Forbidden (403)`, async () => {
      const app = makeApp()
      const accessToken = await mintToken(app, [ROLE_READ])
      await assert.rejects(
        app.service('minmax-engine')[method]({}, {
          provider: 'socketio',
          authentication: { strategy: 'jwt', accessToken }
        }),
        (err) => err.name === 'Forbidden'
      )
    })

    it(`minmax.edit reaches ${method}()`, async () => {
      const app = makeApp()
      const accessToken = await mintToken(app, [ROLE_READ, ROLE_EDIT])
      const result = await app.service('minmax-engine')[method]({}, {
        provider: 'socketio',
        authentication: { strategy: 'jwt', accessToken }
      })
      assert.deepStrictEqual(result, { ok: true, method })
    })
  }

  it('a REFID or role claimed in the request payload never changes the identity from the token', async () => {
    const app = makeApp()
    const accessToken = await mintToken(app, [ROLE_READ], '1234')
    await assert.rejects(
      app.service('minmax-engine').saveParams(
        { refid: 'someone-else', roles: [ROLE_READ, ROLE_EDIT] },
        { provider: 'socketio', authentication: { strategy: 'jwt', accessToken } }
      ),
      (err) => err.name === 'Forbidden'
    )
  })

  it('rejects a token whose signature was tampered with', async () => {
    const app = makeApp()
    const accessToken = await mintToken(app, [ROLE_READ, ROLE_EDIT])
    const tampered = accessToken.slice(0, -1) + (accessToken.endsWith('a') ? 'b' : 'a')
    await assert.rejects(
      app.service('minmax-engine').results({}, {
        provider: 'socketio',
        authentication: { strategy: 'jwt', accessToken: tampered }
      }),
      (err) => err.name === 'NotAuthenticated'
    )
  })
})
