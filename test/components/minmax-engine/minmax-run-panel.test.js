import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-run-panel — Phase 6 launch button', () => {
  let MinmaxRunPanel;
  let setAppToken;

  before(async () => {
    ({ setAppToken } = await import('../../../public/stores/app-auth.js'));
    ({ MinmaxRunPanel } = await import('../../../public/components/minmax-engine/minmax-run-panel.js'));
  });

  function jwtWithRoles (roles) {
    const payload = Buffer.from(JSON.stringify({ roles })).toString('base64url');
    return `header.${payload}.signature`;
  }

  function mount ({ open = false, polling = false, writesEnabled = true } = {}) {
    const element = new MinmaxRunPanel();
    const calls = [];
    element._store = {
      getState: () => ({ params: { writesEnabled } }),
      abandonRun: (runId) => calls.push(`abandonRun:${runId}`),
      runEngine: (options) => calls.push(`runEngine:${options.branchAssignmentMode}`)
    };
    element.writesEnabled = writesEnabled;
    element.canEdit = true;
    element.runLaunch = { error: '', polling, runId: polling ? 6 : null, starting: false };
    element.runHistory = open ? [{ RUNID: 6, SESSION_STATUS: 'OPEN' }] : [];
    document.body.appendChild(element);
    return { calls, element };
  }

  afterEach(() => {
    setAppToken(null);
    document.body.innerHTML = '';
  });

  it('is disabled when writes are off, edit role is absent, or a run is OPEN', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    let mounted = mount({ writesEnabled: false });
    await mounted.element.updateComplete;
    assert.strictEqual(mounted.element.querySelector('button[title="Porneste o sesiune MIN/MAX noua"]').disabled, true);

    mounted.element.remove();
    setAppToken(jwtWithRoles(['minmax.read']));
    mounted = mount();
    mounted.element.canEdit = false;
    await mounted.element.updateComplete;
    assert.strictEqual(mounted.element.querySelector('button[title="Porneste o sesiune MIN/MAX noua"]').disabled, true);

    mounted.element.remove();
    setAppToken(jwtWithRoles(['minmax.edit']));
    mounted = mount({ open: true });
    await mounted.element.updateComplete;
    assert.strictEqual(mounted.element.querySelector('button[title="Porneste o sesiune MIN/MAX noua"]').disabled, true);
  });

  it('asks for confirmation and launches exactly once when enabled', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { calls, element } = mount();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await element.updateComplete;
      element.querySelector('button[title="Porneste o sesiune MIN/MAX noua"]').click();
      assert.deepStrictEqual(calls, ['runEngine:CLIENT']);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('launches with the branch assignment mode selected for this run', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { calls, element } = mount();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await element.updateComplete;
      const select = element.querySelector('#minmax-branch-assignment-mode');
      select.value = 'AGENT';
      select.dispatchEvent(new Event('change'));
      element.querySelector('button[title="Porneste o sesiune MIN/MAX noua"]').click();
      assert.deepStrictEqual(calls, ['runEngine:AGENT']);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('offers explicit abandon recovery for an OPEN session', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { calls, element } = mount({ open: true });
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await element.updateComplete;
      element.querySelector('button[title="Abandoneaza sesiunea blocata"]').click();
      assert.deepStrictEqual(calls, ['abandonRun:6']);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('disables abandon while the Agent job is being polled', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { calls, element } = mount({ open: true, polling: true });

    await element.updateComplete;
    const button = element.querySelector('button[title="Abandoneaza sesiunea blocata"]');
    assert.strictEqual(button.disabled, true);
    button.click();
    assert.deepStrictEqual(calls, []);
  });

  it('does not allow an OPEN history row to become the results selector', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount({ open: true });
    let selected = false;
    element._store.setRunId = () => { selected = true; };
    element._store.loadResults = () => { selected = true; };

    await element.updateComplete;
    const row = element.querySelector('tbody tr');
    const radio = row.querySelector('input[type="radio"]');
    assert.strictEqual(radio.disabled, true);
    row.click();
    assert.strictEqual(selected, false);
  });

  // Anexa §B6/§B7: compact collapsible history + DONE no longer a green badge.
  it('collapses the history table behind a summary naming the current run (§B6)', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount({ open: true });
    element.resolvedRunId = 6;
    await element.updateComplete;

    const details = element.querySelector('details');
    assert.ok(details, 'history table wrapped in <details>');
    assert.ok(!details.open, 'collapsed by default');
    assert.ok(details.querySelector('summary').textContent.includes('RUNID 6'), 'summary names the current run');
    assert.ok(details.querySelector('table'), 'table lives inside the collapsible region');
  });

  it('renders DONE as plain muted text, keeping badges only for OPEN/ERROR (§B7)', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount();
    element.runHistory = [
      { RUNID: 5, SESSION_STATUS: 'DONE', COMPUTE_STATUS: 'DONE', GROUP_STATUS: 'DONE' },
      { RUNID: 6, SESSION_STATUS: 'OPEN', COMPUTE_STATUS: 'ERROR', GROUP_STATUS: 'DONE' }
    ];
    await element.updateComplete;

    const rows = [...element.querySelectorAll('tbody tr')];
    const doneRow = rows[0];
    const mixedRow = rows[1];
    assert.ok(!doneRow.querySelector('.badge.bg-success'), 'DONE row has no green badges');
    assert.ok(doneRow.textContent.includes('DONE'), 'status text still visible');
    assert.ok(mixedRow.querySelector('.badge.bg-warning'), 'OPEN stays a warning badge');
    assert.ok(mixedRow.querySelector('.badge.bg-danger'), 'ERROR stays a danger badge');
  });

  it('shows the active phase and elapsed phase durations while a run is OPEN', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount({ open: true, polling: true });
    element.runHistory = [{
      RUNID: 8,
      SESSION_STATUS: 'OPEN',
      STATUS: 'DONE',
      CLASSIFY_DURATA_SEC: 63,
      GROUP_STATUS: 'RUNNING',
      GROUP_DURATA_SEC: 4,
      COMPUTE_STATUS: null,
      SESSION_DURATA_SEC: 67
    }];
    await element.updateComplete;

    const progress = element.querySelector('.minmax-run-progress').textContent.replace(/\s+/g, ' ').trim();
    assert.ok(progress.includes('RUNID 8'));
    assert.ok(progress.includes('Faza: Clasificare grupe'));
    assert.ok(progress.includes('Total: 1m 7s'));
    assert.ok(progress.includes('Clasificare: 1m 3s'));
    assert.ok(progress.includes('Grupe: 4s'));
    assert.ok(progress.includes('Compute: -'));
    const historyCells = [...element.querySelectorAll('tbody tr td')];
    assert.strictEqual(historyCells.at(-1).textContent.trim(), '-', 'OPEN run must not expose classify FINISHEDAT as session final');
  });

  it('shows an OPEN phase failure without a running spinner', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount({ open: true });
    element.runHistory = [{
      RUNID: 8,
      SESSION_STATUS: 'OPEN',
      STATUS: 'DONE',
      GROUP_STATUS: 'ERROR',
      GROUP_ERRORMSG: 'Clasificarea pe grupe a esuat.'
    }];
    await element.updateComplete;

    const progress = element.querySelector('.minmax-run-progress');
    assert.ok(progress.classList.contains('alert-danger'));
    assert.ok(progress.textContent.includes('Eroare clasificare grupe'));
    assert.ok(progress.textContent.includes('Clasificarea pe grupe a esuat.'));
    assert.ok(!progress.querySelector('.fa-spin'));
  });

  it('renders ISO timestamps and phase durations in history', async () => {
    setAppToken(jwtWithRoles(['minmax.edit']));
    const { element } = mount();
    element.runHistory = [{
      RUNID: 8,
      SESSION_STATUS: 'DONE',
      STATUS: 'DONE',
      CLASSIFY_DURATA_SEC: 63,
      GROUP_STATUS: 'DONE',
      GROUP_DURATA_SEC: 30,
      COMPUTE_STATUS: 'DONE',
      COMPUTE_DURATA_SEC: 39,
      SESSION_DURATA_SEC: 132,
      STARTEDAT: '2026-09-10T21:00:00',
      FINISHEDAT: '2026-09-10T21:02:12'
    }];
    await element.updateComplete;

    const rowText = element.querySelector('tbody tr').textContent.replace(/\s+/g, ' ').trim();
    assert.ok(rowText.includes('1m 3s'));
    assert.ok(rowText.includes('30s'));
    assert.ok(rowText.includes('39s'));
    assert.ok(rowText.includes('2m 12s'));
    assert.ok(rowText.includes('10.09.2026'));
  });
});