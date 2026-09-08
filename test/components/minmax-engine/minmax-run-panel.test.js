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
      runEngine: () => calls.push('runEngine')
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
      assert.deepStrictEqual(calls, ['runEngine']);
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
});