/**
 * Shared UI-facing constants for the MIN/MAX engine components (Faza 5).
 *
 * Mirrors backend enum sets in src/services/minmax-engine/minmax-engine.class.js
 * (CLASA_VALUES etc.) — this only shapes the UI; the backend re-validates
 * independently and is the real guard.
 */

// 11 classes: the 9 ABC x XYZ combinations plus NOU/OD (CLASA mirrors
// LIFECYCLE for non-STANDARD items, per CCCMINMAXCOV's 11x3 seed — §12.5).
// Defined once here so minmax-results-table.js and minmax-group-abc.js never
// drift apart.
export const CLASA_OPTIONS = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD'];
