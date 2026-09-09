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
});