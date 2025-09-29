// main.js — robust wiring for single global strength slider + simulation
'use strict';

/* --------------------
   State
   -------------------- */
let currentScenario = 'single';
let isDragging = false;
let plotPoints = [];
let fieldLines = [];
let isDrawingMode = false;
let isDrawing = false;
let currentPath = [];

/* DOM refs (resolved on DOMContentLoaded) */
let compass = null;
let needle = null;
let simulationArea = null;

/* Advanced UI refs */
let advancedToggleInput = null;
let advancedPanelEl = null;
let globalStrengthRange = null;
let globalStrengthNumber = null;

/* Global multiplier (default) */
let globalMagnetStrength = 1.0;
let advancedVisible = false;

/* --------------------
   Utility: safe query by id with retries
   -------------------- */
function waitForElement(id, timeout = 2000) {
  // Returns a promise resolving to the element or null if not found within timeout
  return new Promise((resolve) => {
    const el = document.getElementById(id);
    if (el) return resolve(el);
    const start = Date.now();
    const iv = setInterval(() => {
      const e = document.getElementById(id);
      if (e) {
        clearInterval(iv);
        resolve(e);
      } else if (Date.now() - start > timeout) {
        clearInterval(iv);
        resolve(null);
      }
    }, 50);
  });
}

/* --------------------
   Initialization
   -------------------- */
async function init() {
  // Resolve core DOM nodes (try immediately then fallback)
  compass = document.getElementById('compass') || null;
  needle = document.getElementById('needle') || null;
  simulationArea = document.getElementById('simulationArea') || null;

  // If any core node missing, try again (gives a short grace window)
  if (!compass || !needle || !simulationArea) {
    // wait up to 1s for DOM to settle
    compass = await waitForElement('compass', 1000) || compass;
    needle = await waitForElement('needle', 1000) || needle;
    simulationArea = await waitForElement('simulationArea', 1000) || simulationArea;
  }

  // Wire advanced UI (robust)
  await initAdvancedToggle();

  // Initialize simulation handlers
  initSimulation();
}

/* --------------------
   Simulation init + event wiring
   -------------------- */
function initSimulation() {
  if (!compass) compass = document.getElementById('compass');
  if (!needle) needle = document.getElementById('needle');
  if (!simulationArea) simulationArea = document.getElementById('simulationArea');

  // default compass position
  if (compass) {
    compass.style.left = '50px';
    compass.style.top = '50px';
  }

  // simulation area handlers
  if (simulationArea) {
    simulationArea.removeEventListener('click', onSimulationClick);
    simulationArea.addEventListener('click', onSimulationClick);
    simulationArea.removeEventListener('mousedown', onSimulationMouseDown);
    simulationArea.addEventListener('mousedown', onSimulationMouseDown);
    simulationArea.removeEventListener('mousemove', onSimulationMouseMove);
    simulationArea.addEventListener('mousemove', onSimulationMouseMove);
    simulationArea.removeEventListener('mouseup', onSimulationMouseUp);
    simulationArea.addEventListener('mouseup', onSimulationMouseUp);
  }

  if (compass) {
    compass.removeEventListener('mousedown', onCompassMouseDown);
    compass.addEventListener('mousedown', onCompassMouseDown);
  }

  // create default scenario
  const activeBtn = document.querySelector('.scenario-btn.active');
  setScenario('single', activeBtn);

  // initial needle update
  updateCompassNeedle();
}

/* --------------------
   Scenarios / magnets
   -------------------- */
function setScenario(scenario, btn) {
  currentScenario = scenario;
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // remove magnets + drawings
  document.querySelectorAll('.magnet').forEach(m => m.remove());
  clearAll();

  if (scenario === 'single') {
    createMagnet(400, 250, 120, 60, 'north', 'N', 1.0);
    createMagnet(520, 250, 120, 60, 'south', 'S', 1.0);
  } else if (scenario === 'attract') {
    createMagnet(200, 250, 100, 50, 'north', 'N', 1.0);
    createMagnet(120, 250, 100, 50, 'south', 'S', 1.0);
    createMagnet(600, 250, 100, 50, 'south', 'S', 1.0);
    createMagnet(680, 250, 100, 50, 'north', 'N', 1.0);
  } else if (scenario === 'repel') {
    createMagnet(200, 250, 100, 50, 'north', 'N', 1.0);
    createMagnet(120, 250, 100, 50, 'south', 'S', 1.0);
    createMagnet(600, 250, 100, 50, 'north', 'N', 1.0);
    createMagnet(680, 250, 100, 50, 'south', 'S', 1.0);
  }

  // update needle
  updateCompassNeedle();
}

function createMagnet(x, y, w, h, pole, label, strength = 1.0) {
  if (!simulationArea) return null;
  const m = document.createElement('div');
  m.className = `magnet ${pole}`;
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  m.style.width = w + 'px';
  m.style.height = h + 'px';
  m.textContent = label;
  m.dataset.strength = String(strength);
  simulationArea.appendChild(m);
  return m;
}

