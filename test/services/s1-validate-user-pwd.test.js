// Unit tests pentru emiterea tokenului de aplicatie in validateUserPwd (§12.8).
// Cele doua apeluri catre S1 (authenticate + usrPwdValidate) sunt interceptate cu
// nock; emiterea tokenului foloseste un `authentication` fals care inregistreaza
// payload-ul primit, ca sa nu depindem de un secret JWT real.
import assert from 'assert'
import nock from 'nock'
import { s1Service } from '../../src/app.js'

const S1_HOST = 'https://mecdiesel.oncloud.gr'
const S1_BASE_PATH = '/s1services'

function makeApp ({ minmaxEngine = {}, createAccessToken } = {}) {
  const authenticationService = {
    createAccessToken: createAccessToken || (async (payload) => `fake-token:${JSON.stringify(payload)}`)
  }
  return {
    get: (key) => (key === 'minmaxEngine' ? minmaxEngine : undefined),
    service: (name) => (name === 'authentication' ? authenticationService : undefined)
  }
}

async function makeService (appOverrides) {
  const service = new s1Service()
  await service.setup(makeApp(appOverrides))
  return service
}

function mockAuthenticateOk (clientID = 'refreshed-client-id') {
  nock(S1_HOST)
    .post(`${S1_BASE_PATH}/`, (body) => body.service === 'authenticate')
    .reply(200, { success: true, clientID })
}

function mockValidatePwd (success, extra = {}) {
  nock(S1_HOST)
    .post(`${S1_BASE_PATH}/JS/login/usrPwdValidate`)
    .reply(200, { success, ...extra })
}

describe('validateUserPwd (unit, S1 mocked)', () => {
  before(() => nock.disableNetConnect())
  after(() => nock.enableNetConnect())
  afterEach(() => nock.cleanAll())

  it('mints an application token on success, with sub=REFID and resolved roles', async () => {
    mockAuthenticateOk('refreshed-client-id')
    mockValidatePwd(true)

    const service = await makeService({ minmaxEngine: { editors: ['1234'] } })
    const result = await service.validateUserPwd({ sessionToken: 'sess', clientID: '1234', password: 'pwd' })

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.clientID, 'refreshed-client-id')
    assert.ok(result.appToken.startsWith('fake-token:'))
    const payload = JSON.parse(result.appToken.slice('fake-token:'.length))
    assert.strictEqual(payload.sub, '1234')
    assert.deepStrictEqual(payload.roles, ['minmax.read', 'minmax.edit'])
  })

  it('does not mint a token when password validation fails', async () => {
    mockAuthenticateOk()
    mockValidatePwd(false, { error: 'bad password' })

    const service = await makeService()
    const result = await service.validateUserPwd({ sessionToken: 'sess', clientID: '1234', password: 'wrong' })

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.appToken, undefined)
  })

  it('does not mint a token when the S1 authenticate step fails', async () => {
    nock(S1_HOST)
      .post(`${S1_BASE_PATH}/`, (body) => body.service === 'authenticate')
      .reply(200, { success: false, error: 'bad session' })

    const service = await makeService()
    const result = await service.validateUserPwd({ sessionToken: 'sess', clientID: '1234', password: 'pwd' })

    assert.strictEqual(result.success, false)
    assert.ok(!('appToken' in result))
  })

  it('reports failure, not silent success, when token minting itself throws', async () => {
    mockAuthenticateOk()
    mockValidatePwd(true)

    const service = await makeService({
      createAccessToken: async () => { throw new Error('signing key missing') }
    })
    const result = await service.validateUserPwd({ sessionToken: 'sess', clientID: '1234', password: 'pwd' })

    assert.strictEqual(result.success, false)
    assert.ok(/application session token/i.test(result.error))
  })

  it('rejects a request missing sessionToken, clientID or password before calling S1', async () => {
    const service = await makeService()
    const result = await service.validateUserPwd({ sessionToken: 'sess', clientID: '1234' })

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'Missing session token, clientID, or password for validation.')
  })
})
