/**
 * Inference-Time Scaling Explainer: Interactive Application Logic (site/app.js)
 * Zero external frameworks. Pure vanilla ES6+ with accessible SVG charting,
 * keyboard controls, and real precomputed trace replay.
 */

// Application State
const state = {
  accuracyData: null,
  tracesData: null,
  bdhData: null,
  mazeLoadError: null,
  currentPuzzleIdx: 0,
  currentK: 1,
  chartMode: "aggregate",
  autoTimer: null,
};

// Fallback embedded data in case file:/// protocol blocks local fetch
const DEFAULT_BDH_DATA = {
  provenance: "EXTERNAL_REPORTED",
  source_paper: {
    title: "BDH-CQ: In-Context Learning with Recurrent Latent Reasoning",
    authors: "Kosowski et al.",
    arxiv_id: "arXiv:2608.09888",
    table: "Table 5"
  },
  effort_levels: [
    { level: "LOW", pass_at_2: 21.0, cost_reduction_pct: 22.0, relative_cost_pct: 78.0, desc: "Reduced reasoning effort: -22% compute cost, 21.0% pass@2." },
    { level: "MEDIUM", pass_at_2: 27.0, cost_reduction_pct: 11.0, relative_cost_pct: 89.0, desc: "Intermediate reasoning effort: +6.0% accuracy gain, -11% compute cost." },
    { level: "HIGH", pass_at_2: 29.5, cost_reduction_pct: 0.0, relative_cost_pct: 100.0, desc: "Full reasoning effort: 29.5% pass@2 baseline with diminishing returns." }
  ]
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
  renderSliderTicks();
  renderPuzzleTabs();
  updateMazeDisplay();
  renderScalingChart();
  renderBdhCards();
});

/**
 * Loads precomputed JSON data records
 */
async function loadData() {
  const loadJson = async (paths) => {
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: "no-store" });
        if (response.ok) return await response.json();
      } catch (err) {
        // Try the next valid deployment location. This also covers file://, where fetch is blocked.
      }
    }
    return null;
  };

  const [accuracyData, tracesData, bdhData] = await Promise.all([
    loadJson(["data/accuracy_by_effort.json", "site/data/accuracy_by_effort.json", "../results/accuracy_by_effort.json", "results/accuracy_by_effort.json"]),
    loadJson(["data/example_traces.json", "site/data/example_traces.json", "../results/example_traces.json", "results/example_traces.json"]),
    loadJson(["data/bdh_cq_reference.json", "site/data/bdh_cq_reference.json", "../results/bdh_cq_reference.json", "results/bdh_cq_reference.json"]),
  ]);

  state.accuracyData = accuracyData;
  state.tracesData = tracesData;
  state.bdhData = bdhData;
  if (!state.tracesData) {
    state.mazeLoadError = "Maze trace data could not be loaded. Serve this folder with a local web server or deploy the site directory together with site/data/.";
  }

  // Ensure BDH data is available
  if (!state.bdhData) {
    state.bdhData = DEFAULT_BDH_DATA;
  }
}

/**
 * Attach UI event listeners
 */
