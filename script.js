// main.js — simplified compass + magnets + drawing (pointer events, no advanced UI)
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

/* DOM refs */
let compass = null;
let needle = null;
let simulationArea = null;

/* Global multiplier (default) */
let globalMagnetStrength = 1.0;

/* --------------------
   Utility: safe query by id with retries
-------------------- */
function waitForElement(id, timeout = 2000) {
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
  compass = document.getElementById('compass') || await waitForElement('compass', 1000);
  needle = document.getElementById('needle') || await waitForElement('needle', 1000);
  simulationArea = document.getElementById('simulationArea') || await waitForElement('simulationArea', 1000);

  initSimulation();
}

/* --------------------
   Simulation init + event wiring
-------------------- */
function initSimulation() {
  if (!compass || !needle || !simulationArea) return;

  compass.style.left = '50px';
  compass.style.top = '50px';

  // Pointer events for drawing
  simulationArea.addEventListener('click', onSimulationClick);
  simulationArea.addEventListener('pointerdown', onSimulationPointerDown);
  simulationArea.addEventListener('pointermove', onSimulationPointerMove);
  simulationArea.addEventListener('pointerup', onSimulationPointerUp);
  simulationArea.addEventListener('pointercancel', onSimulationPointerUp);

  // Compass dragging
  compass.addEventListener('pointerdown', onCompassPointerDown);

  // Default scenario
  const activeBtn = document.querySelector('.scenario-btn.active');
  setScenario('single', activeBtn);

  // Initial needle update
  updateCompassNeedle();
}

/* --------------------
   Scenarios / magnets
-------------------- */
function setScenario(scenario, btn) {
  currentScenario = scenario;
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

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
   Field calculation
-------------------- */
function updateCompassNeedle() {
  if (!compass || !needle || !simulationArea) return;

  const compassRect = compass.getBoundingClientRect();
  const areaRect = simulationArea.getBoundingClientRect();
  const compassX = compassRect.left - areaRect.left + compassRect.width / 2;
  const compassY = compassRect.top - areaRect.top + compassRect.height / 2;

  let totalFieldX = 0;
  let totalFieldY = 0;

  const magnets = document.querySelectorAll('.magnet');
  magnets.forEach(magnet => {
    const mr = magnet.getBoundingClientRect();
    const isHorizontal = mr.width >= mr.height;
    const baseStrength = parseFloat(magnet.dataset.strength) || 1;

    if (isHorizontal) {
      const leftPole = { x: mr.left - areaRect.left + 4, y: mr.top - areaRect.top + mr.height / 2, polarity: magnet.classList.contains('north') ? 1 : -1 };
      const rightPole = { x: mr.left - areaRect.left + mr.width - 4, y: mr.top - areaRect.top + mr.height / 2, polarity: magnet.classList.contains('north') ? 1 : -1 };
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
      const topPole = { x: mr.left - areaRect.left + mr.width / 2, y: mr.top - areaRect.top + 4, polarity: magnet.classList.contains('north') ? 1 : -1 };
      const bottomPole = { x: mr.left - areaRect.left + mr.width / 2, y: mr.top - areaRect.top + mr.height - 4, polarity: magnet.classList.contains('north') ? 1 : -1 };
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

  const angle = Math.atan2(totalFieldY, totalFieldX) * 180 / Math.PI;
  needle.style.transform = `rotate(${angle}deg)`;
}

/* --------------------
   Interaction handlers
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

/* --- Pointer-based drawing ---
     works for mouse and touch
-------------------------------- */
function onSimulationPointerDown(e) {
  if (!isDrawingMode || isDragging) return;
  if (e.target === compass || e.target === needle || e.target.classList.contains('magnet')) return;
  const rect = simulationArea.getBoundingClientRect();
  isDrawing = true;
  currentPath = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
  e.preventDefault();
}

function onSimulationPointerMove(e) {
  if (!isDrawing) return;
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

function onSimulationPointerUp() {
  if (isDrawing) {
    isDrawing = false;
    currentPath = [];
  }
}

/* --------------------
   Compass dragging
-------------------- */
function onCompassPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (!compass || !simulationArea) return;

  isDragging = true;
  compass.style.cursor = 'grabbing';
  const areaRect = simulationArea.getBoundingClientRect();
  const compassRect = compass.getBoundingClientRect();
  const offsetX = e.clientX - compassRect.left;
  const offsetY = e.clientY - compassRect.top;

  function onPointerMove(ev) {
    if (!isDragging) return;
    ev.preventDefault();
    let newX = ev.clientX - areaRect.left - offsetX;
    let newY = ev.clientY - areaRect.top - offsetY;
    newX = Math.max(0, Math.min(simulationArea.clientWidth - compass.offsetWidth, newX));
    newY = Math.max(0, Math.min(simulationArea.clientHeight - compass.offsetHeight, newY));
    compass.style.left = newX + 'px';
    compass.style.top = newY + 'px';
    updateCompassNeedle();
  }

  function onPointerUp() {
    isDragging = false;
    compass.style.cursor = 'grab';
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  }

  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);

  if (typeof e.pointerId === 'number' && compass.setPointerCapture) {
    try { compass.setPointerCapture(e.pointerId); } catch {}
  }
}

/* --------------------
   Drawing helpers
-------------------- */
function toggleDrawMode() {
  isDrawingMode = !isDrawingMode;
  const btn = document.getElementById('drawModeBtn');
  if (isDrawingMode) {
    if (btn) btn.classList.add('active');
    if (simulationArea) simulationArea.classList.add('drawing-mode');
    if (btn) btn.textContent = "Drawing mode on";
  } else {
    if (btn) btn.classList.remove('active');
    if (simulationArea) simulationArea.classList.remove('drawing-mode');
    isDrawing = false;
    currentPath = [];
    if (btn) btn.textContent = "Drawing mode off";
  }
}

function drawLineSegment(x1, y1, x2, y2) {
  if (!simulationArea) return;
  const dx = x2 - x1, dy = y2 - y1;
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

/* --------------------
   Clear everything
-------------------- */
function clearAll() {
  plotPoints.forEach(p => p.element.remove());
  plotPoints = [];
  document.querySelectorAll('.field-line, .drawn-line').forEach(l => l.remove());
  fieldLines = [];
  if (isDrawingMode) toggleDrawMode();
}

/* --------------------
   Launch
-------------------- */
document.addEventListener('DOMContentLoaded', init);
