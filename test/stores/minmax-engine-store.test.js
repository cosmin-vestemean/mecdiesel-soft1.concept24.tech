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

describe('minmax-engine-store — Phase 6 run lifecycle', () => {
  let MinmaxEngineStore;

  before(async () => {
    global.sessionStorage = global.window.sessionStorage;
    global.sessionStorage.setItem('s1Token', 'test-token');
    ({ MinmaxEngineStore } = await import('../../public/stores/minmax-engine-store.js'));
  });

  it('starts a FULL run and records its RUNID without exposing credentials', async () => {
    const store = new MinmaxEngineStore();
    let payload;
    store._getService = () => ({
      runEngine: async (data) => {
        payload = data;
        return { runId: 6 };
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, true);
    assert.strictEqual(payload.branchAssignmentMode, 'CLIENT');
    assert.strictEqual(payload.calibrareMod, 'C');
    assert.strictEqual(payload.scope, 'FULL');
    assert.strictEqual(payload.token, 'test-token');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'authKey'), false);
    assert.strictEqual(store.getState().runLaunch.runId, 6);
    assert.strictEqual(store.getState().runId, null, 'an OPEN run must not become the result selector');
  });

  it('normalizes and forwards the selected branch assignment mode', async () => {
    const store = new MinmaxEngineStore();
    let payload;
    store._getService = () => ({
      runEngine: async (data) => {
        payload = data;
        return { runId: 6 };
      }
    });

    const ok = await store.runEngine({ branchAssignmentMode: ' agent ', calibrareMod: ' a ', poll: false });

    assert.strictEqual(ok, true);
    assert.strictEqual(payload.branchAssignmentMode, 'AGENT');
    assert.strictEqual(payload.calibrareMod, 'A');
  });

  it('rejects an unknown branch assignment mode before calling the service', async () => {
    const store = new MinmaxEngineStore();
    let runEngineCalled = false;
    store._getService = () => ({
      history: async () => ({ rows: [] }),
      runEngine: async () => {
        runEngineCalled = true;
      }
    });

    const ok = await store.runEngine({ branchAssignmentMode: 'OTHER', poll: false });

    assert.strictEqual(ok, false);
    assert.strictEqual(runEngineCalled, false);
    assert.ok(store.getState().runLaunch.error.includes('DOC, AGENT sau CLIENT'));
  });

  it('turns the already-open code into a stable user-facing state and refreshes history', async () => {
    const store = new MinmaxEngineStore();
    let historyCalls = 0;
    store._getService = () => ({
      history: async () => {
        historyCalls += 1;
        return { rows: [{ RUNID: 6, SESSION_STATUS: 'OPEN' }] };
      },
      runEngine: async () => {
        const err = new Error('already open');
        err.code = 'SESSION_ALREADY_OPEN';
        throw err;
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, false);
    assert.strictEqual(historyCalls, 1);
    assert.strictEqual(store.getState().runLaunch.error, 'Exista deja o sesiune MIN/MAX in curs.');
    assert.strictEqual(store.getState().runHistory[0].SESSION_STATUS, 'OPEN');
  });

  it('maps RUNNER_SETUP_MISSING to a Romanian message pointing at NewMinMax/setup', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [] }),
      runEngine: async () => {
        const err = new Error("Agent job 'MEC_MinMaxEngine_RunPhases_1000' does not exist; run NewMinMax/setup.")
        err.code = 'RUNNER_SETUP_MISSING';
        throw err;
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, false);
    assert.ok(store.getState().runLaunch.error.includes('NewMinMax/setup'));
  });

  it('maps AGENT_UNAVAILABLE to a message naming SQL Server Agent', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [] }),
      runEngine: async () => {
        const err = new Error('SQL Server Agent is not running.')
        err.code = 'AGENT_UNAVAILABLE';
        throw err;
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, false);
    assert.ok(/SQL Server Agent/.test(store.getState().runLaunch.error));
  });

  it('maps RUNNER_LAUNCH_FAILED to a concise message, leaving the OPEN session recoverable', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [{ RUNID: 9, SESSION_STATUS: 'OPEN' }] }),
      runEngine: async () => {
        const err = new Error('The MIN/MAX runner job is already active for this company.')
        err.code = 'RUNNER_LAUNCH_FAILED';
        throw err;
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, false);
    assert.ok(store.getState().runLaunch.error.length > 0);
    assert.strictEqual(store.getState().runHistory[0].SESSION_STATUS, 'OPEN');
  });

  it('maps RUNNER_ALREADY_ACTIVE without inviting the user to abandon the executing session', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [{ RUNID: 9, SESSION_STATUS: 'OPEN' }] }),
      runEngine: async () => {
        const err = new Error('The MIN/MAX runner job is already active for this company.');
        err.code = 'RUNNER_ALREADY_ACTIVE';
        throw err;
      }
    });

    const ok = await store.runEngine({ poll: false });

    assert.strictEqual(ok, false);
    assert.ok(store.getState().runLaunch.error.includes('deja in curs'));
    assert.ok(!store.getState().runLaunch.error.includes('sesiunea a ramas deschisa'));
    assert.ok(store.getState().runLaunch.error.includes('nu poate fi abandonata'));
  });

  it('finishes polling on DONE, follows current again and reloads results', async () => {
    const store = new MinmaxEngineStore();
    let resultsCalls = 0;
    store._getService = () => ({
      history: async () => ({ rows: [{ RUNID: 6, SESSION_STATUS: 'DONE', STATUS: 'DONE' }] }),
      results: async () => {
        resultsCalls += 1;
        return { page: 1, pageSize: 100, rows: [], runId: 6, total: 0 };
      }
    });
    store.dispatch({ type: 'SET_RUN_LAUNCH', payload: { polling: true, runId: 6 } });
    store.setRunId(6);
    const seq = store._beginRequest('run');

    await store._pollRun(6, seq);

    assert.strictEqual(resultsCalls, 1);
    assert.strictEqual(store.getState().runLaunch.polling, false);
    assert.strictEqual(store.getState().runId, null);
    assert.strictEqual(store.getState().resolvedRunId, 6);
  });

  it('stops polling immediately on a Compute error and shows its phase message', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [{
        RUNID: 7,
        SESSION_STATUS: 'OPEN',
        STATUS: 'DONE',
        GROUP_STATUS: 'DONE',
        COMPUTE_STATUS: 'ERROR',
        COMPUTE_ERRORMSG: 'Compute failed on live stock.'
      }] })
    });
    store.dispatch({ type: 'SET_RUN_LAUNCH', payload: { polling: true, runId: 7 } });
    const seq = store._beginRequest('run');

    await store._pollRun(7, seq);

    assert.strictEqual(store.getState().runLaunch.polling, false);
    assert.strictEqual(store.getState().runLaunch.error, 'Compute failed on live stock.');
  });

  it('stops polling on a wrapper ERRORMSG even when phase statuses are not ERROR', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({
      history: async () => ({ rows: [{
        RUNID: 8,
        SESSION_STATUS: 'OPEN',
        STATUS: 'DONE',
        GROUP_STATUS: 'DONE',
        COMPUTE_STATUS: 'DONE',
        ERRORMSG: 'FinishRun precondition failed.'
      }] })
    });
    store.dispatch({ type: 'SET_RUN_LAUNCH', payload: { polling: true, runId: 8 } });
    const seq = store._beginRequest('run');

    await store._pollRun(8, seq);

    assert.strictEqual(store.getState().runLaunch.polling, false);
    assert.strictEqual(store.getState().runLaunch.error, 'FinishRun precondition failed.');
  });

  it('abandons an OPEN run, stops polling and refreshes history', async () => {
    const store = new MinmaxEngineStore();
    const calls = [];
    store._getService = () => ({
      abandonRun: async (payload) => calls.push({ method: 'abandonRun', payload }),
      history: async () => ({ rows: [{ RUNID: 6, SESSION_STATUS: 'ABANDONED' }] })
    });
    store.dispatch({ type: 'SET_RUN_LAUNCH', payload: { polling: true, runId: 6 } });

    const ok = await store.abandonRun(6);

    assert.strictEqual(ok, true);
    assert.strictEqual(calls[0].payload.runId, 6);
    assert.strictEqual(store.getState().runLaunch.polling, false);
    assert.strictEqual(store.getState().runHistory[0].SESSION_STATUS, 'ABANDONED');
  });

  it('counts a history failure as a retryable polling error', async () => {
    const store = new MinmaxEngineStore();
    store._getService = () => ({ history: async () => { throw new Error('network blip'); } });
    const seq = store._beginRequest('run');

    await store._pollRun(6, seq, 99, 2);

    assert.strictEqual(store.getState().runLaunch.polling, false);
    assert.strictEqual(store.getState().runLaunch.error, 'network blip');
  });
});

