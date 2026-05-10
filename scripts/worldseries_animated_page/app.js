const DATA = window.WORLD_SERIES_DATA;
const stage = document.getElementById("stage");
const chapters = document.getElementById("chapters");
const heroStats = document.getElementById("heroStats");
const gallery = document.getElementById("puzzleGallery");
const storyShell = document.querySelector(".story-shell");
const prevPageButton = document.getElementById("prevPage");
const nextPageButton = document.getElementById("nextPage");
const replayPageButton = document.getElementById("replayPage");
const pausePageButton = document.getElementById("pausePage");
const returnTopButton = document.getElementById("returnTopPage");

let activeIndex = -1;
let activeChapter = null;
let rafPending = false;
let currentSceneKey = "";
let travelAuto = { key: "", startMs: 0, durationMs: 6000 };
let roundAuto = { key: "", startMs: 0, durationMs: 25000, paused: false, pausedElapsed: 0 };
let standingAuto = { key: "", startMs: 0, durationMs: 3167 };
let finalAuto = { key: "", startMs: 0, durationMs: 8000 };

const palette = ["#ff5f57", "#3587ff", "#22b66e", "#f3b82f", "#a76bf5", "#ff7ba8", "#48d6c8", "#ff9f1c"];
const roundColors = DATA.rounds.reduce((acc, round) => ({ ...acc, [round.round]: round.color }), {});
const puzzleNames = [
  "Topricana Sunset",
  "Chefchaouen, Morocco",
  "Farmer's Table",
  "Curious Capers of the Capybaras",
  "Postcard Globe",
  "Munchable München Hearts"
];
const puzzleBrands = [
  "Ravensburger (500 pieces)",
  "Ravensburger (500 pieces)",
  "Ravensburger (500 pieces)",
  "Anatolian (500 pieces)",
  "Gibsons (500 pieces)",
  "Gibsons (636 pieces)"
];
const countryAbbreviations = {
  Germany: "GER",
  "United States": "USA",
  Netherlands: "NED",
  Sweden: "SWE",
  Finland: "FIN",
  Switzerland: "SUI",
  Spain: "ESP",
  Poland: "POL",
  "Czech Republic": "CZE",
  Belgium: "BEL",
  France: "FRA",
  Slovenia: "SLO",
  "United Kingdom": "GBR",
  Estonia: "EST",
  Australia: "AUS",
  Slovakia: "SVK",
  Hungary: "HUN",
  Romania: "ROU",
  Lithuania: "LTU",
  Denmark: "DEN",
  Canada: "CAN",
  Portugal: "POR",
  Norway: "NOR",
  "South Africa": "RSA",
  "Independent Neutral": "AIN",
  Argentina: "ARG",
  Italy: "ITA",
  "New Zealand": "NZL",
  Latvia: "LAT",
  Ireland: "IRL",
  Brazil: "BRA",
  Austria: "AUT",
  Cyprus: "CYP",
  Luxembourg: "LUX",
  Indonesia: "IDN",
  India: "IND",
  Iceland: "ISL",
  Croatia: "CRO",
  Greece: "GRE"
};
const countryColors = {
  Germany: "#dd0000",
  "United States": "#3c3b6e",
  Netherlands: "#f36c21",
  Sweden: "#006aa7",
  Finland: "#002f6c",
  Switzerland: "#d52b1e",
  Spain: "#c60b1e",
  Poland: "#dc143c",
  "Czech Republic": "#11457e",
  Belgium: "#fae042",
  France: "#0055a4",
  Slovenia: "#005da4",
  "United Kingdom": "#012169",
  Estonia: "#0072ce",
  Australia: "#00008b",
  Slovakia: "#0b4ea2",
  Hungary: "#436f4d",
  Romania: "#fcd116",
  Lithuania: "#fdb913",
  Denmark: "#c60c30",
  Canada: "#ff0000",
  Portugal: "#006600",
  Norway: "#ba0c2f",
  "South Africa": "#007a4d",
  "Independent Neutral": "#7f7f7f",
  Argentina: "#75aadb",
  Italy: "#008c45",
  "New Zealand": "#00247d",
  Latvia: "#9e3039",
  Ireland: "#169b62",
  Brazil: "#009c3b",
  Austria: "#ed2939",
  Cyprus: "#d57800",
  Luxembourg: "#00a1de",
  Indonesia: "#ce1126",
  India: "#ff9933",
  Iceland: "#02529c",
  Croatia: "#171796",
  Greece: "#0d5eaf"
};

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function easeOutCubic(v) {
  return 1 - Math.pow(1 - clamp(v), 3);
}

function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
}

function project(lon, lat, w, h) {
  const x = ((lon + 180) / 360) * w;
  const y = ((86 - lat) / 172) * h;
  return [x, y];
}

