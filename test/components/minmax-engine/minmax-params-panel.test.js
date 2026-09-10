// Component test for FAZA5_REMEDIERI_PLAN.md Pasul 2 (§12.4): the branch
// MARIME `<select>` in minmax-params-panel must bind `.selected` per
// `<option>`. Unlike the results-table page-size select, `_setBranchField`
// has no store dependency, so this test dispatches a REAL `change` event
// (genuine simulated user interaction) instead of setting a property
// directly, exercising the exact `@change` handler path.
import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-params-panel — branch MARIME select (§12.4)', () => {
  let MinmaxParamsPanel;

  before(async () => {
    ({ MinmaxParamsPanel } = await import('../../../public/components/minmax-engine/minmax-params-panel.js'));
  });

  function mount () {
    const el = document.createElement('minmax-params-panel');
    document.body.appendChild(el);
    el.branches = [{ BRANCH: 2200, ESTE_HQ: 0, ESTE_PODEA: 0, INCLUS: 1, MARIME: 'MEDIU' }];
    el.overrides = [{ BRANCH: 2200, PARAMKEY: 'LT_ZILE', PARAMVALUE: '21', PREFIX: '' }];
    el.params = [
      { PARAMKEY: 'LT_ZILE', PARAMVALUE: '30', SCOPE: 'GLOBAL', SCOPEKEY: '' },
      { PARAMKEY: 'FRECVENTA_ZILE', PARAMVALUE: '14', SCOPE: 'GLOBAL', SCOPEKEY: '' }
    ];
    el.writesEnabled = true;
    return el;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('selects the option matching the row MARIME (MEDIU)', async () => {
    const el = mount();
    await el.updateComplete;

    const select = el.querySelector('select[aria-label="Marime filiala"]');
    assert.ok(select, 'expected a branch MARIME <select>');
    const selected = [...select.options].filter((o) => o.selected).map((o) => o.value);
    assert.deepStrictEqual(selected, ['MEDIU']);
  });

  it('re-renders the selection after a real change event (MARE/MEDIU/MIC)', async () => {
    const el = mount();
    await el.updateComplete;

    for (const marime of ['MARE', 'MIC', 'MEDIU']) {
      const select = el.querySelector('select[aria-label="Marime filiala"]');
      select.value = marime;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await el.updateComplete;

      const afterSelect = el.querySelector('select[aria-label="Marime filiala"]');
      const selected = [...afterSelect.options].filter((o) => o.selected).map((o) => o.value);
      assert.deepStrictEqual(selected, [marime], `expected only ${marime} selected after switching to it`);
    }
  });

  it('renders the three configuration sections as ordered tabs', async () => {
    const el = mount();
    await el.updateComplete;

    const tabs = [...el.querySelectorAll('[role="tab"]')];
    assert.deepStrictEqual(
      tabs.map((tab) => tab.textContent.trim()),
      ['Parametri globali', 'Matricea COV_TGT', 'Configurare filiale']
    );
    assert.strictEqual(tabs[0].getAttribute('aria-selected'), 'true');
    assert.ok(el.querySelector('#minmax-params-tab:not([hidden])'));
    assert.ok(el.querySelector('#minmax-cov-tab[hidden]'));

    tabs[1].click();
    await el.updateComplete;

    assert.strictEqual(tabs[1].getAttribute('aria-selected'), 'true');
    assert.ok(el.querySelector('#minmax-cov-tab:not([hidden])'));
    assert.ok(el.querySelector('#minmax-params-tab[hidden]'));
  });

  it('saves a branch override and clears an existing one to restore global fallback', async () => {
    const el = mount();
    let payload;
    el._store = { saveParams: (value) => { payload = value; } };
    el._activeTab = 'branches';
    await el.updateComplete;

    const lt = el.querySelector('[aria-label="LT_ZILE filiala 2200"]');
    const frecventa = el.querySelector('[aria-label="FRECVENTA_ZILE filiala 2200"]');
    assert.strictEqual(lt.value, '21');
    assert.strictEqual(frecventa.value, '');
    assert.strictEqual(frecventa.placeholder, 'Global: 14');

    lt.value = '';
    lt.dispatchEvent(new Event('change', { bubbles: true }));
    frecventa.value = '10';
    frecventa.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    el.querySelector('.btn-primary').click();

    assert.deepStrictEqual(payload.overrideUpdates, [
      { branch: 2200, paramKey: 'LT_ZILE', paramValue: '' },
      { branch: 2200, paramKey: 'FRECVENTA_ZILE', paramValue: '10' }
    ]);
  });

  it('removes the draft when an override is changed back to its original value', async () => {
    const el = mount();
    el._activeTab = 'branches';
    await el.updateComplete;

    const lt = el.querySelector('[aria-label="LT_ZILE filiala 2200"]');
    lt.value = '22';
    lt.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    assert.strictEqual(el._dirtyCount, 1);

    const rerendered = el.querySelector('[aria-label="LT_ZILE filiala 2200"]');
    rerendered.value = '21';
    rerendered.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    assert.strictEqual(el._dirtyCount, 0);
  });
});
