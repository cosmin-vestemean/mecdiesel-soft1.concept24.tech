// Component test for FAZA5_REMEDIERI_PLAN.md Pasul 2 (§12.4): the page-size
// `<select>` must bind `.selected` per `<option>`, not `.value` on the
// `<select>` (which sets the DOM attribute once and never updates it again —
// see the plan for why `?selected` is also wrong). This test proves the
// select's rendered selection actually follows `pageSize` across re-renders,
// which a `.value`/`?selected` regression would fail.
//
// Requires jsdom + the CDN->npm module redirect, set up once per process by
// browser-env.mjs / cdn-module-loader.mjs (see test/helpers/).
import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-results-table — page-size select (§12.4)', () => {
  let MinmaxResultsTable;

  before(async () => {
    ({ MinmaxResultsTable } = await import('../../../public/components/minmax-engine/minmax-results-table.js'));
  });

  function mount () {
    const el = document.createElement('minmax-results-table');
    document.body.appendChild(el);
    // Bypasses the store/ContextConsumer requirement (none is provided in
    // this test) — render() only gates on `_draftFilters` being non-null.
    el._draftFilters = {};
    return el;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('selects the option matching the initial pageSize (100, the default)', async () => {
    const el = mount();
    await el.updateComplete;

    const select = el.querySelector('select[aria-label="Marime pagina"]');
    assert.ok(select, 'expected a page-size <select>');
    const selected = [...select.options].filter((o) => o.selected).map((o) => o.value);
    assert.deepStrictEqual(selected, ['100']);
  });

  it('re-renders the selection when pageSize changes after the first render', async () => {
    const el = mount();
    await el.updateComplete;

    el.pageSize = 500;
    await el.updateComplete;

    const select = el.querySelector('select[aria-label="Marime pagina"]');
    const selected = [...select.options].filter((o) => o.selected).map((o) => o.value);
    assert.deepStrictEqual(selected, ['500']);
  });

  it('covers every page-size option (50/100/200/500) as selectable across re-renders', async () => {
    const el = mount();
    await el.updateComplete;

    for (const size of [50, 100, 200, 500]) {
      el.pageSize = size;
      await el.updateComplete;
      const select = el.querySelector('select[aria-label="Marime pagina"]');
      const selected = [...select.options].filter((o) => o.selected).map((o) => o.value);
      assert.deepStrictEqual(selected, [String(size)], `expected only ${size} selected`);
    }
  });
});
