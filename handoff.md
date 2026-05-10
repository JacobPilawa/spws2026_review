# World Series Animated Page Handoff

This folder contains a static scrollytelling prototype for the Speed Puzzle World Series 2026 results. It was built as a lightweight, dependency-free browser page using vanilla HTML, CSS, and JavaScript, with a Python data-prep script that converts the source CSV/images into a generated JavaScript data payload.

The goal is an interactive story page where scroll position controls animated visualizations: competitors travelling to Munich, each challenge unfolding over simulated time, cumulative standings after every challenge, final standings, and fun-fact summaries.

## Current Status

The current version is a checkpoint, not a polished final product. The rest of the page is directionally acceptable, but the Challenge-scene scrolling recently received an important simplification after becoming too slow and feeling stuck. The most important implementation rule going forward is:

Do not use `scrollIntoView()` inside scroll-driven scene updates. It can scroll ancestor containers, including the viewport, and caused the page to continue moving after user scrolling stopped. Use direct `container.scrollTop = ...` for internal auto-scroll instead.

## How To Run

From the repository root:

```sh
python scripts/worldseries_animated_page/prepare_data.py
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/scripts/worldseries_animated_page/
```

Do not open `index.html` directly with a `file://` URL. Use a local HTTP server so image and script paths resolve correctly.

## File Map

- `index.html`: Minimal page shell. Loads `styles.css`, generated `story_data.js`, and `app.js`.
- `styles.css`: All visual styling, layout, scroll-section sizing, responsive behavior, and scene-specific overrides. This file has accumulated several iterative override blocks; later blocks intentionally supersede earlier ones.
- `app.js`: Scroll-state controller and all scene render/update functions.
- `prepare_data.py`: Reads World Series CSVs/images/flags and writes `story_data.js`.
- `story_data.js`: Generated payload assigned to `window.WORLD_SERIES_DATA`. Do not edit by hand; regenerate with `prepare_data.py`.
- `smoke_page.py`: Older optional Playwright smoke test. It may need updates as scenes evolve.
- `page_check.png`, `smoke_*.png`: Browser QA screenshots from development. These are not required for the app to run.

## Source Data Used

Primary source files are in `data/worldseries/`:

- `leaderboard_latest.csv`: Canonical results table with rank, name, country, per-puzzle times, and total time.
- `worldseries_competitors_with_leaderboard.csv`: Results merged with table numbers and country data.
- `images/round1.png` through `images/round6.png`: Puzzle images.
- `flags/*.png`: Country flags used in the travel/country chart.

Current generated data summary:

- Finishers: 334
- Normalized countries: 39
- Rounds: 6
- Country map paths: 177 Natural Earth country paths generated locally
- Final standings rows: 334
- Per-round result rows: 334
- Per-round dot count: 334
- Per-round cumulative standing rows: 334

## Data Prep Details

Run:

```sh
python scripts/worldseries_animated_page/prepare_data.py
```

The script currently does the following:

1. Reads `leaderboard_latest.csv`.
2. Normalizes a few country labels, e.g. `USA` -> `United States`, lowercase Switzerland/South Africa variants.
3. Reads table numbers from `worldseries_competitors_with_leaderboard.csv` and merges them into the leaderboard by name.
4. Computes per-round ranks, cumulative times, rank-after-round values, rank deltas, medians, means, best pieces-per-minute, histograms, and p10/p25/p50/p75/p90 percentile summaries.
5. Generates approximate travel coordinates by country using a hardcoded centroid map.
6. Adds flag paths for countries using a hardcoded country-to-flag-code map.
7. Generates simplified world country SVG paths from GeoPandas' packaged Natural Earth shapefile via `pyshp`, because GeoPandas/Fiona was unavailable or broken in this environment.
8. Writes `story_data.js` as `window.WORLD_SERIES_DATA = ...`.

Known data-prep constraints:

