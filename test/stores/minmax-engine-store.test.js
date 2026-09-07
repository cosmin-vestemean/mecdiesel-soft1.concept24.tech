// Store test for FAZA5_REMEDIERI_PLAN.md Pasul 4 (§12.6+§12.10+§12.11): the
// population-key cache behind loadResults()/loadGroupAbc(). Each test mocks
// `_getService()` (the store never actually reaches socketConfig.js's socket)
// and asserts on the ARGUMENTS the store sends and the STATE it produces —
// never on generated SQL, which is minmax-engine.class.test.js's job.
//
// Requires jsdom + the CDN->npm module redirect (see test/helpers/), plus a
// stubbed sessionStorage.s1Token since the store reads it via `_token()`.
import assert from 'assert';
import { register } from 'node:module';
import '../helpers/browser-env.mjs';

register('../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-engine-store — population cache (§12.6+§12.10+§12.11)', () => {
  let MinmaxEngineStore;

  before(async () => {
    global.sessionStorage = global.window.sessionStorage;
    global.sessionStorage.setItem('s1Token', 'test-token');
    ({ MinmaxEngineStore } = await import('../../public/stores/minmax-engine-store.js'));
  });

  function makeStore () {
    const store = new MinmaxEngineStore();
    const calls = [];
    const resultsResponse = { page: 1, pageSize: 100, rows: [], runId: 5, total: 999 };
    const groupAbcResponse = { page: 1, pageSize: 100, rows: [], runId: 5, total: 42 };

    store._getService = () => ({
      groupAbc: async (payload) => {
        calls.push({ method: 'groupAbc', payload });
        return groupAbcResponse;
      },
      results: async (payload) => {
        calls.push({ method: 'results', payload });
        return resultsResponse;
      }
    });

    return { calls, store };
  }

  describe('loadResults()', () => {
    it('initial load (withTotal:true) resolves "current" (runId undefined) and requests a total', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true });

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].payload.runId, undefined);
      assert.strictEqual(calls[0].payload.withTotal, true);
      assert.strictEqual(store.getState().resolvedRunId, 5);
      assert.strictEqual(store.getState().total, 999);
    });

    it('paginating after an initial load (withTotal:false) pins the resolved runId and skips the count (§12.10)', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true });

      store.setPage(2);
      await store.loadResults({ withTotal: false });

      assert.strictEqual(calls.length, 2);
      assert.strictEqual(calls[1].payload.runId, 5, 'expected the pinned resolvedRunId, not undefined (a fresh "resolve current" ask)');
      assert.strictEqual(calls[1].payload.withTotal, false);
    });

    it('sorting after an initial load (withTotal:false) also pins the resolved runId and skips the count', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true });

      store.setSort('engMax', 'DESC');
      await store.loadResults({ withTotal: false });

      assert.strictEqual(calls[1].payload.runId, 5);
      assert.strictEqual(calls[1].payload.withTotal, false);
    });

    it('preserves the existing total when a paginated response omits it (reducer contract)', async () => {
      const { store } = makeStore();
      await store.loadResults({ withTotal: true });
      assert.strictEqual(store.getState().total, 999);

      store.setPage(2);
      store._getService = () => ({
        results: async () => ({ page: 2, pageSize: 100, rows: [{ MTRL: 1 }], runId: 5 }) // no `total` key at all
      });
      await store.loadResults({ withTotal: false });

      assert.strictEqual(store.getState().total, 999, 'total must survive a response with no total field');
      assert.strictEqual(store.getState().rows.length, 1);
    });

    it('changing filters produces exactly one count even though the caller asked for withTotal:false (safety net)', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true });

      store.setFilters({ abc: ['A'] });
      await store.loadResults({ withTotal: false }); // caller "forgot" — population changed, must still count

      assert.strictEqual(calls[1].payload.withTotal, true);
      assert.strictEqual(calls[1].payload.runId, undefined, 'a changed population must not reuse the old pin either');
    });

    it('a "current session" refresh (withTotal:true) re-resolves ESTE_CURENT even with identical filters (§12.6/§12.10)', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true }); // resolvedRunId=5, total=999

      // Refresh in "follow current" mode: same filters/selector, but the
      // underlying current session changed (e.g. a new run just finished).
      store._getService = () => ({
        results: async (payload) => {
          calls.push({ method: 'results', payload });
          return { page: 1, pageSize: 100, rows: [], runId: 9, total: 5 };
        }
      });

      await store.loadResults({ withTotal: true });

      assert.strictEqual(calls[1].payload.runId, undefined, 'refresh must ask the service to resolve again, not reuse the old pin');
      assert.strictEqual(store.getState().resolvedRunId, 9);
      assert.strictEqual(store.getState().total, 5);
    });
  });

  describe('loadGroupAbc()', () => {
    it('initial load (withTotal:true) resolves "current" and requests a total', async () => {
      const { calls, store } = makeStore();
      await store.loadGroupAbc({ branches: [1000] }, { withTotal: true });

      assert.strictEqual(calls[0].payload.runId, undefined);
      assert.strictEqual(calls[0].payload.withTotal, true);
      assert.strictEqual(store.getState().groupAbc.total, 42);
    });

    it('paginating with identical filters (withTotal:false) pins the resolved runId and skips the count (§12.11)', async () => {
      const { calls, store } = makeStore();
      const filters = { branches: [1000] };
      await store.loadGroupAbc(filters, { withTotal: true });

      store.setGroupAbcPage(2);
      await store.loadGroupAbc(filters, { withTotal: false });

      assert.strictEqual(calls[1].payload.runId, 5);
      assert.strictEqual(calls[1].payload.withTotal, false);
    });

    it('uses its own population cache, independent of loadResults()', async () => {
      const { calls, store } = makeStore();
      await store.loadResults({ withTotal: true }); // pins the RESULTS cache only

      const filters = { branches: [1000] };
      await store.loadGroupAbc(filters, { withTotal: false }); // groupAbc cache is still empty

      const groupAbcCall = calls.find((c) => c.method === 'groupAbc');
      assert.strictEqual(groupAbcCall.payload.runId, undefined, 'an empty groupAbc cache must not borrow the results() pin');
      assert.strictEqual(groupAbcCall.payload.withTotal, true, 'first-ever groupAbc call is a population change, must count');
    });

    it('preserves the existing groupAbc total when a paginated response omits it', async () => {
      const { store } = makeStore();
      const filters = { branches: [1000] };
      await store.loadGroupAbc(filters, { withTotal: true });
      assert.strictEqual(store.getState().groupAbc.total, 42);

      store.setGroupAbcPage(2);
      store._getService = () => ({
        groupAbc: async () => ({ page: 2, pageSize: 100, rows: [{ ABC: 'B' }], runId: 5 }) // no `total`
      });
      await store.loadGroupAbc(filters, { withTotal: false });

      assert.strictEqual(store.getState().groupAbc.total, 42);
      assert.strictEqual(store.getState().groupAbc.rows.length, 1);
    });
  });
});
