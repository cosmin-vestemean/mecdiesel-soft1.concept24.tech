import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-group-abc — group display contract', () => {
  let MinmaxGroupAbc;

  before(async () => {
    ({ MinmaxGroupAbc } = await import('../../../public/components/minmax-engine/minmax-group-abc.js'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the group name while retaining the group identifiers in the row data', async () => {
    const element = document.createElement('minmax-group-abc');
    element.rows = [{ MTRGROUP: 123, MTRGROUP_CODE: 'G123', MTRGROUP_NAME: 'Piese motor' }];
    document.body.appendChild(element);
    await element.updateComplete;

    const headers = [...element.querySelectorAll('table thead th')].map((header) => header.textContent.trim());
    const groupHeader = headers.findIndex((header) => header === 'Grupa');
    const groupCell = element.querySelectorAll('table tbody tr')[0].children[groupHeader];

    assert.ok(groupCell, 'expected a rendered Grupa cell');
    assert.strictEqual(groupCell.textContent.trim(), 'Piese motor');
    assert.ok(!groupCell.textContent.includes('123'));
    assert.strictEqual(element.rows[0].MTRGROUP, 123);
    assert.strictEqual(element.rows[0].MTRGROUP_CODE, 'G123');
  });

  it('renders the ERP branch name in both the table and branch filter', async () => {
    const element = document.createElement('minmax-group-abc');
    element._branches = [{ BRANCH: 1200, BRANCH_NAME: 'Cluj' }];
    element.rows = [{ BRANCH: 1200 }];
    document.body.appendChild(element);
    await element.updateComplete;

    const headers = [...element.querySelectorAll('table thead th')].map((header) => header.textContent.trim());
    const branchHeader = headers.findIndex((header) => header === 'Filiala');
    const branchCell = element.querySelectorAll('table tbody tr')[0].children[branchHeader];
    const branchFilter = [...element.querySelectorAll('.filters-panel button')]
      .find((button) => button.textContent.trim() === 'Cluj');

    assert.strictEqual(branchCell.textContent.trim(), 'Cluj');
    assert.ok(branchFilter, 'expected a branch filter named Cluj');
  });

  it('numbers rows across pages', async () => {
    const element = document.createElement('minmax-group-abc');
    element.page = 2;
    element.pageSize = 100;
    element.rows = [{ BRANCH: 1000 }, { BRANCH: 2200 }];
    document.body.appendChild(element);
    await element.updateComplete;

    const numbers = [...element.querySelectorAll('table tbody tr')]
      .map((row) => row.firstElementChild.textContent.trim());
    assert.deepStrictEqual(numbers, ['101', '102']);
  });

  it('scrolls to the top when changing page', () => {
    const element = document.createElement('minmax-group-abc');
    document.body.appendChild(element);
    const calls = [];
    window.scrollTo = (...args) => calls.push(args);
    const storeCalls = [];
    element._store = {
      setGroupAbcPage: (page) => storeCalls.push(['setGroupAbcPage', page]),
      loadGroupAbc: (filters, options) => storeCalls.push(['loadGroupAbc', filters, options])
    };

    element._goToPage(2);

    assert.deepStrictEqual(calls, [[0, 0]]);
    assert.deepStrictEqual(storeCalls, [
      ['setGroupAbcPage', 2],
      ['loadGroupAbc', element._filters, { withTotal: false }]
    ]);
  });

  it('builds and downloads an Excel workbook for the filtered groups', async () => {
    const element = document.createElement('minmax-group-abc');
    document.body.appendChild(element);
    const calls = [];
    window.XLSX = {
      utils: {
        json_to_sheet: (rows) => ({ rows }),
        book_new: () => ({}),
        book_append_sheet: (workbook, sheet, name) => calls.push(['sheet', workbook, sheet, name])
      },
      writeFile: (workbook, filename) => calls.push(['file', workbook, filename])
    };
    element._branches = [{ BRANCH: 1200, BRANCH_NAME: 'Cluj' }];
    element._store = { exportGroupAbc: async () => ({ rows: [{ BRANCH: 1200, MTRGROUP_NAME: 'Piese', ESTE_HQ: false }], runId: 12 }) };

    await element._exportToExcel();

    assert.strictEqual(calls[0][2].rows[0].Grupa, 'Piese');
  assert.strictEqual(calls[0][2].rows[0].Filiala, 'Cluj');
    assert.strictEqual(calls[0][2].rows[0].HQ, 'Nu');
    assert.strictEqual(calls[0][3], 'Clasificare grupe');
    assert.match(calls[1][2], /^MINMAX_ClasificareGrupe_RUN12_\d{4}-\d{2}-\d{2}\.xlsx$/);
    delete window.XLSX;
  });
});