function setupEventListeners() {
  const slider = document.getElementById("effort-slider");
  const stepDecrement = document.getElementById("btn-step-prev");
  const stepIncrement = document.getElementById("btn-step-next");
  const autoButton = document.getElementById("btn-auto-effort");

  // Determine max K from accuracy data if available
  const maxK = state.accuracyData && state.accuracyData.scaling_curve
    ? Math.max(...state.accuracyData.scaling_curve.map(pt => pt.step))
    : 20;

  const onSliderChange = (val) => {
    state.currentK = parseInt(val, 10);
    if (slider) {
      slider.value = state.currentK;
      slider.setAttribute("aria-valuenow", state.currentK);
    }
    updateMazeDisplay();
    renderScalingChart();
  };

  if (slider) {
    slider.setAttribute("aria-valuemax", maxK);
    slider.max = maxK;
    slider.addEventListener("input", (e) => onSliderChange(e.target.value));
    slider.addEventListener("change", (e) => onSliderChange(e.target.value));
  }

  if (stepDecrement) {
    stepDecrement.addEventListener("click", () => {
      if (state.currentK > 1) {
        onSliderChange(state.currentK - 1);
      }
    });
  }

  if (stepIncrement) {
    stepIncrement.addEventListener("click", () => {
      if (state.currentK < maxK) {
        onSliderChange(state.currentK + 1);
      }
    });
  }

  const stopAuto = () => {
    if (state.autoTimer) window.clearInterval(state.autoTimer);
    state.autoTimer = null;
    if (autoButton) {
      autoButton.innerHTML = "&#9654; Auto";
      autoButton.setAttribute("aria-pressed", "false");
    }
  };

  if (autoButton) {
    autoButton.addEventListener("click", () => {
      if (state.autoTimer) {
        stopAuto();
        return;
      }
      autoButton.textContent = "Stop";
      autoButton.setAttribute("aria-pressed", "true");
      state.autoTimer = window.setInterval(() => {
        const puzzle = state.tracesData?.puzzles?.[state.currentPuzzleIdx];
        const currentStep = puzzle?.steps?.[String(state.currentK)];
        if (!puzzle || currentStep?.is_solved || state.currentK >= maxK) {
          stopAuto();
          return;
        }
        onSliderChange(state.currentK + 1);
        if (puzzle.steps[String(state.currentK)]?.is_solved || state.currentK >= maxK) stopAuto();
      }, 700);
    });
  }

  // Chart View Toggle (100-Maze Aggregate vs Single Puzzle Trace)
  const btnViewAggregate = document.getElementById("btn-view-aggregate");
  const btnViewTrace = document.getElementById("btn-view-trace");
  if (btnViewAggregate && btnViewTrace) {
    btnViewAggregate.addEventListener("click", () => {
      state.chartMode = "aggregate";
      btnViewAggregate.classList.add("active");
      btnViewAggregate.setAttribute("aria-selected", "true");
      btnViewTrace.classList.remove("active");
      btnViewTrace.setAttribute("aria-selected", "false");
      renderScalingChart();
    });
    btnViewTrace.addEventListener("click", () => {
      state.chartMode = "trace";
      btnViewTrace.classList.add("active");
      btnViewTrace.setAttribute("aria-selected", "true");
      btnViewAggregate.classList.remove("active");
      btnViewAggregate.setAttribute("aria-selected", "false");
      renderScalingChart();
    });
  }

  // Keyboard navigation shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "range") return;
    if (e.key === "ArrowLeft" && state.currentK > 1) {
      onSliderChange(state.currentK - 1);
    } else if (e.key === "ArrowRight" && state.currentK < maxK) {
      onSliderChange(state.currentK + 1);
    }
  });
}

function renderSliderTicks() {
  const ticksContainer = document.getElementById("slider-ticks");
  if (!ticksContainer) return;

  const maxK = state.accuracyData && state.accuracyData.scaling_curve
    ? Math.max(...state.accuracyData.scaling_curve.map(pt => pt.step))
    : 20;

  ticksContainer.innerHTML = "";
  for (let k = 1; k <= maxK; k++) {
    const span = document.createElement("span");
    span.textContent = `K=${k}`;
    ticksContainer.appendChild(span);
  }
}

/**
 * Render puzzle selection tabs
 */
function renderPuzzleTabs() {
  const tabsContainer = document.getElementById("puzzle-tabs");
  if (!tabsContainer || !state.tracesData || !state.tracesData.puzzles) return;

  tabsContainer.innerHTML = "";
  state.tracesData.puzzles.forEach((puzzle, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${idx === state.currentPuzzleIdx ? "active" : ""}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", idx === state.currentPuzzleIdx ? "true" : "false");
    btn.textContent = puzzle.title || `Puzzle ${idx + 1}`;
    btn.addEventListener("click", () => {
      if (state.autoTimer) {
        window.clearInterval(state.autoTimer);
        state.autoTimer = null;
        const autoButton = document.getElementById("btn-auto-effort");
        if (autoButton) {
          autoButton.innerHTML = "&#9654; Auto";
          autoButton.setAttribute("aria-pressed", "false");
        }
      }
      state.currentPuzzleIdx = idx;
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      updateMazeDisplay();
      renderScalingChart();
    });
    tabsContainer.appendChild(btn);
  });
}

/**
 * Update maze grids and live metrics based on selected puzzle and K
 */
