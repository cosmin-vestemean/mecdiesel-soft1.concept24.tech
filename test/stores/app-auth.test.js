// Unit test pentru modulul de tinere in memorie a tokenului de aplicatie
// (§12.8): nicio persistenta, doar variabila de modul, plus autentificarea
// CONEXIUNII socket (clientul socket nu transmite `params.authentication`).
//
// Requires jsdom + the CDN->npm module redirect (see test/helpers/), pentru ca
// app-auth.js importa socketConfig.js.
import assert from 'assert';
import { register } from 'node:module';
import '../helpers/browser-env.mjs';

register('../helpers/cdn-module-loader.mjs', import.meta.url);

describe('app-auth (in-memory app token)', () => {
  let mod;
  let client;
  let originalService;
  let calls;

  before(async () => {
    ({ client } = await import('../../public/socketConfig.js'));
    originalService = client.service;
  });

  beforeEach(async () => {
    calls = [];
    client.service = (path) => ({
      create: async (data) => {
        calls.push({ path, data });
        return { accessToken: data.accessToken };
      }
    });
    // cache-bust: fiecare test porneste cu propria instanta a modulului,
    // ca starea (variabila de modul) sa nu se scurga intre teste.
    mod = await import(`../../public/stores/app-auth.js?t=${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    client.service = originalService;
  });

  it('starts with no token and never touches the connection', async () => {
    assert.strictEqual(mod.getAppToken(), null);
    assert.strictEqual(await mod.ensureConnectionAuth(), false);
    assert.deepStrictEqual(calls, []);
  });

  it('authenticates the socket connection once with the jwt strategy', async () => {
    mod.setAppToken('abc.def.ghi');
    assert.strictEqual(mod.getAppToken(), 'abc.def.ghi');

    assert.strictEqual(await mod.ensureConnectionAuth(), true);
    assert.strictEqual(await mod.ensureConnectionAuth(), true);

    assert.deepStrictEqual(calls, [{
      path: 'authentication',
      data: { strategy: 'jwt', accessToken: 'abc.def.ghi' }
    }]);
  });

  it('rejects non-string or empty tokens as "no token"', async () => {
    for (const bad of [undefined, null, '', 0, {}]) {
      mod.setAppToken(bad);
      assert.strictEqual(mod.getAppToken(), null);
      assert.strictEqual(await mod.ensureConnectionAuth(), false);
    }
    assert.deepStrictEqual(calls, []);
  });

  it('clearAppToken() removes a previously set token', async () => {
    mod.setAppToken('abc.def.ghi');
    mod.clearAppToken();
    assert.strictEqual(mod.getAppToken(), null);
    assert.strictEqual(await mod.ensureConnectionAuth(), false);
  });

  it('retries on the next call when authenticating the connection fails', async () => {
    let attempt = 0;
    client.service = () => ({
      create: async (data) => {
        attempt += 1;
        if (attempt === 1) throw new Error('connection refused');
        return { accessToken: data.accessToken };
      }
    });

    mod.setAppToken('abc.def.ghi');
    await assert.rejects(mod.ensureConnectionAuth(), /connection refused/);
    assert.strictEqual(await mod.ensureConnectionAuth(), true);
    assert.strictEqual(attempt, 2);
  });
});