// Store test for FAZA5_REMEDIERI_PLAN.md Pasul 5 (§12.7): a monotonic request
// sequence per async flow, so a stale response resolved AFTER a newer one for
// the same flow never overwrites fresher state. Every test drives the race
// with hand-controlled ("deferred") promises resolved in reverse order —
// exactly the scenario the plan calls out (older request settles last).
describe('minmax-engine-store — request sequencing (§12.7)', () => {
  let MinmaxEngineStore;

  before(async () => {
    global.sessionStorage = global.window.sessionStorage;
    global.sessionStorage.setItem('s1Token', 'test-token');
    ({ MinmaxEngineStore } = await import('../../public/stores/minmax-engine-store.js'));
  });

  function deferred () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, reject, resolve };
  }

  it('loadResults(): page 2 resolved after page 3 does not overwrite the newer page', async () => {
    const store = new MinmaxEngineStore();
    const page2 = deferred();
    const page3 = deferred();
    const responses = [page2, page3];
    let call = 0;
    store._getService = () => ({ results: async () => responses[call++].promise });

    store.setPage(2);
    const p1 = store.loadResults({ withTotal: false });
    store.setPage(3);
    const p2 = store.loadResults({ withTotal: false });

    // Reverse order: the newer request (page 3) settles first.
    page3.resolve({ page: 3, pageSize: 100, rows: [{ MTRL: 3 }], runId: 5, total: 999 });
    await p2;
    assert.strictEqual(store.getState().rows[0].MTRL, 3);
    assert.strictEqual(store.getState().loading, false);

    // The older request (page 2) settles last and must be discarded entirely.
    page2.resolve({ page: 2, pageSize: 100, rows: [{ MTRL: 2 }], runId: 5, total: 999 });
    await p1;

    assert.strictEqual(store.getState().rows[0].MTRL, 3, 'the stale page-2 response must not overwrite page-3 state');
    assert.strictEqual(store.getState().page, 3);
    assert.strictEqual(store.getState().loading, false, 'the stale response finally-block must not flip loading back on');
  });

  it('loadGroupAbc(): two different filter sets resolved in reverse order keep only the later one', async () => {
    const store = new MinmaxEngineStore();
    const setA = deferred();
    const setB = deferred();
    const responses = [setA, setB];
    let call = 0;
    store._getService = () => ({ groupAbc: async () => responses[call++].promise });

    const p1 = store.loadGroupAbc({ branches: [1000] }, { withTotal: true });
    const p2 = store.loadGroupAbc({ branches: [2000] }, { withTotal: true });

    setB.resolve({ page: 1, pageSize: 100, rows: [{ ABC: 'B-set' }], runId: 5, total: 7 });
    await p2;
    assert.strictEqual(store.getState().groupAbc.rows[0].ABC, 'B-set');

    setA.resolve({ page: 1, pageSize: 100, rows: [{ ABC: 'A-set' }], runId: 5, total: 3 });
    await p1;

    assert.strictEqual(store.getState().groupAbc.rows[0].ABC, 'B-set', 'the stale first filter set must not overwrite the newer one');
    assert.strictEqual(store.getState().groupAbc.total, 7);
    assert.strictEqual(store.getState().groupAbc.loading, false);
  });

  it('openExplain(): opening a second article before the first resolves keeps only the second', async () => {
    const store = new MinmaxEngineStore();
    store.dispatch({ type: 'SET_RESULTS', payload: { rows: [], runId: 5 } }); // pretend results() already resolved a run

    const article1 = deferred();
    const article2 = deferred();
    const responses = [article1, article2];
    let call = 0;
    store._getService = () => ({ explain: async () => responses[call++].promise });

    const p1 = store.openExplain(1000, 111);
    const p2 = store.openExplain(1000, 222);

    article2.resolve({ series: [], summary: { mtrl: 222 } });
    await p2;
    assert.strictEqual(store.getState().explain.mtrl, 222);
    assert.strictEqual(store.getState().explain.data.summary.mtrl, 222);

    article1.resolve({ series: [], summary: { mtrl: 111 } });
    await p1;

    assert.strictEqual(store.getState().explain.data.summary.mtrl, 222, 'the stale first-article response must not overwrite the second');
  });

  it('closeExplain(): a response arriving after the drawer was closed is discarded', async () => {
    const store = new MinmaxEngineStore();
    store.dispatch({ type: 'SET_RESULTS', payload: { rows: [], runId: 5 } });

    const pending = deferred();
    store._getService = () => ({ explain: async () => pending.promise });

    const p = store.openExplain(1000, 111);
    store.closeExplain();

    pending.resolve({ series: [], summary: { mtrl: 111 } });
    await p;

    assert.strictEqual(store.getState().explain.open, false);
    assert.strictEqual(store.getState().explain.data, null, 'a response for an already-closed drawer must not populate data');
  });

  it('loadHistory(): a stale response resolved after a newer refresh is discarded', async () => {
    const store = new MinmaxEngineStore();
    const first = deferred();
    const second = deferred();
    const responses = [first, second];
    let call = 0;
    store._getService = () => ({ history: async () => responses[call++].promise });

    const p1 = store.loadHistory();
    const p2 = store.loadHistory();

    second.resolve({ rows: [{ RUNID: 9 }] });
    await p2;
    assert.strictEqual(store.getState().runHistory[0].RUNID, 9);

    first.resolve({ rows: [{ RUNID: 1 }] });
    await p1;

    assert.strictEqual(store.getState().runHistory[0].RUNID, 9, 'the stale response must not overwrite the newer history');
    assert.strictEqual(store.getState().loadingHistory, false);
  });

  it('loadParams(): a stale response resolved after a newer refresh is discarded', async () => {
    const store = new MinmaxEngineStore();
    const first = deferred();
    const second = deferred();
    const responses = [first, second];
    let call = 0;
    store._getService = () => ({ params: async () => responses[call++].promise });

    const p1 = store.loadParams();
    const p2 = store.loadParams();

    second.resolve({ branches: [], cov: [], params: [{ PARAMKEY: 'B' }], writesEnabled: false });
    await p2;
    assert.strictEqual(store.getState().params.params[0].PARAMKEY, 'B');

    first.resolve({ branches: [], cov: [], params: [{ PARAMKEY: 'A' }], writesEnabled: false });
    await p1;

    assert.strictEqual(store.getState().params.params[0].PARAMKEY, 'B', 'the stale response must not overwrite the newer params');
    assert.strictEqual(store.getState().params.loading, false);
  });

  it('saveParams(): forwards branch overrides and verifies them after read-back', async () => {
    const store = new MinmaxEngineStore();
    let sent;
    const fresh = {
      branches: [],
      cov: [],
      overrides: [{ BRANCH: 2200, PARAMKEY: 'LT_ZILE', PARAMVALUE: '21', PREFIX: null }],
      params: [],
      writesEnabled: true
    };
    store._authenticatedService = async () => ({
      params: async () => fresh,
      saveParams: async (payload) => { sent = payload; }
    });

    const ok = await store.saveParams({
      overrideUpdates: [{ branch: 2200, paramKey: 'LT_ZILE', paramValue: '21' }]
    });

    assert.strictEqual(ok, true);
    assert.deepStrictEqual(sent.overrideUpdates, [{ branch: 2200, paramKey: 'LT_ZILE', paramValue: '21' }]);
    assert.deepStrictEqual(store.getState().params.overrides, fresh.overrides);
  });
});
