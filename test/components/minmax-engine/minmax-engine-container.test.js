import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-engine-container — lazy activation (§12.9)', () => {
  let minmaxEngineStore;

  before(async () => {
    ({ minmaxEngineStore } = await import('../../../public/stores/minmax-engine-store.js'));
    await import('../../../public/components/minmax-engine/minmax-engine-container.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not fetch on mount and initializes each flow once on activation', async () => {
    const calls = [];
    const originals = {};
    for (const method of ['loadHistory', 'loadParams', 'loadResults', 'loadGroupAbc']) {
      originals[method] = minmaxEngineStore[method];
      minmaxEngineStore[method] = async (...args) => { calls.push({ method, args }); };
    }

    try {
      const element = document.createElement('minmax-engine-container');
      document.body.appendChild(element);
      await element.updateComplete;
      assert.deepStrictEqual(calls, []);

      const first = element.activate();
      const second = element.activate();
      assert.strictEqual(first, second);
      await first;

      assert.deepStrictEqual(calls, [
        { method: 'loadHistory', args: [] },
        { method: 'loadParams', args: [] },
        { method: 'loadResults', args: [{ withTotal: true }] },
        { method: 'loadGroupAbc', args: [{}, { withTotal: true }] }
      ]);

      await element.activate();
      assert.strictEqual(calls.length, 4);
    } finally {
      Object.assign(minmaxEngineStore, originals);
    }
  });

  it('switches between results and group classification without unmounting either panel', async () => {
    const element = document.createElement('minmax-engine-container');
    document.body.appendChild(element);
    await element.updateComplete;

    const resultsPanel = element.querySelector('#minmax-results-panel');
    const groupsPanel = element.querySelector('#minmax-groups-panel');

    assert.ok(resultsPanel.querySelector('minmax-results-table'));
    assert.ok(groupsPanel.querySelector('minmax-group-abc'));
    assert.strictEqual(resultsPanel.hidden, false);
    assert.strictEqual(groupsPanel.hidden, true);
    assert.strictEqual(element.querySelector('#minmax-results-tab').getAttribute('aria-selected'), 'true');

    element.querySelector('#minmax-groups-tab').click();
    await element.updateComplete;

    assert.strictEqual(resultsPanel.hidden, true);
    assert.strictEqual(groupsPanel.hidden, false);
    assert.strictEqual(element.querySelector('#minmax-groups-tab').getAttribute('aria-selected'), 'true');
    assert.ok(resultsPanel.querySelector('minmax-results-table'));
    assert.ok(groupsPanel.querySelector('minmax-group-abc'));
  });
});