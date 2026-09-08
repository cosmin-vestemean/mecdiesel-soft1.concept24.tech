/**
 * Shared UI-facing constants for the MIN/MAX engine components (Faza 5).
 *
 * Mirrors backend enum sets in src/services/minmax-engine/minmax-engine.class.js
 * (CLASA_VALUES etc.) — this only shapes the UI; the backend re-validates
 * independently and is the real guard.
 */

import { html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

// 11 classes: the 9 ABC x XYZ combinations plus NOU/OD (CLASA mirrors
// LIFECYCLE for non-STANDARD items, per CCCMINMAXCOV's 11x3 seed — §12.5).
// Defined once here so minmax-results-table.js and minmax-group-abc.js never
// drift apart.
export const CLASA_OPTIONS = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD'];

// Anexa §B7 / feedback 08.09.2026: boolean "Da" renders as a compact green
// dot instead of a green text/badge — keeps the positive signal without
// flooding the table with green. Single definition so all MIN/MAX tables
// render booleans identically.
export function renderBool (value) {
  return value
    ? html`<span class="d-inline-block rounded-circle bg-success" style="width: 10px; height: 10px;" title="Da" aria-label="Da"></span>`
    : html`<span class="text-muted">-</span>`;
}