- Table-number merge assumes `leaderboard_name` in `worldseries_competitors_with_leaderboard.csv` matches `name` in `leaderboard_latest.csv` after stripping whitespace.
- Country centroids are approximate and intended for visual storytelling, not geospatial precision.
- World map paths are simplified aggressively for browser performance.
- `story_data.js` is generated and may be large, but it is intentionally static so no browser build step is needed.

## Page Structure

The page is a two-column scrollytelling layout:

- Left column: sticky visualization stage.
- Right column: narrative chapter cards that determine the active scene.

Current story sequence:

1. Travel/country map scene.
2. Six-puzzle overview scene.
3. Challenge 1 scene.
4. Results After Challenge 1 cumulative standings.
5. Challenge 2 scene.
6. Results After Challenge 2 cumulative standings.
7. Challenge 3 scene.
8. Results After Challenge 3 cumulative standings.
9. Challenge 4 scene.
10. Results After Challenge 4 cumulative standings.
11. Challenge 5 scene.
12. Results After Challenge 5 cumulative standings.
13. Challenge 6 scene.
14. Results After Challenge 6 cumulative standings.
15. Final standings.
16. Fun facts.

The bottom puzzle gallery was removed/disabled after adding the six-puzzle overview as an in-story scene.

## Core JavaScript Functions

In `app.js`:

- `makeChapters()`: Creates right-side chapter cards and defines story order.
- `sceneShell(title, sub, right)`: Replaces the left stage content for the active scene.
- `chapterProgress(el)`: Converts the active chapter's viewport position into a `0..1` progress value.
- `pickActiveChapter()`: Chooses the active chapter. It currently switches when the next chapter reaches the top of the viewport (`window.scrollY + 1`) rather than earlier in the viewport, which preserves bottom hold time.
- `renderTravel(rawProgress)`: World map, country travel arcs/dots, and country flag bar chart.
- `renderPuzzles()`: 3x2 grid of puzzle images labelled `Challenge N: Label`.
- `renderRound(roundNo, rawProgress)`: Challenge timer, table-placement dot grid, and per-round leaderboard.
- `renderStanding(roundNo, rawProgress)`: Cumulative standings bars and movement list.
- `renderFinal(rawProgress)`: Compact podium, all-334 final bars, and full final table.
- `renderFacts()`: Static fun facts: challenge box plots, biggest movers, and table-number overperformance.
- `tableGridStyle(tableNumber, cols = 21)`: Places dots by table number in a row-wise snake layout.
- `setListScrollByIndex(container, index, leadRows = 25)`: Auto-scrolls internal list containers without scrolling the whole document. Auto-scroll intentionally waits until roughly the 25th highlighted row so the first screen of results stays stable.

## Important Scroll Design Decisions

Several iterations were needed because scroll-driven animation can easily feel wrong.

### Problem: Scenes Moved On Too Early

Earlier versions used shorter chapter heights and active-section selection based on the center of the viewport. This caused sections to switch before timers or row reveals completed.

Current fix:

- Individual scene types have large `vh` heights in CSS.
- Active section switching happens only after the next chapter top reaches the top of the viewport.
- `simProgress(rawProgress, start, end)` lets each scene finish before the chapter ends, leaving hold time.

### Problem: Timer Was Too Slow And Cut Off

At one point the Challenge timer was slowed by dividing progress by 10. That made it impossible for the timer to reach the later finish times before the section ended.

Current fix:

- Challenge progress is direct again, with the current mapping `simProgress(rawProgress, 0.08, 0.81)`.
- Challenge section height is `760vh`; the later `0.81` completion point intentionally reduces the amount of dead scroll after all finishers appear.

Earlier browser checks after removing scroll-jacking showed Challenge 1 could complete without scroll drift. The exact sample times should be rechecked after the latest `0.81` timing change if precise scroll pacing matters.

