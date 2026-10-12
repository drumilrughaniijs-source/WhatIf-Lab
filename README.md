# WhatIf Lab

**What if you could experiment with reality?** Change one variable. Discover another reality.

WhatIf Lab is an interactive simulation platform for computing, artificial intelligence, finance and mathematics, physics, and probability. Every calculation runs in the browser. There is **no backend, no database, no paid API and no API key**. Saved experiments are stored in the visitor's own browser.

Built with React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Recharts and Lucide React.

---

## Quick start

Requirements: **Node.js 22.18 or newer** (needed for the unit tests; the site itself only needs Node to build).

```bash
npm install        # install dependencies
npm run dev        # start the dev server → http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit tests for the simulation models (Node's built-in test runner, no extra dependencies) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm run check` | Type-check, test and build in one go (run this before deploying) |

---

## Deploying for free

`npm run build` produces a fully static site in `dist/`. It uses hash-based URLs (`/#/explore`, `/#/lab/orbital-gravity`) and relative asset paths, so it works on any static host, at the domain root or in a sub-folder, without rewrite rules.

### Vercel
1. Push the project to a GitHub repository.
2. At [vercel.com](https://vercel.com) choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically (settings are also in `vercel.json`). Click **Deploy**.

### Netlify
1. Push the project to GitHub.
2. At [netlify.com](https://netlify.com) choose **Add new site → Import an existing project**.
3. Build settings are read from `netlify.toml` (`npm run build`, publish `dist`). Click **Deploy**.

Or, without Git: run `npm run build` and drag the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

### GitHub Pages
1. Push the project to a GitHub repository with a `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The included workflow (`.github/workflows/deploy-pages.yml`) runs the tests, builds the site and publishes it to `https://<user>.github.io/<repo>/`.

No environment variables or secrets are needed on any host.

### Search engines and link previews
`index.html` includes a search description, a canonical URL, structured data, and Open Graph/Twitter tags with a 1200×630 preview image (`public/og-image.png`). `public/sitemap.xml` lists the home page.

To get listed on Google:
1. Open [Google Search Console](https://search.google.com/search-console), add a **URL prefix** property for `https://drumilrughaniijs-source.github.io/WhatIf-Lab/`, and choose the **HTML tag** verification method.
2. Paste the `<meta name="google-site-verification" …>` tag at the marked spot in `index.html`, push, then click **Verify**.
3. Under **Sitemaps**, submit `sitemap.xml`; then use **URL Inspection → Request indexing** on the home page.

Notes: the canonical URL and preview links point to the GitHub Pages address, so update them in `index.html` and `public/sitemap.xml` if you move to another domain. A `robots.txt` is not included because search engines only read it from the domain root, which a GitHub Pages project site does not control. Because pages use `#/` URLs, search engines index the site as a single page.

---

## What's inside

### Core simulations

| Simulation | Category | What you can change | What it shows |
|---|---|---|---|
| RAM Pressure Lab | Computing | RAM capacity, memory per app, number of apps, swap device | Used/available memory, utilisation, allocation diagram, pressure meter, modelled responsiveness, swap warnings |
| CPU Performance Explorer | Computing | Clock, cores, workload intensity, parallelisable fraction | Estimated run time and throughput, speed-up vs Amdahl's law, comparison with reference CPUs, per-core workload distribution |
| Neural Network Playground | Artificial Intelligence | Dataset, hidden neurons, learning rate, iterations; train / pause / step / reset | Live network weights, decision boundary, loss curve, accuracy, trained with real backpropagation |
| Compound Interest Lab | Finance and Mathematics | Initial investment, monthly contribution, rate, duration, compounding frequency, contribution timing | Contributions, interest, final balance, growth chart, year-by-year table, CSV export |
| Probability Playground | Probability | Coin / die / two dice, trials, coin bias; run and reset | Observed vs theoretical frequencies, differences, chi-square test, running average, run-to-run variation, outcome sequence |
| Orbital Gravity Playground | Physics | Initial speed, distance, relative mass, playback speed; pause / resume / reset | Animated two-body orbit with trails, orbit type, eccentricity, period, separation chart, energy drift |

### More simulations
Sorting Race, Big-O Growth, Gradient Descent, K-Means Clustering, Projectile on Other Worlds, Pendulum Lab, Monte Carlo π, Fourier Builder, Early vs Late Investor and Loan Payoff Planner.

Every simulation page explains its idea, lists its **model and assumptions**, and suggests experiments to try.

### Features
- **Explorer:** search, category and difficulty filters, sorting (recommended, name, difficulty, recently opened). Filters are kept in the URL, so filtered views can be shared.
- **Global search** in the top bar (press <kbd>/</kbd>), with keyboard navigation.
- **My Experiments:** save any simulation's parameters with a custom name, restore, rename and delete them. Data is stored in `localStorage`. Missing, invalid or corrupted data is detected and can be repaired, and restored values are validated and clamped to each control's range.
- **Recently used** experiments on the home page and in the sidebar.
- **Accessibility:** keyboard-operable controls, a skip link, focus moved to the content on navigation, labelled tooltips, a focus-trapped save dialog, `prefers-reduced-motion` support, and shapes as well as colours where colour carries meaning.

---

## Project structure

```
src/
  App.tsx                 routing, page titles, transitions
  index.css               design tokens (Tailwind @theme), base styles
  lib/
    router.ts             tiny hash router (no dependency)
    storage.ts            localStorage: saved experiments + recent history, with validation
    simParams.tsx         useSimParam(): saveable/restorable simulation inputs
    categories.ts, chart.ts, format.ts, random.ts
  models/                 pure, framework-free calculation models + unit tests
    ram.ts cpu.ts nn.ts compound.ts probability.ts orbit.ts models.test.ts
  components/             AppShell (sidebar, top bar, search), ui kit, cards, previews
  pages/                  Home, Explore, SimPage, Saved, About, NotFound
  sims/
    registry.ts           metadata for every simulation (lazy-loaded)
    computing/ ai/ finance/ physics/ probability/ math/
```

### Adding a simulation
1. Create `src/sims/<area>/MySim.tsx` and default-export a component that receives `{ accent }`.
2. Declare each input with `useSimParam('key', default, { label, min, max })` instead of `useState`. This makes it saveable and restorable automatically.
3. Add an entry to `SIMS` in `src/sims/registry.ts` (title, category, level, question, concept, model assumptions, "try this" prompts).
4. Optionally add a thumbnail to `src/components/SimPreview.tsx`.

The explorer, search, sidebar counts, saving and navigation pick it up automatically.

---

## Testing

- `npm test` runs 16 unit tests on the calculation models. They cover RAM accounting, Amdahl bounds, compound interest against the closed-form formula and textbook values, chi-square p-values against published critical values, a one-year circular orbit returning to its start with conserved energy, neural-network gradients checked numerically, and the network actually learning XOR.
- During development the production build was also exercised end-to-end in headless Chrome (137 checks): every page and simulation, buttons, sliders, search, filters, sorting, save/restore/rename/delete, persistence across refresh, invalid and corrupted storage, mobile layout at 390 px, drawer navigation, keyboard focus and reduced motion. That script depends on a local Chrome installation and is not part of this repository.

---

## Known limitations

- **Simplified models.** Each simulation states its assumptions on its page. Hardware results are simulated estimates, not benchmarks; nothing reads your real memory or CPU. Financial projections assume constant rates and are not advice.
- **Saved experiments store parameters, not run state.** Restoring brings back the settings (including random seeds, so generated data and starting weights match). Run results, such as a trained network, probability runs or an orbit's progress, are recomputed rather than restored.
- **Browser-only storage.** Saved experiments live in one browser on one device. Clearing site data deletes them, and they do not sync. Some private-browsing modes block storage; the app detects this and says so.
- **Hash URLs.** Addresses look like `/#/explore`. This is deliberate so the site works on any static host without configuration.
- **Bundle size.** The main bundle is about 148 kB gzipped (mostly React, Recharts and Framer Motion). Each simulation loads separately on demand.
- **Testing coverage.** Automated browser testing was done in Chromium only. Safari, Firefox, real mobile devices and screen readers have not been tested.
- **Dark theme only**, English only, and amounts in US dollars.
- **Neural network runs vary.** With random starting weights, small networks occasionally settle in a poor local minimum (for example about 85% on XOR). Training longer, adding neurons or drawing new weights usually fixes it, as the page explains.
