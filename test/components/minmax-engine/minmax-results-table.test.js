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

  it('renders the group name while retaining the group identifiers in the row data', async () => {
    const el = mount();
    el.rows = [{ MTRGROUP: 123, MTRGROUP_CODE: 'G123', MTRGROUP_NAME: 'Piese motor' }];
    await el.updateComplete;

    const headers = [...el.querySelectorAll('table thead th')].map((header) => header.textContent.trim());
    const groupHeader = headers.findIndex((header) => header === 'Grupa');
    const groupCell = el.querySelectorAll('table tbody tr')[0].children[groupHeader];

    assert.ok(groupCell, 'expected a rendered Grupa cell');
    assert.strictEqual(groupCell.textContent.trim(), 'Piese motor');
    assert.ok(!groupCell.textContent.includes('123'));
    assert.strictEqual(el.rows[0].MTRGROUP, 123);
    assert.strictEqual(el.rows[0].MTRGROUP_CODE, 'G123');
  });
});

// Anexa (ergonomie UI, 08.09.2026) — hierarchy, redundancy removal, counter.
describe('minmax-results-table — Anexa filter ergonomics', () => {
  before(async () => {
    // Reuse the module already imported above.
  });

  function mount () {
    const el = document.createElement('minmax-results-table');
    document.body.appendChild(el);
    el._draftFilters = { branches: [], clasa: [], codeLike: '', engMin: {}, flagTxt: [], lifecycle: [], statusTrend: [] };
    return el;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('groups filters into three levels with an always-visible level 1', async () => {
    const el = mount();
    await el.updateComplete;

    // Nivel 1 always visible: Cod, Filiala, Flag, Clasa, Trend.
    const level1 = el.querySelector('.filters-panel > .row');
    assert.ok(level1.textContent.includes('Cod (prefix)'), 'level 1 has Cod');
    assert.ok(level1.textContent.includes('Filiale'), 'level 1 has Filiala');
    assert.ok(level1.textContent.includes('Flag'), 'level 1 has Flag');
    assert.ok(level1.textContent.includes('Clasa'), 'level 1 has Clasa');

    // Nivel 2 (exceptions) expanded by default; Nivel 3 (advanced) collapsed.
    const details = [...el.querySelectorAll('.filters-panel details')];
    assert.strictEqual(details.length, 2, 'exactly two collapsible levels');
    assert.ok(details[0].open, 'exceptions level expanded by default');
    assert.ok(!details[1].open, 'advanced level collapsed by default');
    assert.ok(details[0].textContent.includes('Excepții'), 'level 2 labelled as exceptions');
    assert.ok(details[1].textContent.includes('avansate'), 'level 3 labelled as advanced');
  });

  it('removes the redundant ABC/XYZ toggle groups, keeping only Clasa (§A2)', async () => {
    const el = mount();
    await el.updateComplete;

    const labels = [...el.querySelectorAll('.filters-panel .small.text-muted')].map((n) => n.textContent.trim());
    assert.ok(!labels.includes('ABC'), 'no standalone ABC filter group');
    assert.ok(!labels.includes('XYZ'), 'no standalone XYZ filter group');
    assert.ok(labels.includes('Clasa'), 'Clasa filter group kept');
  });

  it('shows an active-filter counter chip only when draft filters are set (§A3)', async () => {
    const el = mount();
    await el.updateComplete;

    assert.ok(!el.querySelector('.badge.bg-primary'), 'no chip with empty draft');

    el._draftFilters = { ...el._draftFilters, clasa: ['AX'], engMin: { min: 5 } };
    await el.updateComplete;

    const chip = el.querySelector('.badge.bg-primary');
    assert.ok(chip, 'chip appears once filters are set');
    assert.strictEqual(chip.textContent.trim(), '2 filtre active');
  });

  it('renders SUPRASTOC as a warning (amber), not neutral info (§A5)', async () => {
    const el = mount();
    el.rows = [{ BRANCH: 1000, FLAG_TXT: 'SUPRASTOC' }];
    el._draftFilters = {};
    await el.updateComplete;

    const badge = el.querySelector('tbody .badge');
    assert.ok(badge, 'flag badge rendered');
    assert.ok(badge.classList.contains('bg-warning'), 'SUPRASTOC uses warning colour');
    assert.ok(!badge.classList.contains('bg-info'), 'no longer the neutral info colour');
  });

  it('keeps the results table header sticky (§A4)', async () => {
    const el = mount();
    await el.updateComplete;

    const thead = el.querySelector('.table-responsive thead');
    assert.ok(thead.classList.contains('sticky-top'), 'thead is sticky');
  });
});