/* --------------------
   Field calculation (uses globalMagnetStrength)
   -------------------- */
function updateCompassNeedle() {
  try {
    if (!compass || !needle || !simulationArea) return;

    const compassRect = compass.getBoundingClientRect();
    const areaRect = simulationArea.getBoundingClientRect();
    const compassX = compassRect.left - areaRect.left + 30;
    const compassY = compassRect.top - areaRect.top + 30;

    let totalFieldX = 0;
    let totalFieldY = 0;

    // inside updateCompassNeedle(), replace the magnets.forEach(...) block with:

const magnets = document.querySelectorAll('.magnet');
magnets.forEach(magnet => {
  const mr = magnet.getBoundingClientRect();
  const isHorizontal = mr.width >= mr.height;
  const baseStrength = parseFloat(magnet.dataset.strength) || 1;

  // choose two pole positions near the element ends (inset slightly so they're visibly at the ends)
  if (isHorizontal) {
    const leftPole = {
      x: mr.left - areaRect.left + 4,                     // small inset from left edge
      y: mr.top  - areaRect.top  + mr.height / 2,
      polarity: magnet.classList.contains('north') ? 1 : -1
    };
    const rightPole = {
      x: mr.left - areaRect.left + mr.width - 4,          // small inset from right edge
      y: mr.top  - areaRect.top  + mr.height / 2,
      polarity: magnet.classList.contains('north') ? 1 : -1
    };
    // split baseStrength between the two poles (so total strength equals baseStrength)
    [leftPole, rightPole].forEach(pole => {
      const dx = compassX - pole.x;
      const dy = compassY - pole.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0.0001) {
        const poleStrength = (5000 * (baseStrength/2) * globalMagnetStrength) / (dist * dist);
        totalFieldX += pole.polarity * poleStrength * dx / dist;
        totalFieldY += pole.polarity * poleStrength * dy / dist;
      }
    });
  } else {
    // vertical magnet: top and bottom poles
    const topPole = {
      x: mr.left - areaRect.left + mr.width / 2,
      y: mr.top  - areaRect.top  + 4,
      polarity: magnet.classList.contains('north') ? 1 : -1
    };
    const bottomPole = {
      x: mr.left - areaRect.left + mr.width / 2,
      y: mr.top  - areaRect.top  + mr.height - 4,
      polarity: magnet.classList.contains('north') ? 1 : -1
    };
    [topPole, bottomPole].forEach(pole => {
      const dx = compassX - pole.x;
      const dy = compassY - pole.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0.0001) {
        const poleStrength = (5000 * (baseStrength/2) * globalMagnetStrength) / (dist * dist);
        totalFieldX += pole.polarity * poleStrength * dx / dist;
        totalFieldY += pole.polarity * poleStrength * dy / dist;
      }
    });
  }
});


    const magnitude = Math.sqrt(totalFieldX*totalFieldX + totalFieldY*totalFieldY);
    console.debug('Field total magnitude:', magnitude.toFixed(2), 'global multiplier:', globalMagnetStrength);

    const angle = Math.atan2(totalFieldY, totalFieldX) * 180 / Math.PI;
    needle.style.transform = `rotate(${angle}deg)`;
  } catch (err) {
    console.error('updateCompassNeedle error:', err);
  }
}

/* --------------------
   Interaction handlers (unchanged)
   -------------------- */
function onSimulationClick(e) {
  if (isDragging || isDrawing) return;
  if (!simulationArea) return;
  const rect = simulationArea.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (e.target === compass || e.target === needle || e.target.classList.contains('magnet')) return;
  if (!isDrawingMode) {
    const p = document.createElement('div');
    p.className = 'plot-point';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    simulationArea.appendChild(p);
    plotPoints.push({ x, y, element: p });
  }
}
function onSimulationMouseDown(e) {
  if (!isDrawingMode || isDragging) return;
  if (!simulationArea) return;
  if (e.target === compass || e.target === needle || e.target.classList.contains('magnet')) return;
  const rect = simulationArea.getBoundingClientRect();
  isDrawing = true;
  currentPath = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
  e.preventDefault();
}
function onSimulationMouseMove(e) {
  if (!isDrawing) return;
  if (!simulationArea) return;
  const rect = simulationArea.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  currentPath.push({ x, y });
  if (currentPath.length >= 2) {
    const prev = currentPath[currentPath.length - 2];
    const curr = currentPath[currentPath.length - 1];
    drawLineSegment(prev.x, prev.y, curr.x, curr.y);
  }
}
function onSimulationMouseUp() {
  if (isDrawing) {
    isDrawing = false;
    currentPath = [];
  }
}
function onCompassMouseDown(e) {
  if (!compass || !simulationArea) return;
  isDragging = true;
  compass.style.cursor = 'grabbing';
  const startX = e.clientX - compass.offsetLeft;
  const startY = e.clientY - compass.offsetTop;
  function moveHandler(ev) {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(simulationArea.offsetWidth - 60, ev.clientX - startX));
    const newY = Math.max(0, Math.min(simulationArea.offsetHeight - 60, ev.clientY - startY));
    compass.style.left = newX + 'px';
    compass.style.top = newY + 'px';
    updateCompassNeedle();
  }
  function upHandler() {
    isDragging = false;
    compass.style.cursor = 'grab';
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
  }
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
}