function curvePath(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lift = Math.min(170, Math.max(30, Math.hypot(dx, dy) * 0.18));
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2 - lift;
  return `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

function simProgress(raw, start = 0.04, end = 0.74) {
  return clamp((raw - start) / (end - start));
}

function makeEmptyRows(count) {
  return Array.from({ length: count }, () => `<div class="row row--empty"><span></span><span></span><span></span></div>`).join("");
}

function tableGridStyle(tableNumber, cols = 21) {
  const n = Number(tableNumber);
  if (!Number.isFinite(n) || n < 1) return "";
  const idx = n - 1;
  const row = Math.floor(idx / cols) + 1;
  const colInRow = idx % cols;
  const col = row % 2 === 1 ? colInRow + 1 : cols - colInRow;
  return `grid-row:${row};grid-column:${col};`;
}

function compactTableGridStyle(position, total, cols = 21) {
  const idx = position - 1;
  const row = Math.floor(idx / cols) + 1;
  const totalRows = Math.ceil(total / cols);
  const remainder = total % cols || cols;
  const rowCount = row === totalRows ? remainder : cols;
  const offset = row === totalRows ? Math.floor((cols - rowCount) / 2) : 0;
  const colInRow = idx % cols;
  const col = row % 2 === 1 ? offset + colInRow + 1 : cols - offset - colInRow;
  return `grid-row:${row};grid-column:${col};`;
}

function setListScrollByIndex(container, index, leadRows = 25) {
  if (!container || index <= leadRows) return;
  const firstRow = container.querySelector(".row, .stack-row");
  if (!firstRow) return;
  const styles = getComputedStyle(firstRow);
  const rowHeight = firstRow.getBoundingClientRect().height + (parseFloat(styles.marginBottom) || 0);
  container.scrollTop = Math.max(0, (index - leadRows) * rowHeight);
}

function autoProgress(state) {
  const elapsed = state.paused ? state.pausedElapsed : performance.now() - state.startMs;
  return clamp(elapsed / state.durationMs);
}

function resetRoundAuto(key) {
  roundAuto = { key, startMs: performance.now(), durationMs: 25000, paused: false, pausedElapsed: 0 };
}

function countryAbbrev(country) {
  return countryAbbreviations[country] || String(country || "").slice(0, 3).toUpperCase();
}

function countryColor(country, idx = 0) {
  return countryColors[country] || palette[idx % palette.length];
}

function finalTrajectoryRows(limit = DATA.finalTop.length) {
  const byName = new Map(DATA.finalTop.slice(0, limit).map((d) => [d.name, {
    name: d.name,
    country: d.country,
    finalRank: Number(d.rank),
    ranks: []
  }]));
  DATA.rounds.forEach((round, idx) => {
    const key = `rank_after_${idx + 1}`;
    round.standings.forEach((row) => {
      if (byName.has(row.name)) byName.get(row.name).ranks[idx] = Number(row[key]);
    });
  });
  return Array.from(byName.values()).filter((d) => d.ranks.length === DATA.rounds.length && d.ranks.every(Number.isFinite));
}

function renderTrajectoryPlot(rows) {
  return `<div class="trajectory-help">Hover to isolate a puzzler.</div><div id="trajectoryPlot" class="trajectory-plot" role="img" aria-label="Final standings rank trajectories"></div>`;
}

function drawTrajectoryPlot(rows) {
  const host = document.getElementById("trajectoryPlot");
  if (!host) return;
  const w = Math.max(640, Math.floor(host.parentElement.getBoundingClientRect().width - 4));
  const rowHeight = 34;
  const margin = { top: 54, right: 150, bottom: 42, left: 54 };
  const maxRank = DATA.meta.competitors;
  const h = margin.top + margin.bottom + (maxRank - 1) * rowHeight;
  const plotW = w - margin.left - margin.right;
  const x = (i) => margin.left + (i / Math.max(1, DATA.rounds.length - 1)) * plotW;
  const y = (rank) => margin.top + (rank - 1) * rowHeight;
  const rankGrid = [];
  for (let rank = 1; rank <= maxRank; rank += 1) {
    const major = rank === 1 || rank % 25 === 0;
    const labeled = rank === 1 || rank % 5 === 0 || rank === maxRank;
    rankGrid.push(`
      <g class="trajectory-gridline ${major ? "is-major" : ""}">
        <line x1="${margin.left}" y1="${y(rank)}" x2="${w - margin.right}" y2="${y(rank)}"></line>
        ${labeled ? `<text x="${margin.left - 10}" y="${y(rank)}" text-anchor="end">#${rank}</text>` : ""}
      </g>
    `);
  }

  const roundAxes = DATA.rounds.map((round, i) => `
    <g class="trajectory-x">
      <line x1="${x(i)}" y1="${margin.top}" x2="${x(i)}" y2="${h - margin.bottom}"></line>
      <text x="${x(i)}" y="22" text-anchor="middle">Challenge ${round.round}</text>
      <text x="${x(i)}" y="${h - 14}" text-anchor="middle">Challenge ${round.round}</text>
    </g>
  `).join("");

  const people = rows.map((d, i) => {
    const hue = Math.round((i * 137.508) % 360);
    const color = `hsl(${hue} 66% 45%)`;
    const points = d.ranks.map((rank, j) => `${x(j)},${y(rank)}`).join(" ");
    const circles = d.ranks.map((rank, j) => `<circle cx="${x(j)}" cy="${y(rank)}" r="7.4"></circle>`).join("");
    const labelY = y(d.ranks[d.ranks.length - 1]);
    const labelX = x(DATA.rounds.length - 1) + 12;
    return `
      <g class="trajectory-person" tabindex="0" role="button" aria-label="Highlight ${esc(d.name)} trajectory" style="--traj-color:${color}">
        <title>Click to pin ${esc(d.name)}. Click again to reset.</title>
        <polyline points="${points}"></polyline>
        ${circles}
        <text class="trajectory-label" x="${labelX}" y="${labelY - 5}">
          <tspan x="${labelX}" dy="0">#${d.finalRank}</tspan>
          <tspan x="${labelX}" dy="14">${esc(d.name)}</tspan>
        </text>
      </g>
    `;
  }).join("");

  host.innerHTML = `
    <svg class="trajectory-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="width:100%;height:${h}px" preserveAspectRatio="none" role="presentation" aria-hidden="true">
      ${rankGrid.join("")}
      ${roundAxes}
      ${people}
    </svg>
  `;
  const peopleEls = Array.from(host.querySelectorAll(".trajectory-person"));
  let pinnedPerson = null;
  let hoveredPerson = null;
  let suppressedHoverPerson = null;
  const personFromEvent = (event) => {
    const person = event.target.closest?.(".trajectory-person");
    return person && host.contains(person) ? person : null;
  };
  const clearActive = () => {
    peopleEls.forEach((el) => {
      el.classList.remove("is-active", "is-muted");
      el.removeAttribute("aria-pressed");
    });
    host.classList.remove("is-filtered", "is-pinned");
  };
  const setFocus = (person) => {
    host.classList.add("is-filtered");
    peopleEls.forEach((el) => {
      el.classList.toggle("is-active", el === person);
      el.classList.toggle("is-muted", el !== person);
      el.setAttribute("aria-pressed", el === pinnedPerson ? "true" : "false");
    });
    person.parentNode.appendChild(person);
  };
  const resetIfUnpinned = () => {
    if (!pinnedPerson && !hoveredPerson) clearActive();
  };
  const togglePinned = (person) => {
    if (pinnedPerson === person) {
      pinnedPerson = null;
      hoveredPerson = null;
      suppressedHoverPerson = person;
      clearActive();
      return;
    }
    suppressedHoverPerson = null;
    pinnedPerson = person;
    host.classList.add("is-pinned");
    setFocus(person);
  };

  host.addEventListener("pointermove", (event) => {
    if (pinnedPerson) return;
    const person = personFromEvent(event);
    if (person) {
      if (person === suppressedHoverPerson) {
        hoveredPerson = null;
        clearActive();
        return;
      }
      suppressedHoverPerson = null;
      hoveredPerson = person;
      setFocus(person);
    } else {
      suppressedHoverPerson = null;
      hoveredPerson = null;
      clearActive();
    }
  });
  host.addEventListener("pointerleave", () => {
    suppressedHoverPerson = null;
    hoveredPerson = null;
    resetIfUnpinned();
  });
  host.addEventListener("click", (event) => {
    const person = personFromEvent(event);
    if (!person) return;
    togglePinned(person);
  });

  peopleEls.forEach((person) => {
    person.addEventListener("focus", () => {
      hoveredPerson = person;
      if (!pinnedPerson) setFocus(person);
    });
    person.addEventListener("blur", () => {
      if (hoveredPerson === person) hoveredPerson = null;
      resetIfUnpinned();
    });
    person.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePinned(person);
    });
  });
}

function makeChapters() {
  const items = [
    {
      key: "travel",
      kind: "travel",
      eyebrow: "The gathering",
      title: "The puzzle pieces came from everywhere.",
      body: `${DATA.meta.countries} normalized countries sent finishers to Munich. Scroll slowly: the map, flights, and country bars build in layers.`
    },
    {
      key: "puzzles",
      kind: "puzzles",
      eyebrow: "The puzzles",
      title: "Six visual problems, six different rhythms.",
      body: "Before the clock starts, here are the six puzzles that define the competition: gradient, repetition, detail, mystery, circle, and panorama."
    }
  ];

  DATA.rounds.forEach((round) => {
    items.push({
      key: `round-${round.round}`,
      kind: "round",
      round: round.round,
      image: round.image,
      color: round.color,
      eyebrow: `Challenge ${round.round}: ${round.label}`,
      title: puzzleNames[round.round - 1] || `${round.label}: the clock starts again.`,
      body: puzzleBrands[round.round - 1] || `${round.pieces} pieces`
    });
    items.push({
      key: `standing-${round.round}`,
      kind: "standing",
      round: round.round,
      color: round.color,
      eyebrow: `Results After Challenge ${round.round}`,
      title: `Results After Challenge ${round.round}`,
      body: ""
    });
  });

  items.push(
    {
      key: "final",
      kind: "final",
      eyebrow: "Final standings",
      title: "Wiktor Kacprzak holds the full six-round lead.",
      body: "The final table compresses six different puzzles into one total time. The podium had less than 14 minutes between first and third."
    },
    {
      key: "facts",
      kind: "facts",
      eyebrow: "Fun facts",
      title: "The side quests: movers and table-number surprises.",
      body: "The closing charts compare challenge time distributions, biggest movers, and finishes far above table assignment."
    }
  );

  chapters.innerHTML = items.map((item, index) => `
    <article class="chapter" data-index="${index}" data-key="${esc(item.key)}" data-kind="${esc(item.kind)}" data-round="${item.round || ""}">
      <div class="chapter__card">
        <div class="chapter__eyebrow"><span class="chapter__dot" style="background:${item.color || "#48d6c8"}"></span>${esc(item.eyebrow)}</div>
        <h2>${esc(item.title)}</h2>
        ${item.body ? `<p>${esc(item.body)}</p>` : ""}
        ${item.kind === "round" ? `<div class="chapter__image-card"><img src="${esc(item.image)}" alt="Challenge ${item.round} puzzle image"><span>Challenge ${item.round} Image</span></div>` : ""}
      </div>
    </article>
  `).join("");

  return items;
}

const storyItems = makeChapters();
const chapterEls = Array.from(document.querySelectorAll(".chapter"));

function setupHero() {
  heroStats.innerHTML = [
    `${DATA.meta.competitors} Puzzlers`,
    `${DATA.meta.countries} Countries`,
    `${DATA.meta.rounds} Challenges`,
    "1 Champion"
  ].map((s) => `<span class="stat-pill">${esc(s)}</span>`).join("");
}

function sceneShell(title, sub = "", right = "") {
  stage.innerHTML = `
    <div class="viz ${sub ? "" : "viz--no-sub"}">
      <div class="viz__head">
        <div>${title ? `<h2 class="viz__title">${title}</h2>` : ""}${sub ? `<p class="viz__sub">${sub}</p>` : ""}</div>
        ${right}
      </div>
      <div class="viz__body"></div>
    </div>
  `;
  return stage.querySelector(".viz__body");
}

function renderTravel(_rawProgress) {
  if (currentSceneKey !== "travel") {
    currentSceneKey = "travel";
    travelAuto = { key: "travel", startMs: performance.now(), durationMs: 6000 };
    const body = sceneShell("");
    const topCountries = [...DATA.travel].sort((a, b) => b.count - a.count);
    body.innerHTML = `
      <div class="travel-layout">
        <div class="map-panel">
          <svg id="travelSvg" viewBox="-10 -80 1020 650" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Animated travel map"></svg>
        </div>
        <div class="country-panel">
          <h3>${DATA.meta.competitors} Puzzlers from ${DATA.meta.countries} Countries</h3>
          <div class="country-bars" id="countryBars">
            ${topCountries.map((d, i) => `
              <div class="country-row" data-count="${d.count}" style="--country-color:${countryColor(d.country, i)}">
                <div class="country-bar"><span class="country-fill"></span><b>0</b></div>
                <div class="country-label"><img src="${d.flag}" title="${esc(d.country)}" alt="${esc(d.country)} flag"><span>${esc(countryAbbrev(d.country))}</span></div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const svg = document.getElementById("travelSvg");
    const munich = project(DATA.meta.munich.lon, DATA.meta.munich.lat, 900, 560);
    const represented = new Set(DATA.travel.map((d) => d.country));
    const countries = (DATA.worldPaths || []).map((country) => `
      <path class="world-country ${represented.has(country.name) ? "is-represented" : ""}" d="${country.path}" data-country="${esc(country.name)}"></path>
    `).join("");
    svg.innerHTML = `
      <defs>
        <filter id="soft"><feGaussianBlur stdDeviation="5" /></filter>
        <radialGradient id="munichGlow"><stop offset="0" stop-color="#ff5f57" stop-opacity="0.55"/><stop offset="1" stop-color="#ff5f57" stop-opacity="0"/></radialGradient>
      </defs>
      <rect x="-160" y="-110" width="1220" height="760" fill="#f8edd9"></rect>
      <g class="world-map">${countries}</g>
      <circle cx="${munich[0]}" cy="${munich[1]}" r="18" fill="url(#munichGlow)"></circle>
      <circle cx="${munich[0]}" cy="${munich[1]}" r="5" fill="#15120e"></circle>
      <text x="${munich[0] + 10}" y="${munich[1] + 4}" font-family="system-ui" font-weight="900" font-size="13" fill="#15120e">Munich</text>
      <g id="travelPaths"></g><g id="travelDots"></g>
    `;

    const paths = svg.querySelector("#travelPaths");
    const dots = svg.querySelector("#travelDots");
    DATA.travel.forEach((d, i) => {
      const p = project(d.lon, d.lat, 900, 560);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", curvePath(p, munich));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", palette[i % palette.length]);
      path.setAttribute("stroke-width", String(Math.max(1.6, Math.sqrt(d.count) * 0.95)));
      path.setAttribute("stroke-linecap", "round");
      path.dataset.count = d.count;
      path.dataset.country = d.country;
      paths.appendChild(path);

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", p[0]);
      dot.setAttribute("cy", p[1]);
      dot.setAttribute("r", String(Math.max(3, Math.sqrt(d.count) * 1.45)));
      dot.setAttribute("fill", palette[i % palette.length]);
      dot.setAttribute("stroke", "#15120e");
      dot.setAttribute("stroke-width", "1.5");
      dot.dataset.startX = p[0];
      dot.dataset.startY = p[1];
      dot.dataset.endX = munich[0];
      dot.dataset.endY = munich[1];
      dots.appendChild(dot);
    });
  }

  const progress = autoProgress(travelAuto);
  const eased = easeOutCubic(progress);
  let moving = 0;
  const travelPaths = document.querySelectorAll("#travelPaths path");
  const travelDots = document.querySelectorAll("#travelDots circle");
  const n = Math.max(1, travelDots.length);
  travelPaths.forEach((path, i) => {
    const len = path.getTotalLength();
    const offset = (i / Math.max(1, n - 1)) * 0.35;
    const local = clamp((eased - offset) / Math.max(0.001, 1 - offset));
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${(1 - local) * len}`;
    path.style.opacity = String(0.08 + local * 0.78);
  });
  travelDots.forEach((dot, i) => {
    const offset = (i / Math.max(1, n - 1)) * 0.35;
    const local = clamp((eased - offset) / Math.max(0.001, 1 - offset));
    const sx = Number(dot.dataset.startX), sy = Number(dot.dataset.startY);
    const ex = Number(dot.dataset.endX), ey = Number(dot.dataset.endY);
    dot.setAttribute("cx", sx + (ex - sx) * local);
    dot.setAttribute("cy", sy + (ey - sy) * local - Math.sin(local * Math.PI) * 34);
    moving += local;
  });
  const countryRows = Array.from(document.querySelectorAll(".country-row"));
  const maxCountryCount = Math.max(1, ...countryRows.map((row) => Number(row.dataset.count || 0)));
  countryRows.forEach((row) => {
    const count = Number(row.dataset.count || 0);
    const local = progress;
    row.querySelector(".country-fill").style.height = `${local * (count / maxCountryCount) * 100}%`;
    const visibleCount = local >= 0.985 ? count : Math.floor(count * local);
    row.querySelector("b").textContent = String(visibleCount);
  });
  return progress;
}

