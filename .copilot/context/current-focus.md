# Current Focus

## Last Updated
- 14.08.2026 (session 1)

## Current Goal
- Verified the MIN/MAX Engine v5 HYBRID design docs (`new_min_max/`) against the two client-authoritative DOCX files and against live SoftOne ERP data.
- Found and corrected a major analysis error: an earlier finding claimed HQ (branch 1000) has real sales (26,123 lines), contradicting the client spec's "HQ = pure aggregator" claim. Re-verified: 99.6% of HQ's lines are `TPRMS 9999 "Fara tranzactie"` (technical docs), only 92 are statistical sales. The client spec was right; our prior finding was wrong (caused by counting sales lines without the `TPRMS.flg04=1 AND flg10=1` filter).
- Rebuilt `new_min_max/SUMAR_TEORETIC_CONFIRMARE.md` (client-facing confirmation doc) with a provenance system (`[S]`=client spec, `[E]`=email/meeting notes, `[D]`=our own deduction) so the client can distinguish what they actually confirmed from what we inferred.
- Converted that doc to PDF locally (`new_min_max/SUMAR_TEORETIC_CONFIRMARE.pdf`) with working KaTeX-rendered formulas (26/26, 0 errors) and diacritics stripped per user request.
- Reviewed `new_min_max/PLAN_IMPLEMENTARE.md` and identified corrections needed, prioritized by the client's document-authority hierarchy (DOCX > email/meeting notes > our own `.md` analysis).

## Active Area
- `new_min_max/` — pre-implementation analysis/confirmation phase for the MIN/MAX Engine v5 HYBRID; no engine code written yet, only analysis docs. Plan corrections identified but not yet applied to `PLAN_IMPLEMENTARE.md`.

## Relevant Files
**Client-authoritative source (highest trust):**
- `new_min_max/analiza/Spec_ERP_MinMax_v5_FINAL.docx` — client spec, ground truth for formulas/rules.
- `new_min_max/analiza/Raspuns_Clarificari_MinMax.docx` — client's clarification answers.

**Our analysis docs (lower trust, being corrected):**
- `new_min_max/SUMAR_TEORETIC_CONFIRMARE.md` — client-facing confirmation doc; just corrected with provenance tags, HQ finding reversed, F5/F9/I7/I11 flagged as unconfirmed deviations from spec.
- `new_min_max/SUMAR_TEORETIC_CONFIRMARE.pdf` — rendered PDF of the above, regenerated after each correction.
- `new_min_max/PLAN_IMPLEMENTARE.md` — implementation plan; reviewed, corrections identified but NOT yet applied (see Open Questions).
- `new_min_max/analiza/SINTEZA_FINALA.md` — internal synthesis doc; source of several deviations from the client DOCX (flag handling, netting/winsorization order, `SAPT_FARA` threshold).

**Tooling built this session (in /tmp, not part of repo):**
- `/tmp/md2pdf.py` — markdown-to-PDF converter (markdown-it-py + KaTeX + Playwright/Chromium), math isolated from markdown parsing to avoid `\_` corruption.
- `/tmp/fix_math.py` — one-off script that wrapped multi-letter field identifiers in `\mathrm{}` across all 26 formula blocks (already applied to the .md, not needed again unless more formulas are added).
- Chromium + missing shared libs staged under `/tmp/chromedeps/root` (LD_LIBRARY_PATH dependency, not a system install).

## Confirmed Decisions
- Document authority hierarchy for this engagement: (1) client DOCX specs, (2) email/meeting notes we recorded, (3) our own `.md` analysis/deductions. The `.md` files must not present tier-3 content as if it were tier-1 confirmed.
- HQ branch (1000) is a pure aggregator with no real demand — confirmed via TPRMS breakdown, matches client spec. HQ must be sized from company-level aggregated sales, not from lines attributed to branch 1000 directly.
- Sales-line statistics must always state whether the `TPRMS.flg04=1 AND flg10=1` filter was applied (241,285 lines/52w) or not (669,756 lines/52w) — these are frequently conflated in prior analysis and produce very different numbers.
- Client exclusion codes (`MECDIS`, `MECDI2`, `INTE79`) are not unique in `TRDR` (each has 2 partner records) — exclusion logic must filter by `CODE`, not by a single internal ID.
- PDF conversion pipeline: Linux-side Playwright+Chromium+KaTeX (local, offline-capable), not the Python-executor MCP host (different machine, no browser/TeX available, can't write back large files easily).

## Open Questions
- **F5/safety stock formula**: client DOCX still specifies `safety = (AVG × 0.30/30) × SSF × sqrt(LT)` with SSF 1.28–1.65 per supplier prefix. Our analysis docs replaced this with `σ_WK` (real weekly stdev) + flat SSF=1.28, sourced from an internal 13.08.2026 revision attributed to the Italy team — **not confirmed in writing by the client**. Proposed: implement both, switchable by parameter, decide via parallel validation run.
- **F9/external flags**: client spec §3.11 says BLOCAT/EXCLUDE/LICHIDARE flags are informational only (no effect on MIN/MAX/BUY). Our `SINTEZA_FINALA.md`-derived plan zeroes them out instead. Needs explicit client confirmation of which behavior to implement.
- **I7/branch attribution**: sales lines can be attributed by `FINDOC.BRANCH` (document) or `PRSN.BRANCH` (agent) — 34.65% of filtered lines differ between the two modes. Client spec doesn't address this; existing Top ABC report defaults to agent mode. Not yet decided.
- **I11/processing order**: client spec puts winsorization (§3.2) before netting (§3.3); our internal docs had it reversed. Needs client reconfirmation of the corrected order.
- **`SAPT_FARA` threshold**: client spec says ≤39 weeks for HQ but ≤26 for branches; `PLAN_IMPLEMENTARE.md` currently hardcodes ≤39 everywhere — this is a plan defect, not yet fixed.
- Branch inclusion (ARAD 2300, VOLUNTARI 2400, MIHAILESTI 2600, RM VALCEA 2900): plan defaults these to `INCLUS=0` pending client confirmation; Voluntari/RM Valcea have real (if modest) demand — 1,161/1,611 statistical lines respectively.
- `PLAN_IMPLEMENTARE.md` itself has NOT yet been corrected — corrections were identified and discussed with the user but the user had not yet said "go ahead" on the plan file when this session ended (last message was "Trec la plan?" awaiting confirmation).

## Next Step
- Apply the identified corrections to `new_min_max/PLAN_IMPLEMENTARE.md`: fix the HQ company-mode sales-derivation gap, add the branch-attribution parameter, correct the `SAPT_FARA` threshold (39 HQ / 26 branches), and mark the `SIGMA_WK`/flag-handling/netting-order items as unconfirmed deviations from the client spec (mirroring the provenance approach already applied to `SUMAR_TEORETIC_CONFIRMARE.md`).