function updateMazeDisplay() {
  const effortNumEl = document.getElementById("effort-val-display");
  if (effortNumEl) effortNumEl.textContent = state.currentK;

  if (!state.tracesData || !state.tracesData.puzzles) {
    renderMazeLoadError();
    return;
  }

  /* Deprecated duplicate auto handler; controls are registered in setupEventListeners.
  const stopAuto = () => {
    if (state.autoTimer) window.clearInterval(state.autoTimer);
    state.autoTimer = null;
    if (autoButton) {
      autoButton.innerHTML = "&#9654; Auto";
      autoButton.setAttribute("aria-pressed", "false");
    }
  };

  if (autoButton) {
    autoButton.addEventListener("click", () => {
      if (state.autoTimer) {
        stopAuto();
        return;
      }
      autoButton.textContent = "■ Stop";
      autoButton.setAttribute("aria-pressed", "true");
      state.autoTimer = window.setInterval(() => {
        const puzzle = state.tracesData?.puzzles?.[state.currentPuzzleIdx];
        const currentStep = puzzle?.steps?.[String(state.currentK)];
        if (!puzzle || currentStep?.is_solved || state.currentK >= maxK) {
          stopAuto();
          return;
        }
        onSliderChange(state.currentK + 1);
        if (puzzle.steps[String(state.currentK)]?.is_solved || state.currentK >= maxK) stopAuto();
      }, 700);
    });
  }
  */

  const puzzle = state.tracesData.puzzles[state.currentPuzzleIdx];
  if (!puzzle) return;

  const kStr = String(state.currentK);
  const stepData = puzzle.steps[kStr];

  // Update Status Pill
  const statusContainer = document.getElementById("maze-status-pill");
  if (statusContainer && stepData) {
    if (stepData.is_solved) {
      statusContainer.className = "status-pill status-solved";
      statusContainer.innerHTML = "<span>&#10003;</span> Path Solved &amp; Connected";
    } else {
      statusContainer.className = "status-pill status-unsolved";
      statusContainer.innerHTML = "<span>&#9888;</span> Incomplete / Dead End";
    }
  }

  // Update Live Metrics
  const metricIou = document.getElementById("metric-iou");
  const metricSolve = document.getElementById("metric-solve");
  const metricCompute = document.getElementById("metric-compute");

  if (metricIou && stepData) metricIou.textContent = `${(stepData.iou * 100).toFixed(1)}%`;
  if (metricSolve && stepData) metricSolve.textContent = stepData.is_solved ? "YES" : "NO";
  if (metricCompute) metricCompute.textContent = `K = ${state.currentK}`;

  // Render Predicted Grid
  const predBoard = document.getElementById("pred-maze-board");
  if (predBoard) {
    renderGrid(predBoard, puzzle, stepData ? stepData.predicted_path : [], false);
  }

  // Render Ground Truth Grid
  const gtBoard = document.getElementById("gt-maze-board");
  if (gtBoard) {
    renderGrid(gtBoard, puzzle, puzzle.ground_truth_path, true);
  }
}

/** Render a clear, accessible state instead of leaving empty maze boards. */
function renderMazeLoadError() {
  const statusContainer = document.getElementById("maze-status-pill");
  if (statusContainer) {
    statusContainer.className = "status-pill status-unsolved";
    statusContainer.innerHTML = "<span>&#9888;</span> Maze data unavailable";
  }

  ["pred-maze-board", "gt-maze-board"].forEach((id) => {
    const board = document.getElementById(id);
    if (board) {
      board.innerHTML = `<p class="maze-load-error" role="alert">${state.mazeLoadError}</p>`;
    }
  });
}

/**
 * Compute wall line segments for SVG maze rendering
 */
function computeWallSegments(walls, size) {
  const segments = [];
  const seen = new Set();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (walls[r][c] >= 0.5) continue;

      const checks = [
        { dr: -1, dc:  0, x1: c,     y1: r,     x2: c + 1, y2: r     },
        { dr:  1, dc:  0, x1: c,     y1: r + 1, x2: c + 1, y2: r + 1 },
        { dr:  0, dc: -1, x1: c,     y1: r,     x2: c,     y2: r + 1 },
        { dr:  0, dc:  1, x1: c + 1, y1: r,     x2: c + 1, y2: r + 1 },
      ];

      for (const chk of checks) {
        const nr = r + chk.dr;
        const nc = c + chk.dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || walls[nr][nc] >= 0.5) {
          const k = `${Math.min(chk.x1,chk.x2)},${Math.min(chk.y1,chk.y2)},${Math.max(chk.x1,chk.x2)},${Math.max(chk.y1,chk.y2)}`;
          if (!seen.has(k)) {
            seen.add(k);
            segments.push({ x1: chk.x1, y1: chk.y1, x2: chk.x2, y2: chk.y2 });
          }
        }
      }
    }
  }

  return segments;
}