function renderRound(roundNo, _rawProgress) {
  const round = DATA.rounds[roundNo - 1];
  const key = `round-${roundNo}`;
  const secKey = `puzzle${roundNo}_seconds`;
  if (currentSceneKey !== key) {
    currentSceneKey = key;
    resetRoundAuto(key);
    const body = sceneShell(
      `Challenge ${roundNo}: ${esc(round.label)}`,
      "",
      `<div class="timer" id="timer">0:00:00</div>`
    );
    const top3 = round.results.slice(0, 3);
    body.innerHTML = `
      <div class="panel-grid">
        <div class="panel round-main" style="--round-color:${round.color}">
          <div class="round-top3">
            ${top3.map((d) => `
              <div class="top-finisher">
                <span class="top-finisher__rank">#${d[`round${roundNo}_rank`]}</span>
                <b>${esc(d.name)}</b>
                <span>${esc(d.country)}</span>
                <span class="top-finisher__time">${d.display_time}</span>
              </div>
            `).join("")}
          </div>
          <div class="grid-dots" id="finishGrid"></div>
        </div>
        <div class="table-panel"><div class="result-list scroll-list" id="resultList"></div></div>
      </div>
    `;
    const sample = [...round.allFinishers].sort((a, b) => (Number(a.table_number) || 9999) - (Number(b.table_number) || 9999));
    document.getElementById("finishGrid").innerHTML = sample.map((d, idx) => `<span class="finish-dot" data-seconds="${d[secKey]}" title="Table ${d.table_number || '?'} - ${esc(d.name)}" style="${compactTableGridStyle(idx + 1, sample.length)}"></span>`).join("");
    document.getElementById("resultList").innerHTML = round.results.map((d) => `
      <div class="row result-row" data-seconds="${d[secKey]}">
        <span class="row__rank">#${d[`round${roundNo}_rank`]}</span>
        <span>${esc(d.name)}<br><small>${esc(d.country)}</small></span>
        <span class="row__time">${d.display_time}</span>
      </div>`).join("");
  }
  const progress = autoProgress(roundAuto);

  const maxSeconds = Math.max(...round.allFinishers.map((d) => Number(d[secKey])));
  const current = progress * maxSeconds;
  const timer = document.getElementById("timer");
  if (timer) timer.textContent = fmt(current);

  document.querySelectorAll(".finish-dot").forEach((dot) => {
    dot.classList.toggle("done", Number(dot.dataset.seconds) <= current);
  });
  const visibleRows = [];
  document.querySelectorAll("#resultList .result-row").forEach((row) => {
    const visible = Number(row.dataset.seconds) <= current;
    row.classList.toggle("is-visible", visible);
    if (visible) visibleRows.push(row);
  });
  setListScrollByIndex(document.getElementById("resultList"), visibleRows.length - 1, 16);
  return progress;
}