- 12% section progress: `0:26:23`, 0 finishers.
- 24%: `0:51:01`, 140 finishers.
- 36%: `1:15:22`, 288 finishers.
- 48%: `1:39:38`, 332 finishers.
- 60%: `1:44:05`, 334 finishers.
- Page scroll drift after stopping: 0.

### Problem: Page Felt Stuck / Buffered After Scrolling

Cause:

- `scrollIntoView()` was used inside scroll update logic to keep the leaderboard near recent finishers.
- In practice, this can scroll ancestor containers and the main viewport, creating a feedback loop where page scroll continues after user input stops.
- Global CSS `scroll-behavior: smooth` also made programmatic scrolling feel delayed.

Current fix:

- Removed all `scrollIntoView()` calls from scroll-driven scene updates.
- Replaced with `container.scrollTop = ...` via `setListScrollByIndex()`.
- Set `html { scroll-behavior: auto !important; }`.
- Kept `overscroll-behavior: contain` on internal scroll panels.

Reference docs consulted during this fix:

- MDN `Element.scrollIntoView()`: https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView
- MDN `scroll-behavior`: https://mdn2.netlify.app/en-us/docs/web/css/scroll-behavior/

## Scene-Specific Current Behavior

### Travel / Country Map

Current behavior:

- Shows a real world map using generated Natural Earth SVG paths.
- Shows animated travel paths and dots to Munich.
- Travel animation starts late in the scene so the full map is visible before motion begins.
- Bottom chart shows 24 countries.
- Bars are vertical, traditional bar-chart style.
- Labels below bars are flag-only. Country names are available in flag `title`/`alt` attributes.
- Number labels are close to the top of the bars.

Important CSS/JS pieces:

- `renderTravel()` in `app.js`.
- `.travel-layout`, `.country-bars`, `.country-row`, `.country-label` in `styles.css`.

### Puzzle Overview

Current behavior:

- Appears immediately after the country scene.
- Shows six puzzle images in a 3-column x 2-row grid.
- Labels are `Challenge 1: Gradient`, `Challenge 2: Repetition`, etc.

Important pieces:

- `renderPuzzles()` in `app.js`.
- `.puzzle-overview-grid`, `.puzzle-overview-card` in `styles.css`.

### Challenge Scenes

Current behavior:

- Large timer shown in the header area.
- Timer progresses from 0 to the max round finish time.
- Dot grid contains all 334 competitors.
- Dots are square, same shape before/after fill.
- Dot positions correspond to `table_number` using a 21-column snake layout.
- Leaderboard contains all 334 competitors.
- Leaderboard rows un-grey as each competitor's finish time passes.
- Once more than ~12 finishers are visible, leaderboard auto-scrolls internally so recent finishers remain in view.

Important pieces:

- `renderRound()` in `app.js`.
- `tableGridStyle()` in `app.js`.
- `setListScrollByIndex()` in `app.js`.
- `.grid-dots`, `.finish-dot`, `.result-row`, `.scroll-list` in `styles.css`.

Current key scroll settings:

- `.chapter[data-kind="round"] { min-height: 760vh !important; }`
- `renderRound()` uses `simProgress(rawProgress, 0.08, 0.81)`.

If the Challenge scenes still feel wrong, adjust these two values first. Increase `760vh` for more physical scroll distance; decrease for faster scenes. Move `0.81` lower for faster completion or higher for slower completion.

### Results After Challenge Scenes

Current behavior:

- Shows all 334 cumulative standing bars.
- Shows all 334 corresponding ranking/change rows on the right.
- Bars and rows un-grey/grow together.
- Internal list and bar panels auto-scroll with direct `scrollTop` updates.
- Bars are clipped to available panel width to prevent bleed.

Important pieces:

- `renderStanding()` in `app.js`.
- `.stacked-chart`, `.stack-row`, `.stack-total`, `.standing-row` in `styles.css`.

Known caveat:

- The cumulative bar width currently uses a pixel heuristic (`total / 22`) capped by parent width. If future revisions need more accurate x-axis scaling, replace this with a proper scale based on `maxCum` and available chart width.

### Final Standings

Current behavior:

- Compact podium at top-left.
- A large final-bars panel below it includes all 334 competitors.
- Final bars are gray.
- Faster competitors have shorter bars; slower competitors have longer bars.
- Right-side table includes all 334 rows.

Important pieces:

- `renderFinal()` in `app.js`.
- `.final-left`, `.podium--compact`, `.final-bars`, `.final-bar-row`, `.final-bar-fill` in `styles.css`.

Known design note:

- The final bars are intentionally based on absolute total time range and are not ranked labels with `#1/#2/#3` in the bar label, per the most recent request.

### Fun Facts

Current behavior:

- Static on arrival. No scroll animation.
- Challenge time distribution is shown as percentile box plots using p10/p25/p50/p75/p90.
- Also shows biggest cumulative movers and table-number overperformance. The previous pieces-per-minute card was removed from the page, although the data prep may still compute the metric.

Important pieces:

- `percentile_summary()` in `prepare_data.py`.
- `renderFacts()` in `app.js`.
- `.box-plot`, `.box-row`, `.box-axis`, `.box`, `.median`, `.whisker` in `styles.css`.

## Design Choices So Far

### Stack Choice

We chose vanilla HTML/CSS/JavaScript because:

- The page is static and can be served with `python -m http.server`.
- No build step is required.
- Scroll-driven scenes are relatively simple DOM/SVG updates.
- Data can be precomputed once into `story_data.js`.

If this grows into a production editorial piece, a framework such as Svelte, React, or Astro could be used, but it is not necessary yet.

### Visual Direction

The current page uses:

- Warm paper background.
- Heavy black editorial typography.
- Card-like panels with rounded borders and shadows.
- Round-specific colors from earlier matplotlib/notebook work.
- Puzzle images and country flags from the local data folder.

A previous attempt added puzzle-piece nubs/sockets to boxes. That looked bad and was explicitly removed. Avoid reintroducing that treatment unless redesigned from scratch.

### Map

The first map version was blank/stylized. It was replaced with actual country outlines. A later attempt stretched the map SVG to fill the box with `preserveAspectRatio="none"`; that looked bad and was reverted. Preserve normal SVG aspect ratio.

## Conversation / Revision History

This summarizes the major product direction and revisions so a future developer can understand why the current shape exists.

1. Initial request: build a fun interactive scrollytelling site from recent speed puzzling competition data, with people travelling to Munich, round-by-round competition/timer/results, cumulative standings, final standings, fun facts, puzzle images, and a modern speed-jigsaw theme.
2. Stack discussion: user asked whether this should be JS or HTML. Decision: use static HTML/CSS/vanilla JS plus Python data prep.
3. Initial prototype created:
   - `index.html`, `styles.css`, `app.js`, `prepare_data.py`, `story_data.js`.
   - Travel scene, round scenes, cumulative standings, final standings, fun facts, puzzle gallery.