/* drawing helpers */
function toggleDrawMode() {
  isDrawingMode = !isDrawingMode;
  const btn = document.getElementById('drawModeBtn');
  if (isDrawingMode) {
    if (btn) btn.classList.add('active');
    if (simulationArea) simulationArea.classList.add('drawing-mode');
    btn.textContent = "Drawing mode on";
  } else {
    if (btn) btn.classList.remove('active');
    if (simulationArea) simulationArea.classList.remove('drawing-mode');
    isDrawing = false;
    currentPath = [];
     btn.textContent = "Drawing mode off";
  }
}
function drawLineSegment(x1, y1, x2, y2) {
  if (!simulationArea) return;
  const dx = x2 - x1; const dy = y2 - y1;
  const length = Math.sqrt(dx*dx + dy*dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const line = document.createElement('div');
  line.className = 'drawn-line';
  line.style.left = x1 + 'px';
  line.style.top = y1 + 'px';
  line.style.width = length + 'px';
  line.style.height = '2px';
  line.style.transform = `rotate(${angle}deg)`;
  line.style.transformOrigin = '0 50%';
  simulationArea.appendChild(line);
  fieldLines.push(line);
}

/* clear */
function clearAll() {
  plotPoints.forEach(p => p.element.remove());
  plotPoints = [];
  document.querySelectorAll('.field-line, .drawn-line').forEach(l => l.remove());
  fieldLines = [];
  if (isDrawingMode) toggleDrawMode();
}

/* --------------------
   Advanced UI wiring (robust)
   -------------------- */
async function initAdvancedToggle() {
  // try to locate elements; wait a short while if missing
  advancedToggleInput = document.getElementById('advancedToggleInput') || await waitForElement('advancedToggleInput', 1000);
  advancedPanelEl = document.getElementById('advancedPanel') || await waitForElement('advancedPanel', 1000);
  globalStrengthRange = document.getElementById('globalStrengthRange') || await waitForElement('globalStrengthRange', 1000);
  globalStrengthNumber = document.getElementById('globalStrengthNumber') || await waitForElement('globalStrengthNumber', 1000);

  if (!globalStrengthRange || !globalStrengthNumber) {
    console.info('Advanced global strength controls not found — skipping advanced wiring.');
    return;
  }

  // initialize value
  globalMagnetStrength = Number(globalStrengthRange.value) || 1.0;
  globalStrengthRange.value = globalMagnetStrength;
  globalStrengthNumber.value = globalMagnetStrength;

  // event handler
  const apply = (v) => {
    globalMagnetStrength = Number(v) || 0;
    globalStrengthRange.value = globalMagnetStrength;
    globalStrengthNumber.value = globalMagnetStrength;
    console.debug('Global strength changed →', globalMagnetStrength);
    updateCompassNeedle();
  };

  // wire events, but guard against missing nodes
  try {
    globalStrengthRange.addEventListener('input', (e) => apply(e.target.value));
    globalStrengthNumber.addEventListener('input', (e) => {
      if (e.target.value === '') return;
      const v = Math.max(0, Math.min(5, Number(e.target.value)));
      apply(v);
    });
  } catch (err) {
    console.warn('Failed to attach advanced control listeners', err);
  }

  // also update aria/visibility if toggle exists
  if (advancedToggleInput && advancedPanelEl) {
    advancedVisible = advancedToggleInput.checked;
    advancedPanelEl.classList.toggle('hidden', !advancedVisible);
    advancedPanelEl.setAttribute('aria-hidden', String(!advancedVisible));
    advancedToggleInput.setAttribute('aria-expanded', String(advancedVisible));

    advancedToggleInput.addEventListener('change', (e) => {
      advancedVisible = e.target.checked;
      advancedPanelEl.classList.toggle('hidden', !advancedVisible);
      advancedPanelEl.setAttribute('aria-hidden', String(!advancedVisible));
      advancedToggleInput.setAttribute('aria-expanded', String(advancedVisible));
    });
  }
}

/* compatibility helpers (no-ops safe) */
function toggleAdvanced() {
  if (!advancedToggleInput) {
    advancedVisible = !advancedVisible;
    if (advancedPanelEl) {
      advancedPanelEl.classList.toggle('hidden', !advancedVisible);
      advancedPanelEl.setAttribute('aria-hidden', String(!advancedVisible));
    }
    return;
  }
  advancedToggleInput.checked = !advancedToggleInput.checked;
  advancedToggleInput.dispatchEvent(new Event('change', { bubbles: true }));
}
function refreshAdvancedPanel() { /* no-op — single global control */ }

/* --------------------
   Launch
   -------------------- */
document.addEventListener('DOMContentLoaded', init);