function renderStanding(roundNo, rawProgress) {
  const round = DATA.rounds[roundNo - 1];
  const key = `standing-${roundNo}`;
  if (currentSceneKey !== key) {
    currentSceneKey = key;
    standingAuto = { key, startMs: performance.now(), durationMs: 3167 };
    const body = sceneShell(`Results After Challenge ${roundNo}`);
    body.innerHTML = `
      <div class="panel standing-panel">
        <div class="stacked-chart standing-chart-unified" id="standingBars" style="--round-color:${round.color}"></div>
      </div>
    `;
  }
  const progress = clamp((performance.now() - standingAuto.startMs) / standingAuto.durationMs);

  const standings = round.standings;
  const maxCum = Math.max(...standings.map((d) => Array.from({ length: roundNo }, (_, i) => Number(d[`puzzle${i + 1}_seconds`] || 0)).reduce((a, b) => a + b, 0)));
  if (!document.getElementById("standingBars").dataset.ready) {
    document.getElementById("standingBars").dataset.ready = "1";
    document.getElementById("standingBars").innerHTML = standings.map((d) => {
      const total = Array.from({ length: roundNo }, (_, i) => Number(d[`puzzle${i + 1}_seconds`] || 0)).reduce((a, b) => a + b, 0);
      const finalWidth = (total / maxCum) * 100;
      const segments = Array.from({ length: roundNo }, (_, i) => {
        const sec = Number(d[`puzzle${i + 1}_seconds`] || 0);
        const share = total > 0 ? (sec / total) * 100 : 0;
        return `<span class="stack-segment" style="width:${share}%;background:${roundColors[i + 1]}"></span>`;
      }).join("");
      const delta = Number(d.rank_delta || 0);
      const cls = delta > 0 ? "up" : delta < 0 ? "down" : "";
      const label = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : roundNo === 1 ? "new" : "0";
      return `
        <div class="stack-row" data-final-width="${finalWidth}">
          <span class="standing-bar-label">
            <b class="standing-rank">#${d[`rank_after_${roundNo}`]}</b>
            <span class="standing-name">${esc(d.name)}<small>${esc(d.country)}</small></span>
            <span class="delta ${cls}">${label}</span>
          </span>
          <span class="stack-bar-cell"><span class="stack-total">${segments}</span></span>
          <span class="stack-time">${d.cum_time}</span>
        </div>`;
    }).join("");
  }

  const totalRows = Math.max(1, standings.length);
  document.querySelectorAll("#standingBars .stack-row").forEach((row, idx) => {
    const local = clamp((progress - (idx / totalRows) * 0.72) / 0.18);
    row.classList.toggle("is-visible", local > 0);
    row.querySelector(".stack-total").style.width = `${Number(row.dataset.finalWidth) * local}%`;
  });
  return progress;
}