4. User requested slower scrolling, puzzle-shaped boxes, real map, country bar chart, timers starting at 0, delayed appearances, fixed-size panels.
5. Added Natural Earth map paths and country bars. Tried puzzle-piece box nubs/sockets; they looked bad.
6. User requested removal of bad puzzle-piece shapes and map stretching, full-width map with country bars below, open bar charts instead of pill tracks, persistent/non-rebuilding result rows, scrollable tables.
7. Removed puzzle-piece shapes, restored map aspect, moved country bars below map, made bars open, made rows persistent and scrollable.
8. User requested more countries, delayed travel start, much slower timers, all 334 dots/results/standings, wider visualization, smaller narrative cards.
9. Data prep was changed from top-60/top-30 caps to all 334 rows. Dots expanded to all 334.
10. User noted left panel became too wide, sections still moved too early, timer cut off, dots should be square and table-number placed, final panel needed redesign.
11. Layout ratio was reduced, section heights increased, table-number snake grid added, final panel rebuilt with compact podium plus all-334 bars and table.
12. User requested country chart refinements, puzzle overview in-story, auto-scroll lists, square dots 2x, less hold after challenge completion, all final bars gray/inverted, fun facts static with box plot.
13. Added 24-country flag-only bar chart, in-story 3x2 puzzle overview, larger timer, internal auto-scroll, square larger dots, full final bars, static fun facts and percentile box plots.
14. User reported Challenge scroll was super messed up: timer too slow and page continued scrolling long after input stopped.
15. Root cause identified: `scrollIntoView()` inside scroll updates plus global smooth scrolling. Removed `scrollIntoView()`, replaced with direct `scrollTop`, disabled smooth behavior, shortened Challenge scene to `760vh`, verified no scroll drift.
16. Latest refinements: cropped the travel SVG viewBox so the world map fills the map panel more fully, delayed all internal auto-scroll until the 25th highlighted row, moved each Challenge puzzle image into a separate right-column narrative card, replaced the Challenge left-panel image/winner strip with top-three finisher cards, changed cumulative stacked bars to scale by percentage of the current round's maximum cumulative time instead of raw pixel width, moved Challenge and Results After Challenge completion closer to the section end to reduce post-animation dead scroll, and removed the pieces-per-minute fun fact.
17. Latest layout/content pass: the map and six-puzzle overview scenes now hide the right narrative column and center the main visualization; Results After Challenge scenes also hide the right narrative card and center the stage. Challenge narrative cards were moved higher, changed to `Challenge N: feature` eyebrow text, puzzle-name titles, brand/piece-count body copy, and the stage header no longer includes the extra explanatory gray subtitle.
18. Latest cleanup: standing transition cards are hidden globally so a `Results After Challenge N` card does not slide up in the right column while scrolling past a Challenge scene. Fun-fact mover and table-overperformance lists now show the top 50 and scroll internally. The travel map viewBox is cropped eastward to remove most Alaska/Pacific whitespace and give the contiguous U.S./Europe more usable space.
19. Latest polish: the travel map crop was shifted north in SVG coordinates to show more northern Europe, the Munich marker was reduced substantially, and the final standings gray-bar panel now auto-scrolls after about 25 visible rows while the separate right-side final leaderboard remains independent.
20. Final/facts layout cleanup: final standings and fun facts now use the same centered-stage layout as the map, puzzle overview, and Results After Challenge scenes, hiding the right narrative cards because they did not add new information.
21. Latest navigation/autoplay pass: fixed Previous Page, Next Page, and Replay controls were added in a small bottom-right rail. Challenge scenes now autoplay over 25 seconds and Replay resets the timer/table state to zero. Results After Challenge scenes still autoplay, now at roughly three-times the original speed, and their physical scroll height was cut in half so advancing past them takes less scrolling.
22. Latest controls/animation pass: the map scene now autoplays and can be replayed, Challenge scenes gained a Pause/Resume button, Next/Previous jumps are immediate instead of smooth to avoid right-panel artifacts, final standings now animate automatically, podium bars were made taller, country-bar labels show flag plus three-letter abbreviation, and the page background texture now uses a tiled jigsaw outline. The prior gray grid texture remains available as `--texture-grid` in CSS.
23. Latest layout/final pass: the main/right column ratio was adjusted for a 100% browser zoom baseline, round narrative cards moved higher and narrower, Results After stages are slightly narrower, the map was zoomed out again and stripped of the lower map labels, the map autoplay was sped up, challenge list auto-scroll now starts after 16 finishers, the hero title is now `Speed Puzzle World Series 2026`, the hero decorative corner shape and `Munich finish line` pill were removed, the background returned to the older gray diamond grid, and the final page now shows placements in the gray-bar list plus a ranking trajectory plot on the right.
24. Latest fixes: the final trajectory plot is now a tall internally scrollable chart covering ranks 1-334 with names after the final dots, the map is zoomed out farther, the map summary moved under `Top countries represented`, the country bar chart shows all 39 countries, non-active right-side cards are hidden during Challenge scenes to prevent button-navigation artifacts, Fun Facts was renamed to `Extra Statistics`, and Challenge dot grids are compacted by table order so blank cells only appear at the end.
25. Latest cleanup: the country bars were shortened so flags/abbreviations stay inside the panel, one-person countries now resolve to their true final count instead of sometimes ending at `0`, the Challenge dot grid last row is centered by compacting table-order positions into the final row, and the final ranking trajectory was redrawn as a native inline SVG rank ladder with more vertical spacing, lighter gridlines, and final names next to the last dots.

