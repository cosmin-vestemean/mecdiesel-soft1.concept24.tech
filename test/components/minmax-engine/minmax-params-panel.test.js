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
});