/**
 * Build SVG string for wall segments
 */
function buildWallSVG(walls, segments, size) {
  // Corridors (paths) are open cells where walls[r][c] < 0.5 -> rendered pure white
  const openCells = walls.flatMap((row, r) => row.map((cell, c) => (
    cell < 0.5 ? `<rect x="${c}" y="${r}" width="1" height="1" fill="#ffffff"/>` : ""
  ))).join("");
  const lines = segments
    .map(s => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="#0f172a" stroke-width="0.10" stroke-linecap="square"/>`)
    .join("");

  // Base background is dark slate grey / black (#1e293b) representing the walls
  return `<svg viewBox="0 0 ${size} ${size}" class="maze-svg" role="img" aria-label="Maze line drawing">
    <rect width="${size}" height="${size}" fill="#1e293b"/>
    <g>${openCells}</g>
    <rect width="${size}" height="${size}" fill="none" stroke="#0f172a" stroke-width="0.12"/>
    <g>${lines}</g>
  </svg>`;
}

/**
 * Add start/goal markers to SVG string
 */
function addMarkers(svgString, puzzle, size) {
  const startX = puzzle.start[1] + 0.5;
  const startY = puzzle.start[0] + 0.5;
  const goalX  = puzzle.goal[1] + 0.5;
  const goalY  = puzzle.goal[0] + 0.5;

  const markers = `
    <circle cx="${startX}" cy="${startY}" r="0.26" fill="#2563eb" stroke="#ffffff" stroke-width="0.05" class="maze-start-marker"/>
    <text x="${startX}" y="${startY}" text-anchor="middle" dominant-baseline="central"
          font-size="0.32" font-weight="800" fill="#ffffff" font-family="monospace">S</text>
    <circle cx="${goalX}" cy="${goalY}" r="0.26" fill="#ec4899" stroke="#ffffff" stroke-width="0.05" class="maze-goal-marker"/>
    <text x="${goalX}" y="${goalY}" text-anchor="middle" dominant-baseline="central"
          font-size="0.32" font-weight="800" fill="#ffffff" font-family="monospace">G</text>
  `;

  return svgString.replace("</g>", "</g>" + markers);
}

/**
 * Add path overlay line segments to SVG string
 * Draws only between grid-adjacent cells to prevent wall-cutting jumps
 */
function addPathOverlay(svgString, pathCoords, isGroundTruth) {
  if (!pathCoords || pathCoords.length < 2) return svgString;

  const color = isGroundTruth ? "#f59e0b" : "#10b981";
  const segments = [];

  for (let i = 0; i < pathCoords.length - 1; i++) {
    const [r1, c1] = pathCoords[i];
    const [r2, c2] = pathCoords[i + 1];
    const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);

    if (dist === 1) {
      const x1 = c1 + 0.5;
      const y1 = r1 + 0.5;
      const x2 = c2 + 0.5;
      const y2 = r2 + 0.5;
      const pathClass = isGroundTruth ? "maze-path-gt" : "maze-path-pred";
      segments.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="0.22" stroke-linecap="round" class="${pathClass} maze-path-animated" style="--segment-index: ${segments.length}"/>`);
    }
    // If dist > 1, break the line here (do not draw a jump)
  }

  if (segments.length === 0) return svgString;

  const pathLines = segments.join("");
  return svgString.replace("</svg>", pathLines + "</svg>");
}

/**
 * Render a maze grid as an SVG line drawing (classic paper maze style)
 */
function renderGrid(container, puzzle, pathCoords, isGroundTruth) {
  container.innerHTML = "";
  const size = puzzle.grid_size || 15;

  const segments = computeWallSegments(puzzle.walls, size);
  let svg = buildWallSVG(puzzle.walls, segments, size);
  svg = addMarkers(svg, puzzle, size);
  svg = addPathOverlay(svg, pathCoords, isGroundTruth);

  container.innerHTML = svg;
}

