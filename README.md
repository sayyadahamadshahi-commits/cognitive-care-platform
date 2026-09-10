# Cognitive Assessment Platform

A comprehensive digital cognitive assessment platform modeled on Cambridge Brain Sciences / Creyos. Single-file, self-contained HTML application — no server, no dependencies, no build step.

**[Launch the Platform](https://1ps0.github.io/cbrain-sciences/)**

## What It Does

- **12 Cognitive Tasks** across 4 domains (Memory, Reasoning, Concentration, Verbal Ability), each with adaptive difficulty, real-time scoring, and validity detection
- **12 Behavioral Health Questionnaires** (PHQ-9, GAD-7, PSS, PCL-5, ASRS, SWAN, VADRS, RPQ, IADL, IQCODE-SR, ORT, PMQ) with auto-scoring and clinical cutoffs
- **5 Clinical Protocols** (Dementia Screener, Dementia Assessment, ADHD Assessment, Concussion, Full Battery) plus a custom protocol builder
- **Scoring Engine** with normative comparisons (age × sex adjusted), Bayesian regression-to-mean, domain composites, and Reliable Change Index for longitudinal tracking
- **Clinical Reports** with SVG visualizations (bell curves, bar charts, trend lines, heatmaps), protocol-specific summaries (DSM-5 classification, ADHD markers), and print-ready PDF output
- **Data Persistence** via localStorage with JSON export/import for backup and transfer

## Quick Start

Open `index.html` in any modern browser. That's it.

- **Desktop:** Double-click the file, or drag it into Chrome/Safari/Firefox
- **Mobile:** Save to Files (iOS) or Downloads (Android), open in browser
- **Hosted:** Visit the GitHub Pages link above

No internet connection required after initial load. All data stays in your browser.

## The 12 Cognitive Tasks

| Domain | Task | Type | Measures |
|--------|------|------|----------|
| Memory | Spatial Span | Untimed, adaptive | Spatial short-term memory (Corsi blocks) |
| Memory | Token Search | Untimed, adaptive | Working memory (self-ordered search) |
| Memory | Number Ladder | Untimed, adaptive | Visuospatial working memory |
| Memory | Paired Associates | Untimed, adaptive | Episodic memory (object-location binding) |
| Reasoning | Rotations | Timed 90s, adaptive | Mental rotation (Shepard & Metzler) |
| Reasoning | Polygons | Timed 90s, adaptive | Visuospatial processing |
| Reasoning | Odd One Out | Timed 180s, adaptive | Deductive reasoning (Cattell) |
| Reasoning | Spatial Planning | Timed 180s, adaptive | Planning / executive function (Tower of London) |
| Concentration | Feature Match | Timed 90s, adaptive | Attention / perceptual speed |
| Concentration | Double Trouble | Timed 90s, fixed | Response inhibition (Stroop) |
| Verbal | Grammatical Reasoning | Timed 90s, fixed | Verbal reasoning (Baddeley) |
| Verbal | Digit Span | Untimed, adaptive | Verbal short-term memory (WAIS) |

## Scoring

- **Standard Scores:** Mean 100, SD 15 (same scale as IQ tests), adjusted for age and sex
- **Bayesian Adjustment:** Regression-to-mean correction using task-specific test-retest reliability
- **Normative Data:** Synthetic dataset modeled on published cognitive aging research (Hampshire et al., 2012). Scores are approximate and should not be used as sole basis for clinical diagnosis.
- **Domain Composites:** Weighted z-scores using factor loadings from the Hampshire three-factor model
- **Meaningful Change:** Reliable Change Index with practice effect correction for longitudinal monitoring

## Clinical Protocols

| Protocol | Tasks | Questionnaires | Time | Output |
|----------|-------|----------------|------|--------|
| Dementia Screener | 2 | — | ~5 min | Binary screen |
| Dementia Assessment | 6 | IADL, IQCODE, PHQ-9, GAD-7 | ~30 min | DSM-5 classification |
| ADHD Assessment | 5 | ASRS/SWAN (age-adaptive) | ~25 min | 14-marker analysis |
| Concussion | 4 | RPQ | ~20 min | Attention/memory summary |
| Full Battery | 12 | PHQ-9, GAD-7 | ~45 min | Comprehensive profile |
| Custom | Any | Any | Variable | Configurable |

## AI Assistant & Voice

The app includes a chat assistant on the **Assistant** tab that can build routines, summarize
progress, and answer questions about a selected patient — plus a microphone button for speaking
to it and spoken replies.

- **Built-in mode** (default): works fully offline, no setup, no key. Deterministic answers
  generated from the patient's own scores.
- **Backend Server mode** (recommended if you want real AI answers): run the FastAPI server in
  `backend/` with your OpenAI key in its `.env` file, then set the backend URL in
  *Assistant → AI Settings*. Your key stays on the server and is never sent to the browser.
- **Direct API mode** (advanced): paste a Claude/OpenAI key straight into the browser. Quick to
  try, but the key is stored in this browser's local storage and sent directly to the provider —
  use Backend Server mode instead if you can.

Any failure in Backend/Direct mode automatically falls back to the built-in engine.

**Voice Chat** (hands-free): tap the mic once for a single spoken message, or "Voice Chat" for a
continuous voice-to-voice conversation — it listens, replies out loud, and starts listening again
automatically. Voice requires a secure context (the hosted GitHub Pages link, or `https://`/
`localhost`) — it will not work if you open the file directly from disk (`file://`).

### Running the backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # then paste your OPENAI_API_KEY into .env
uvicorn server:app --reload --port 8000
```

Then in the app: **Assistant → AI Settings → Backend Server**, set the URL to
`http://127.0.0.1:8000` (or wherever you deploy it), and hit **Test connection**.

## Data & Privacy

All data stays local. No server, no telemetry, no external requests.

- **localStorage:** Auto-saves after every change. Data persists across browser sessions.
- **JSON Export:** Download complete patient records, scores, and trial-level data.
- **JSON Import:** Merge data from exports with UUID-based deduplication.
- **Print/PDF:** Browser print dialog produces clinical-quality multi-page reports.

## Technical Details

- **Architecture:** Single self-contained HTML file (~15,700 lines). CSS + JavaScript inlined. No external dependencies.
- **Task Engine:** HTML5 Canvas with `performance.now()` timing, DPR-aware rendering, seeded PRNG for deterministic stimulus generation.
- **Browser Support:** Chrome, Safari, Firefox, Edge (last 2 versions). Desktop, tablet, mobile. Mouse and touch input.
- **Accessibility:** WCAG 2.1 AA on admin interface. SVG charts with aria-labels. Dual encoding (color + text/pattern).

## Project Documentation

Design and development artifacts are in the `docs/` directory:

- `cognitive-assessment-design-doc.docx` — Original design specification
- `BUILD-PLAN.md` — Implementation plan (8 phases)
- `V2-PLAN.md` — Post-v1 roadmap
- `PERSONAS.md` — Team personas used during design
- `ICEBREAKER.md` — Initial design discussion
- `BREAKOUT-*.md` — Deep-dive sessions on task engine, scoring, and reporting
- `AGENTS.md` — Standing directives
- `BLOCKERS.md` — Decision log

## License

MIT