## Known Technical Debt

- `styles.css` is append-heavy and contains older superseded rules. Later rules override earlier rules. A future cleanup should consolidate it into organized sections once the design stabilizes.
- `app.js` recreates scene DOM when active scene changes. This is acceptable for now, but if transitions become more sophisticated, scene caching may help.
- The generated `story_data.js` includes map path data and all competitor rows, making it larger than a minimal payload. This is acceptable for a static local prototype.
- Browser QA scripts are ad hoc. `smoke_page.py` currently verifies core rendering and writes `smoke_screenshot.png` plus `smoke_final.png`, but if this becomes long-lived, create a small formal Playwright test suite.
- The final bars are still intentionally storytelling-oriented, but cumulative bars now scale against the current round's maximum cumulative total so stacked bars keep accurate relative proportions as rounds are added.
- Many historical QA screenshots are present in the folder but are not required for operation.

## Suggested Future Improvements

1. Consolidate CSS into clean sections and remove superseded rules.
2. Add a small progress marker or mini timeline so users know where they are in long Challenge scenes.
3. Add controls for pause/replay per scene if this becomes a public-facing page.
4. Improve mobile behavior; current layout has responsive fallbacks but the experience is primarily desktop-oriented.
5. Replace generated JS payload with JSON if introducing a build/dev server later.
6. Add a proper x-axis to cumulative/final bar charts if analytical precision becomes more important than storytelling flow.
7. Consider virtualizing the 334-row lists if performance becomes a concern on lower-end devices.

## QA / Verification Commands

Basic syntax checks:

```sh
node --check scripts/worldseries_animated_page/app.js
python -m py_compile scripts/worldseries_animated_page/prepare_data.py
```

Regenerate data and run locally:

```sh
python scripts/worldseries_animated_page/prepare_data.py
python -m http.server 8000
```

Open:

```text
http://localhost:8000/scripts/worldseries_animated_page/
```

Optional browser smoke testing can be done with Playwright if installed. During development, targeted checks verified:

- Country section renders 39 flag-plus-abbreviation labels.
- Puzzle overview renders 6 cards.
- Challenge 1 reaches final timer and 334 visible rows/dots.
- Challenge-scene scroll drift after stopping is 0 after removing `scrollIntoView()`.
- Results After Challenge panels render 334 bars/rows.
- Final section renders 334 final bars and the inline SVG ranking-trajectory plot.
- Fun facts render 6 box plot rows.

## Git / Checkpoint Note

A Git repo was briefly initialized accidentally at the parent workspace root and then removed at the user's request. This folder itself is not a standalone Git repo unless a future developer initializes one intentionally. If checkpointing to GitHub later, avoid committing the entire parent workspace blindly because the parent contains multi-GB data/plot/video artifacts and files over GitHub's normal 100 MB limit.

Recommended checkpoint scope for this page:

- `scripts/worldseries_animated_page/`
- `data/worldseries/`

Avoid pushing:

- `plots/` generated videos
- large raw datasets outside `data/worldseries/`
- `.DS_Store`
- notebook checkpoints