/** Build the selected maze's measured trace from the exported model replay. */
function getSelectedMazeCurve() {
  const puzzle = state.tracesData?.puzzles?.[state.currentPuzzleIdx];
  if (!puzzle?.steps) return [];

  const gtLen = puzzle.ground_truth_path?.length || 1;

  return Object.values(puzzle.steps)
    .sort((a, b) => a.step - b.step)
    .map((step) => {
      const predLen = step.predicted_path?.length || 0;
      // Calculate continuous progress towards goal as % of ground truth length traversed
      const progressPercent = step.is_solved ? 100 : Math.min(99, Math.round((predLen / gtLen) * 100));
      return {
        step: step.step,
        progressPercent,
        pathIouPercent: step.iou * 100,
        predictedPathCells: predLen,
        groundTruthPathCells: gtLen,
        isSolved: step.is_solved,
      };
    });
}

/** Render the empirical scaling chart (Aggregate 100-Maze or Selected Trace) */
function renderScalingChart() {
  const chartContainer = document.getElementById("scaling-chart-wrap");
  if (!chartContainer) return;

  const kIndicator = document.getElementById("chart-k-indicator");
  if (kIndicator) kIndicator.textContent = state.currentK;

  const width = 800;
  const height = 260;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxK = state.accuracyData && state.accuracyData.scaling_curve
    ? Math.max(...state.accuracyData.scaling_curve.map(pt => pt.step))
    : 20;

  const xPos = (k) => padLeft + ((k - 1) / (maxK - 1)) * chartW;
  const yPos = (pct) => padTop + chartH - (pct / 100) * chartH;
  
  const isAggregate = (state.chartMode || "aggregate") === "aggregate";
  const provBadge = document.getElementById("scaling-provenance-badge");
  const traceLabel = document.getElementById("selected-trace-label");
  const legendText = document.getElementById("chart-legend-text");
  const tableTitle = document.getElementById("table-scaling-title");
  const tableHead = document.getElementById("table-scaling-head");
  const tbody = document.getElementById("table-scaling-body");
  const verdict = document.getElementById("trace-verdict");

  if (isAggregate) {
    if (provBadge) provBadge.textContent = "● PRECOMPUTED 100-TEST EVAL";
    if (traceLabel) traceLabel.textContent = "N=100 Test Mazes | Seed=999 | ConvGRU Core";
    if (legendText) {
      legendText.innerHTML = `<span style="color: #10b981;">&mdash; Exact Solve Rate (%)</span> &nbsp;&nbsp;&bull;&nbsp;&nbsp; <span style="color: #8b5cf6;">--- Mean Path IoU (%)</span>`;
    }
    if (tableTitle) tableTitle.textContent = "100-Maze Aggregate Scaling Data";
    if (tableHead) {
      tableHead.innerHTML = `
        <tr>
          <th scope="col">Reasoning Loops (K)</th>
          <th scope="col">Exact Solve Rate (%)</th>
          <th scope="col">Mean Path IoU (%)</th>
          <th scope="col">BCE Loss</th>
          <th scope="col">Measured Latency (ms / maze)</th>
        </tr>
      `;
    }

    const curve = state.accuracyData ? state.accuracyData.scaling_curve : [];
    if (curve.length === 0) return;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="svg-chart" role="img" aria-label="100-maze aggregate empirical scaling curve">`;

    for (let yPct = 0; yPct <= 100; yPct += 20) {
      const y = yPos(yPct);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#1e293b" stroke-dasharray="3 3"/>`;
      svg += `<text x="${padLeft - 10}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end" font-family="monospace">${yPct}%</text>`;
    }

    for (let k = 1; k <= maxK; k++) {
      const x = xPos(k);
      svg += `<line x1="${x}" y1="${padTop + chartH}" x2="${x}" y2="${padTop + chartH + 5}" stroke="#475569"/>`;
      svg += `<text x="${x}" y="${padTop + chartH + 20}" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="monospace">K=${k}</text>`;
    }

    const curX = xPos(state.currentK);
    svg += `<line x1="${curX}" y1="${padTop}" x2="${curX}" y2="${padTop + chartH}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.6"/>`;

    const solvePoints = curve.map((pt) => `${xPos(pt.step)},${yPos(pt.exact_solve_percent)}`).join(" ");
    svg += `<polyline fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${solvePoints}"/>`;

    const iouPoints = curve.map((pt) => `${xPos(pt.step)},${yPos(pt.path_iou * 100)}`).join(" ");
    svg += `<polyline fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-dasharray="4 4" stroke-linecap="round" points="${iouPoints}"/>`;

    curve.forEach((pt) => {
      const x = xPos(pt.step);
      const ySolve = yPos(pt.exact_solve_percent);
      const yIou = yPos(pt.path_iou * 100);
      const isCur = pt.step === state.currentK;

      svg += `<circle cx="${x}" cy="${ySolve}" r="${isCur ? 6.5 : 4}" fill="${isCur ? '#34d399' : '#10b981'}" stroke="#0a0d14" stroke-width="2"><title>K=${pt.step}: Solve Rate = ${pt.exact_solve_percent}%</title></circle>`;
      svg += `<circle cx="${x}" cy="${yIou}" r="${isCur ? 5.5 : 3.5}" fill="${isCur ? '#c084fc' : '#8b5cf6'}" stroke="#0a0d14" stroke-width="1.5"><title>K=${pt.step}: Mean Path IoU = ${(pt.path_iou * 100).toFixed(1)}%</title></circle>`;
    });

    svg += `</svg>`;
    chartContainer.innerHTML = svg;

    if (tbody) {
      tbody.innerHTML = "";
      curve.forEach((pt) => {
        const tr = document.createElement("tr");
        if (pt.step === state.currentK) tr.style.background = "rgba(56, 189, 248, 0.08)";
        tr.innerHTML = `
          <td><strong>K = ${pt.step}</strong>${pt.step === state.currentK ? ' <span style="color:#38bdf8; font-size:0.75rem;">(Active)</span>' : ''}</td>
          <td style="color: #34d399; font-weight: 700;">${pt.exact_solve_percent}%</td>
          <td style="color: #c084fc;">${(pt.path_iou * 100).toFixed(1)}%</td>
          <td>${pt.mean_bce_loss.toFixed(4)}</td>
          <td style="font-family: monospace; color: #38bdf8;">${pt.measured_latency_ms.toFixed(3)} ms</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const curPt = curve.find(pt => pt.step === state.currentK) || curve[0];
    if (verdict && curPt) {
      verdict.className = "trace-verdict verdict-supported";
      verdict.innerHTML = `<strong>100-Maze Benchmark:</strong> At K=${curPt.step}, the model achieves an Exact Solve Rate of <strong>${curPt.exact_solve_percent}%</strong> and Mean Path IoU of <strong>${(curPt.path_iou * 100).toFixed(1)}%</strong> with latency of ${curPt.measured_latency_ms.toFixed(2)} ms/maze. Notice the steep early accuracy gains (from 1.0% up to 76.0% at K=10) that smoothly transition into diminishing returns beyond K=10.`;
    }
  } else {
    const puzzle = state.tracesData?.puzzles?.[state.currentPuzzleIdx];
    if (provBadge) provBadge.textContent = "● PRECOMPUTED TRACE REPLAY";
    if (traceLabel) traceLabel.textContent = `${puzzle ? puzzle.title : 'Puzzle'} | Precomputed output`;
    if (legendText) {
      legendText.innerHTML = `<span style="color: #10b981;">&mdash; Path Progress to Goal (%)</span> &nbsp;&nbsp;&bull;&nbsp;&nbsp; <span style="color: #8b5cf6;">--- Path IoU (%)</span>`;
    }
    if (tableTitle) tableTitle.textContent = `Selected Maze Trace Data (${puzzle ? puzzle.title : ''})`;
    if (tableHead) {
      tableHead.innerHTML = `
        <tr>
          <th scope="col">Reasoning Loops (K)</th>
          <th scope="col">Goal Reached</th>
          <th scope="col">Path Progress (%)</th>
          <th scope="col">Path IoU (%)</th>
          <th scope="col">Walk Steps / Target</th>
        </tr>
      `;
    }

    const curve = getSelectedMazeCurve();
    if (curve.length === 0) return;
    const revealedCurve = curve.filter((pt) => pt.step <= state.currentK);

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="svg-chart" role="img" aria-label="Selected maze trace replay">`;

    for (let yPct = 0; yPct <= 100; yPct += 20) {
      const y = yPos(yPct);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#1e293b" stroke-dasharray="3 3"/>`;
      svg += `<text x="${padLeft - 10}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end" font-family="monospace">${yPct}%</text>`;
    }

    for (let k = 1; k <= maxK; k++) {
      const x = xPos(k);
      svg += `<line x1="${x}" y1="${padTop + chartH}" x2="${x}" y2="${padTop + chartH + 5}" stroke="#475569"/>`;
      svg += `<text x="${x}" y="${padTop + chartH + 20}" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="monospace">K=${k}</text>`;
    }

    const progressPoints = revealedCurve.map((pt) => `${xPos(pt.step)},${yPos(pt.progressPercent)}`).join(" ");
    svg += `<polyline fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${progressPoints}"/>`;

    const iouPoints = revealedCurve.map((pt) => `${xPos(pt.step)},${yPos(pt.pathIouPercent)}`).join(" ");
    svg += `<polyline fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-dasharray="4 4" stroke-linecap="round" points="${iouPoints}"/>`;

    revealedCurve.forEach((pt) => {
      const x = xPos(pt.step);
      const yProg = yPos(pt.progressPercent);
      const yIou = yPos(pt.pathIouPercent);
      const isCur = pt.step === state.currentK;

      svg += `<circle cx="${x}" cy="${yProg}" r="${isCur ? 6.5 : 4.5}" fill="#10b981" stroke="#0a0d14" stroke-width="2"><title>K=${pt.step}: Progress = ${pt.progressPercent}%</title></circle>`;
      svg += `<circle cx="${x}" cy="${yIou}" r="${isCur ? 5.5 : 3.5}" fill="#8b5cf6" stroke="#0a0d14" stroke-width="1.5"><title>K=${pt.step}: Path IoU = ${pt.pathIouPercent.toFixed(1)}%</title></circle>`;
    });

    svg += `</svg>`;
    chartContainer.innerHTML = svg;

    if (tbody) {
      tbody.innerHTML = "";
      revealedCurve.forEach((pt) => {
        const tr = document.createElement("tr");
        if (pt.step === state.currentK) tr.style.background = "rgba(56, 189, 248, 0.08)";
        tr.innerHTML = `
          <td><strong>K = ${pt.step}</strong>${pt.step === state.currentK ? ' <span style="color:#38bdf8; font-size:0.75rem;">(Active)</span>' : ''}</td>
          <td style="color: ${pt.isSolved ? '#34d399' : '#f59e0b'}; font-weight: 700;">${pt.isSolved ? "YES (Connected)" : "Incomplete"}</td>
          <td style="color: #34d399; font-weight: 700;">${pt.progressPercent}%</td>
          <td style="color: #c084fc;">${pt.pathIouPercent.toFixed(1)}%</td>
          <td>${pt.predictedPathCells} / ${pt.groundTruthPathCells}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const current = curve.find((pt) => pt.step === state.currentK) || revealedCurve.at(-1);
    const first = curve[0];
    if (verdict && current) {
      const improvement = current.pathIouPercent - first.pathIouPercent;
      const isSupported = current.isSolved || improvement > 0;
      verdict.className = `trace-verdict ${isSupported ? "verdict-supported" : "verdict-pending"}`;
      verdict.innerHTML = `<strong>${isSupported ? "Verdict: supports the hypothesis for this trace." : "Verdict: not yet established at this K."}</strong> At K=${current.step}, Path IoU is ${current.pathIouPercent.toFixed(1)}% (${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)} points vs K=1), and Path Progress is ${current.progressPercent}%. ${current.isSolved ? "The predicted path connects start to goal!" : "The path is still navigating toward the goal."}`;
    }
  }
}

/**
 * Render BDH-CQ Table 5 Benchmark Cards (FR4)
 */
function renderBdhCards() {
  const container = document.getElementById("bdh-cards-container");
  if (!container || !state.bdhData || !state.bdhData.effort_levels) return;

  container.innerHTML = "";
  state.bdhData.effort_levels.forEach((item) => {
    const card = document.createElement("div");
    card.className = `bdh-card ${item.level === "HIGH" ? "highlight" : ""}`;
    card.innerHTML = `
      <div class="bdh-card-level">${item.level} EFFORT</div>
      <div class="bdh-card-metric">${item.pass_at_2.toFixed(1)}%</div>
      <div class="bdh-card-cost">Compute Cost: ${item.cost_reduction_pct > 0 ? `-${item.cost_reduction_pct.toFixed(0)}%` : "Baseline (100%)"}</div>
      <p class="bdh-card-desc">${item.description || item.desc || ""}</p>
    `;
    container.appendChild(card);
  });
}