function renderFinal(_rawProgress) {
  if (currentSceneKey !== "final") {
    currentSceneKey = "final";
    finalAuto = { key: "final", startMs: performance.now(), durationMs: 8000 };
    const body = sceneShell("Final Rankings");
    const top3 = DATA.finalTop.slice(0, 3);
    const finalBars = DATA.finalTop;
    const trajectories = finalTrajectoryRows();
    body.innerHTML = `
      <div class="panel-grid final-grid">
        <div class="panel final-left">
          <div class="podium podium--compact">
            ${top3.map((d) => `<div class="podium__step"><div class="podium__rank">#${d.rank}</div><div class="podium__name">${esc(d.name)}</div><div>${esc(d.country)}</div><div class="podium__time">${d.display_total}</div></div>`).join("")}
          </div>
          <div class="final-bars" id="finalBars">
            ${finalBars.map((d) => `<div class="final-bar-row" data-seconds="${d.total_time_seconds}"><span class="final-bar-name"><b>#${d.rank}</b> ${esc(d.name)}</span><span class="final-bar-cell"><span class="final-bar-fill"></span></span><b>${d.display_total}</b></div>`).join("")}
          </div>
        </div>
        <div class="panel trajectory-panel">
          <h3>Cumulative Rankings</h3>
          ${renderTrajectoryPlot(trajectories)}
        </div>
      </div>
    `;
    drawTrajectoryPlot(trajectories);
  }
  const progress = autoProgress(finalAuto);
  const finalSeconds = DATA.finalTop.map((d) => Number(d.total_time_seconds));
  const minFinal = Math.min(...finalSeconds);
  const maxFinal = Math.max(...finalSeconds);
  let latestVisible = 0;
  document.querySelectorAll("#finalBars .final-bar-row").forEach((row, idx) => {
    const local = clamp((progress - idx / DATA.finalTop.length * 0.72) / 0.18);
    const seconds = Number(row.dataset.seconds);
    const width = 16 + ((seconds - minFinal) / Math.max(1, maxFinal - minFinal)) * 82;
    row.classList.toggle("is-visible", local > 0);
    if (local > 0) latestVisible = idx;
    row.querySelector(".final-bar-fill").style.width = `${width * local}%`;
  });
  setListScrollByIndex(document.getElementById("finalBars"), latestVisible);
  return progress;
}
function renderFacts(_rawProgress) {
  if (currentSceneKey !== "facts") {
    currentSceneKey = "facts";
    const body = sceneShell("Extra Statistics", "Challenge time distributions, most improved puzzlers, and highest finished above table");
    const allPercentiles = DATA.rounds.flatMap((r) => Object.values(r.percentiles));
    const minP = Math.min(...allPercentiles);
    const maxP = Math.max(...allPercentiles);
    const boxRows = DATA.rounds.map((r) => {
      const q = r.percentiles;
      const scale = (v) => ((v - minP) / Math.max(1, maxP - minP)) * 100;
      return `<div class="box-row" style="--round-color:${r.color}">
        <span>C${r.round} ${esc(r.label)}</span>
        <div class="box-axis">
          <span class="whisker" style="left:${scale(q.p10)}%;width:${scale(q.p90)-scale(q.p10)}%"></span>
          <span class="box" style="left:${scale(q.p25)}%;width:${scale(q.p75)-scale(q.p25)}%"></span>
          <span class="median" style="left:${scale(q.p50)}%"></span>
        </div>
        <b>${fmt(q.p50)}</b>
      </div>`;
    }).join("");
    body.innerHTML = `
      <div class="fact-grid facts-static">
        <div class="fact-card fact-card--wide"><h3>Challenge Time Distributions</h3><div class="box-plot">${boxRows}</div></div>
        <div class="fact-card fact-card--scroll"><h3>Most Improved (Challenge 1 Rank to Final Rank)</h3><div class="result-list static-list" id="improverList">
          ${DATA.improvers.slice(0, 50).map((d) => `<div class="row is-visible"><span class="row__rank">+${d.round1_to_final}</span><span>${esc(d.name)}<br><small>${esc(d.country)}</small></span><span>#${d.rank_after_1} -> #${d.rank_after_6}</span></div>`).join("")}
        </div></div>
        <div class="fact-card fact-card--scroll"><h3>Finishers Above Table Number</h3><div class="result-list static-list" id="tableOver">
          ${DATA.tableOverperformance.slice(0, 50).map((d) => `<div class="row is-visible"><span class="row__rank">+${Math.round(d.table_delta)}</span><span>${esc(d.name)}<br><small>${esc(d.country)}</small></span><span>#${Math.round(d.rank)}</span></div>`).join("")}
        </div></div>
      </div>
    `;
  }
}
function chapterProgress(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const start = vh * 0.68;
  const travel = Math.max(vh * 0.85, rect.height - vh * 0.35);
  return clamp((start - rect.top) / travel);
}

function pickActiveChapter() {
  const triggerY = window.scrollY + 1;
  let idx = 0;
  chapterEls.forEach((el, i) => {
    if (el.offsetTop <= triggerY) idx = i;
  });
  return idx;
}

function scrollToChapter(index) {
  const target = chapterEls[clamp(index, 0, chapterEls.length - 1)];
  if (!target) return;
  window.scrollTo({ top: target.offsetTop, behavior: "auto" });
  activeIndex = -1;
  currentSceneKey = "";
  requestUpdate();
}

function replayActiveScene() {
  const item = storyItems[activeIndex];
  if (!item) return;
  if (item.kind === "travel") {
    travelAuto = { key: "travel", startMs: performance.now(), durationMs: 9000 };
  }
  if (item.kind === "round") {
    resetRoundAuto(`round-${item.round}`);
  }
  requestUpdate();
}

function updateControls(item) {
  if (!prevPageButton || !nextPageButton || !replayPageButton || !pausePageButton || !returnTopButton) return;
  prevPageButton.disabled = activeIndex <= 0;
  nextPageButton.disabled = activeIndex >= chapterEls.length - 1;
  replayPageButton.hidden = !["travel", "round"].includes(item?.kind);
  pausePageButton.hidden = item?.kind !== "round";
  returnTopButton.hidden = item?.kind !== "facts";
  pausePageButton.textContent = roundAuto.paused ? "Resume" : "Pause";
}

function toggleRoundPause() {
  const item = storyItems[activeIndex];
  if (!item || item.kind !== "round") return;
  if (roundAuto.paused) {
    roundAuto.startMs = performance.now() - roundAuto.pausedElapsed;
    roundAuto.paused = false;
  } else {
    roundAuto.pausedElapsed = performance.now() - roundAuto.startMs;
    roundAuto.paused = true;
  }
  updateControls(item);
  requestUpdate();
}

function update() {
  rafPending = false;
  const best = pickActiveChapter();

  if (best !== activeIndex) {
    activeIndex = best;
    activeChapter = chapterEls[best];
    chapterEls.forEach((el, i) => el.classList.toggle("is-active", i === best));
  }

  const item = storyItems[activeIndex];
  const progress = activeChapter ? chapterProgress(activeChapter) : 0;
  if (!item) return;
  let shouldAutoTick = false;
  updateControls(item);
  if (storyShell) {
    storyShell.classList.toggle("is-centered-scene", ["travel", "puzzles", "standing", "final", "facts"].includes(item.kind));
    storyShell.dataset.activeKind = item.kind;
  }
  if (item.kind === "travel") {
    const p = renderTravel(progress);
    shouldAutoTick = p < 1;
  }
  if (item.kind === "puzzles") renderPuzzles(progress);
  if (item.kind === "round") {
    const p = renderRound(item.round, progress);
    shouldAutoTick = !roundAuto.paused && p < 1;
  }
  if (item.kind === "standing") {
    const p = renderStanding(item.round, progress);
    shouldAutoTick = p < 1;
  }
  if (item.kind === "final") {
    const p = renderFinal(progress);
    shouldAutoTick = p < 1;
  }
  if (item.kind === "facts") renderFacts(progress);
  if (shouldAutoTick) requestUpdate();
}

function requestUpdate() {
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(update);
  }
}

function renderPuzzles(_rawProgress) {
  if (currentSceneKey !== "puzzles") {
    currentSceneKey = "puzzles";
    const body = sceneShell("The six puzzles", "A quick visual inventory before the race begins.");
    body.innerHTML = `
      <div class="puzzle-overview-grid">
        ${DATA.rounds.map((r) => `<article class="puzzle-overview-card" style="--round-color:${r.color}"><img src="${r.image}" alt="Challenge ${r.round} puzzle"><div>Challenge ${r.round}: ${esc(r.label)}</div></article>`).join("")}
      </div>
    `;
  }
}

function setupGallery() {
  gallery.innerHTML = "";
}

setupHero();
setupGallery();
prevPageButton?.addEventListener("click", () => scrollToChapter(activeIndex - 1));
nextPageButton?.addEventListener("click", () => scrollToChapter(activeIndex + 1));
replayPageButton?.addEventListener("click", replayActiveScene);
pausePageButton?.addEventListener("click", toggleRoundPause);
returnTopButton?.addEventListener("click", () => scrollToChapter(0));
window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", () => { currentSceneKey = ""; requestUpdate(); });
requestUpdate();
