// Component test for Anexa §B11: the explain drawer renders the ENG_MIN /
// ENG_MAX formula chain with the row's actual values substituted, above the
// raw parameter tables, typeset via KaTeX (feedback 08.09.2026: Unicode
// approximations of √/⌈⌉/σ read as amateurish).
//
// Assertions read the raw TeX source from KaTeX's MathML
// <annotation encoding="application/x-tex"> element rather than parsing the
// rendered visual HTML — the annotation carries the exact string passed to
// katex.renderToString(), so it's a stable target unaffected by KaTeX's
// internal DOM/spacing structure. Plain-Romanian annotations ("(cap HQ
// aplicat)" etc.) are rendered outside KaTeX and are checked via textContent.
import assert from 'assert';
import { register } from 'node:module';
import '../../helpers/browser-env.mjs';

register('../../helpers/cdn-module-loader.mjs', import.meta.url);

describe('minmax-explain-drawer — formula with substituted values (Anexa §B11)', () => {
  let MinmaxExplainDrawer;

  before(async () => {
    ({ MinmaxExplainDrawer } = await import('../../../public/components/minmax-engine/minmax-explain-drawer.js'));
  });

  function mount (det) {
    const el = new MinmaxExplainDrawer();
    el.open = true;
    el.loading = false;
    el.error = '';
    el.data = { det, run: null, runParams: [], weeklySeries: [], winsor: null };
    document.body.appendChild(el);
    return el;
  }

  function formulaBlock (el) {
    return el.querySelector('.minmax-formula-block');
  }

  function formulaText (el) {
    const block = formulaBlock(el);
    return block ? block.textContent.replace(/\s+/g, ' ').trim() : null;
  }

  // The raw TeX strings passed to katex.renderToString(), exactly as given
  // (KaTeX's MathML annotation preserves the source verbatim).
  function annotations (el) {
    const block = formulaBlock(el);
    return block ? [...block.querySelectorAll('annotation')].map((a) => a.textContent) : [];
  }

  function hasTex (el, fragment) {
    return annotations(el).some((a) => a.includes(fragment));
  }

  const baseDet = {
    BRANCH: 1000, MTRL: 123, CODE: 'ABC123', MTRL_NAME: 'Test',
    LIFECYCLE: 'STANDARD', CLASA: 'AX', ABC: 'A', XYZ: 'X', MARIME: 'MIC',
    SIGMA_WK: 1.5, SSF: 1.28, LT_ZILE: 14, SL: 95, ad: 2, AVG: 4,
    COV_TGT: 2.75, FRECVENTA_ZILE: 7, N_PACK: 1, STOC_QTY: 3, ORD_FURN: 0,
    ESTE_HQ: 0, VZ_26S: 50, VZ_52S: 100,
    SAFETY: 3.5, LT_STOCK: 28, SLTS: 1.47, BUF: 33, CYCLE: 14,
    MAX_RAW: 47, MAX_INF: 47, CAP6: 16, VZ26_CAP: 50, MIN_DOC: 1,
    // ENG_MIN = min(MIN_BASE, ENG_MAX) = min(max(ceil(BUF), MIN_DOC), ENG_MAX) = min(33, 16) = 16
    // (MIN_GT_MAX invariant: ENG_MIN must never exceed ENG_MAX — see Pasul 8 nivel A)
    ENG_MIN: 16, ENG_MAX: 16, BUY_RAW: 13, BUY_QTY: 13,
    HQ_CAP_APLICAT: 0, PODEA_APLICATA: 0
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the formula block above the parameter tables, typeset with KaTeX', async () => {
    const el = mount(baseDet);
    await el.updateComplete;

    const headings = [...el.querySelectorAll('h6')].map((h) => h.textContent.trim());
    const formulaIdx = headings.findIndex((h) => h.includes('Formula de calcul'));
    const intrariIdx = headings.findIndex((h) => h === 'Intrari');
    assert.ok(formulaIdx >= 0, 'formula block present');
    assert.ok(intrariIdx >= 0, 'parameter tables still present');
    assert.ok(formulaIdx < intrariIdx, 'formula renders above the parameter tables');
    assert.ok(formulaBlock(el).querySelectorAll('.katex').length > 0, 'KaTeX actually rendered (not a plain-text fallback)');
  });

  it('substitutes the actual ENG_MAX = min(MAX_INF, CAP6, VZ26_CAP) values', async () => {
    const el = mount({ ...baseDet, ENG_MAX: 16 });
    await el.updateComplete;

    assert.ok(hasTex(el, '\\min(47, 16, 50)'), `expected substituted min() values, got annotations: ${annotations(el)}`);
    assert.ok(hasTex(el, 'ENG\\_MAX'), 'ENG_MAX label present in TeX source');
    assert.ok(hasTex(el, 'ENG\\_MIN'), 'ENG_MIN label present in TeX source');
    assert.ok(hasTex(el, 'BUY\\_QTY'), 'BUY_QTY label present in TeX source');
  });

  it('substitutes MIN_BASE = max(ceil(BUF), MIN_DOC) and feeds it into ENG_MIN', async () => {
    const el = mount(baseDet);
    await el.updateComplete;

    assert.ok(hasTex(el, 'MIN\\_BASE'), 'MIN_BASE label present');
    assert.ok(hasTex(el, '\\max(33, 1)'), `expected max(ceil(BUF), MIN_DOC) substituted, got: ${annotations(el)}`);
    assert.ok(hasTex(el, '\\min(33, 16)'), `expected ENG_MIN = min(MIN_BASE, ENG_MAX) substituted, got: ${annotations(el)}`);
  });

  // HQ cap and podea are mutually exclusive in real data (HQ_CAP_APLICAT only
  // ever fires on the ESTE_HQ=1 row; PODEA_APLICATA only on floor branches),
  // so they're tested separately rather than on one contrived row.
  it('shows the SUM_BR_MAX x HqCapFactor formula for an HQ-capped row', async () => {
    const el = mount({
      ...baseDet, ESTE_HQ: 1, HQ_CAP_APLICAT: 1, SUM_BR_MAX: 50, ENG_MAX: 75,
      MAX_INF: 60 // MAX_RAW inflated for HQ — irrelevant once the cap branch wins
    });
    await el.updateComplete;

    assert.ok(hasTex(el, 'SUM\\_BR\\_MAX'), 'SUM_BR_MAX referenced in ENG_MAX line');
    assert.ok(hasTex(el, 'HqCapFactor'), 'HqCapFactor identifier present');
    assert.ok(hasTex(el, '\\left\\lceil 50 \\times 1.5 \\right\\rceil'), `expected substituted SUM_BR_MAX x default factor 1.5, got: ${annotations(el)}`);
    assert.ok(formulaText(el).includes('cap HQ aplicat'), 'HQ cap annotated in plain text');
    assert.ok(hasTex(el, 'InflatieHQ'), 'HQ inflation step shown on MAX_INF for HQ rows');
  });

  it('reads HQ_CAP_FACTOR from the run parameter snapshot instead of the default', async () => {
    const runParams = [{ PARAMKEY: 'HQ_CAP_FACTOR', PARAMVALUE: '2' }];
    const el = mount({ ...baseDet, ESTE_HQ: 1, HQ_CAP_APLICAT: 1, SUM_BR_MAX: 50, ENG_MAX: 100 });
    el.data = { det: el.data.det, run: null, runParams, weeklySeries: [], winsor: null };
    await el.updateComplete;

    assert.ok(hasTex(el, '\\left\\lceil 50 \\times 2 \\right\\rceil'), `expected run-specific factor, got: ${annotations(el)}`);
  });

  it('marks ENG_MAX as equalised to ENG_MIN when podea forces MAX down', async () => {
    const el = mount({ ...baseDet, PODEA_APLICATA: 1, ENG_MIN: 20, ENG_MAX: 20 });
    await el.updateComplete;

    assert.ok(hasTex(el, 'ENG\\_MAX} = ENG\\_MIN'), `expected podea equalisation in TeX, got: ${annotations(el)}`);
    assert.ok(formulaText(el).includes('podea aplicată'), 'ENG_MAX line annotated as podea-driven (plain text)');
  });

  it('falls back to the standard min() formula when podea did not clamp ENG_MAX', async () => {
    // PODEA_APLICATA can theoretically be true without the ENG_MAX clamp firing
    // (SQL only clamps WHEN ENG_MIN > ENG_MAX) — the display must not overclaim.
    const el = mount({ ...baseDet, PODEA_APLICATA: 1, ENG_MIN: 10, ENG_MAX: 16 });
    await el.updateComplete;

    assert.ok(hasTex(el, '\\min(47, 16, 50)'), `expected the base min() formula, not an overclaimed podea label, got: ${annotations(el)}`);
  });

  it('shows the CYCLE short-circuit to 0 when COV_TGT=0 and CzCycleZero is on (default)', async () => {
    const el = mount({ ...baseDet, COV_TGT: 0, CYCLE: 0 });
    await el.updateComplete;

    assert.ok(hasTex(el, 'COV\\_TGT = 0'), `expected CYCLE short-circuit label, got: ${annotations(el)}`);
  });

  it('shows the full max(AVG*COV_TGT, ad*FRECVENTA_ZILE) formula when COV_TGT>0', async () => {
    const el = mount(baseDet);
    await el.updateComplete;

    // AVG=4 * COV_TGT=2.75 = 11; ad=2 * FRECVENTA_ZILE=7 = 14
    assert.ok(hasTex(el, '\\max(11, 14)'), `expected substituted CYCLE inputs, got: ${annotations(el)}`);
  });

  it('shows the session and phase audit times from the run header', async () => {
    const el = mount(baseDet);
    el.data = {
      ...el.data,
      run: {
        RUNID: 8,
        COMPANY: 1000,
        AZI: '2026-09-10',
        SESSION_STATUS: 'DONE',
        STARTEDAT: '2026-09-10T21:00:00',
        FINISHEDAT: '2026-09-10T21:02:12',
        CLASSIFY_DURATA_SEC: 63,
        GROUP_STARTEDAT: '2026-09-10T21:01:03',
        GROUP_FINISHEDAT: '2026-09-10T21:01:33',
        GROUP_DURATA_SEC: 30,
        COMPUTE_STARTEDAT: '2026-09-10T21:01:33',
        COMPUTE_FINISHEDAT: '2026-09-10T21:02:12',
        COMPUTE_DURATA_SEC: 39,
        SESSION_DURATA_SEC: 132
      }
    };
    await el.updateComplete;

    const valueFor = (label) => {
      const row = [...el.querySelectorAll('tr')].find((candidate) => candidate.querySelector('th')?.textContent.trim() === label);
      return row?.querySelector('td')?.textContent.replace(/\s+/g, ' ').trim();
    };
    assert.ok(valueFor('Start clasificare').includes('10.09.2026'));
    assert.ok(valueFor('Final procesare').includes('10.09.2026'));
    assert.strictEqual(valueFor('Durata procesare'), '2m 12s');
    assert.ok(valueFor('Clasificare').includes('1m 3s'));
    assert.ok(valueFor('Clasificare grupe').includes('30s'));
    assert.ok(valueFor('Compute').includes('39s'));
  });

  it('does not show a final processing time for an OPEN run', async () => {
    const el = mount(baseDet);
    el.data = {
      ...el.data,
      run: {
        RUNID: 9,
        COMPANY: 1000,
        SESSION_STATUS: 'OPEN',
        STARTEDAT: '2026-09-10T21:00:00',
        FINISHEDAT: '2026-09-10T21:01:03',
        SESSION_DURATA_SEC: 90
      }
    };
    await el.updateComplete;

    const finalRow = [...el.querySelectorAll('tr')].find((row) => row.querySelector('th')?.textContent.trim() === 'Final procesare');
    assert.strictEqual(finalRow.querySelector('td').textContent.trim(), '-');
  });

  it('locks page scrolling while open and restores it when closed', async () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'scroll';
    const el = mount(baseDet);
    await el.updateComplete;

    assert.strictEqual(document.body.style.overflow, 'hidden');
    assert.strictEqual(document.documentElement.style.overflow, 'hidden');

    el.open = false;
    await el.updateComplete;
    assert.strictEqual(document.body.style.overflow, 'auto');
    assert.strictEqual(document.documentElement.style.overflow, 'scroll');
  });

  it('short-circuits ENG_MIN/ENG_MAX to 0 for OD lifecycle', async () => {
    const el = mount({ ...baseDet, LIFECYCLE: 'OD', ENG_MIN: 0, ENG_MAX: 0, BUY_QTY: 0 });
    await el.updateComplete;

    assert.ok(hasTex(el, 'ENG\\_MAX} = 0'), 'ENG_MAX OD short-circuit shown');
    assert.ok(hasTex(el, 'ENG\\_MIN} = 0'), 'ENG_MIN OD short-circuit shown');
    assert.ok(formulaText(el).includes('(OD)'), 'OD annotated');
  });
});
