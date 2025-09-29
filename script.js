'use strict';

/* --------------------
   State
-------------------- */
let currentScenario = 'single';
let isDraggingCompass = false;
let isDrawingMode = false;
let isDrawing = false;
let currentPath = [];
let plotPoints = [];
let fieldLines = [];

let compass = null;
let needle = null;
let simulationArea = null;

let globalMagnetStrength = 1.0;

/* --------------------
   Utility
-------------------- */
function waitForElement(id, timeout = 2000) {
  return new Promise(resolve => {
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
   Init
-------------------- */
async function init() {
  compass = document.getElementById('compass') || await waitForElement('compass', 1000);
  needle = document.getElementById('needle') || await waitForElement('needle', 1000);
  simulationArea = document.getElementById('simulationArea') || await waitForElement('simulationArea', 1000);

  initSimulation();
}

/* --------------------
   Simulation wiring
-------------------- */
function initSimulation() {
  if (!compass || !needle || !simulationArea) return;

  compass.style.left = '50px';
  compass.style.top = '50px';

  simulationArea.addEventListener('click', onSimulationClick);
  simulationArea.addEventListener('pointerdown', onSimulationPointerDown);
  simulationArea.addEventListener('pointermove', onSimulationPointerMove);
  simulationArea.addEventListener('pointerup', onSimulationPointerUp);
  simulationArea.addEventListener('pointercancel', onSimulationPointerUp);

  compass.addEventListener('pointerdown', onCompassPointerDown);

  const activeBtn = document.querySelector('.scenario-btn.active');
  setScenario('single', activeBtn);
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
  }
  if (scenario === 'attract') {
    createMagnet(200, 250, 100, 50, 'north', 'N', 1.0);
    createMagnet(120, 250, 100, 50, 'south', 'S', 1.0);
    createMagnet(600, 250, 100, 50, 'south', 'S', 1.0);
    createMagnet(680, 250, 100, 50, 'north', 'N', 1.0);
  }
  if (scenario === 'repel') {
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
   Compass needle
-------------------- */
function updateCompassNeedle() {
  if (!compass || !needle || !simulationArea) return;

  const compassRect = compass.getBoundingClientRect();
  const areaRect = simulationArea.getBoundingClientRect();
  const compassX = compassRect.left - areaRect.left + compassRect.width / 2;
  const compassY = compassRect.top - areaRect.top + compassRect.height / 2;

  let totalFieldX = 0, totalFieldY = 0;

  const magnets = document.querySelectorAll('.magnet');
  magnets.forEach(m => {
    const mr = m.getBoundingClientRect();
    const isHorizontal = mr.width >= mr.height;
    const baseStrength = parseFloat(m.dataset.strength) || 1;

    if (isHorizontal) {
      [[4, mr.height/2], [mr.width-4, mr.height/2]].forEach(([dx, dy]) => {
        const px = mr.left - areaRect.left + dx;
        const py = mr.top - areaRect.top + dy;
        const polarity = m.classList.contains('north') ? 1 : -1;
        const dxC = compassX - px;
        const dyC = compassY - py;
        const dist = Math.sqrt(dxC*dxC + dyC*dyC);
        if (dist > 0.0001) {
          const f = (5000 * (baseStrength/2) * globalMagnetStrength) / (dist*dist);
          totalFieldX += polarity * f * dxC / dist;
          totalFieldY += polarity * f * dyC / dist;
        }
      });
    } else {
      [[mr.width/2,4], [mr.width/2,mr.height-4]].forEach(([dx,dy]) => {
        const px = mr.left - areaRect.left + dx;
        const py = mr.top - areaRect.top + dy;
        const polarity = m.classList.contains('north') ? 1 : -1;
        const dxC = compassX - px;
        const dyC = compassY - py;
        const dist = Math.sqrt(dxC*dxC + dyC*dyC);
        if (dist > 0.0001) {
          const f = (5000 * (baseStrength/2) * globalMagnetStrength) / (dist*dist);
          totalFieldX += polarity * f * dxC / dist;
          totalFieldY += polarity * f * dyC / dist;
        }
      });
    }
  });

  needle.style.transform = `rotate(${Math.atan2(totalFieldY, totalFieldX) * 180 / Math.PI}deg)`;
}

/* --------------------
   Drawing handlers (pointer events)
-------------------- */
function onSimulationClick(e) {
  if (isDraggingCompass || isDrawing) return;
  if (!isDrawingMode) {
    const rect = simulationArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.target === compass || e.target === needle || e.target.classList.contains('magnet')) return;
    const p = document.createElement('div');
    p.className = 'plot-point';
    p.style.left = x+'px';
    p.style.top = y+'px';
    simulationArea.appendChild(p);
    plotPoints.push({x,y,element:p});
  }
}

function onSimulationPointerDown(e) {
  if (!isDrawingMode) return;
  if (e.target === compass || e.target === needle || e.target.classList.contains('magnet')) return;
  const rect = simulationArea.getBoundingClientRect();
  isDrawing = true;
  currentPath = [{x: e.clientX - rect.left, y: e.clientY - rect.top}];
  simulationArea.setPointerCapture(e.pointerId);
}

function onSimulationPointerMove(e) {
  if (!isDrawing) return;
  const rect = simulationArea.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  currentPath.push({x,y});
  if (currentPath.length >= 2) {
    const prev = currentPath[currentPath.length-2];
    const curr = currentPath[currentPath.length-1];
    drawLineSegment(prev.x, prev.y, curr.x, curr.y);
  }
}

function onSimulationPointerUp(e) {
  if (isDrawing) {
    isDrawing = false;
    currentPath = [];
    simulationArea.releasePointerCapture(e.pointerId);
  }
}

/* --------------------
   Compass dragging
-------------------- */
function onCompassPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  isDraggingCompass = true;
  compass.style.cursor = 'grabbing';
  const rect = simulationArea.getBoundingClientRect();
  const compassRect = compass.getBoundingClientRect();
  const offsetX = e.clientX - compassRect.left;
  const offsetY = e.clientY - compassRect.top;

  function move(ev) {
    if (!isDraggingCompass) return;
    let x = ev.clientX - rect.left - offsetX;
    let y = ev.clientY - rect.top - offsetY;
    x = Math.max(0, Math.min(simulationArea.clientWidth - compass.offsetWidth, x));
    y = Math.max(0, Math.min(simulationArea.clientHeight - compass.offsetHeight, y));
    compass.style.left = x+'px';
    compass.style.top = y+'px';
    updateCompassNeedle();
  }

  function up() {
    isDraggingCompass = false;
    compass.style.cursor = 'grab';
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
  }

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
  compass.setPointerCapture?.(e.pointerId);
}

/* --------------------
   Drawing helpers
-------------------- */
function toggleDrawMode() {
  isDrawingMode = !isDrawingMode;
  const btn = document.getElementById('drawModeBtn');
  if (isDrawingMode) {
    simulationArea.classList.add('drawing-mode');
    if (btn) btn.classList.add('active');
  } else {
    simulationArea.classList.remove('drawing-mode');
    if (btn) btn.classList.remove('active');
    isDrawing = false;
    currentPath = [];
  }
}

function drawLineSegment(x1,y1,x2,y2) {
  const line = document.createElement('div');
  line.className = 'drawn-line';
  const dx = x2-x1, dy=y2-y1;
  line.style.left = x1+'px';
  line.style.top = y1+'px';
  line.style.width = Math.sqrt(dx*dx + dy*dy)+'px';
  line.style.height = '2px';
  line.style.transform = `rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
  line.style.transformOrigin = '0 50%';
  simulationArea.appendChild(line);
  fieldLines.push(line);
}

/* --------------------
   Clear
-------------------- */
function clearAll() {
  plotPoints.forEach(p => p.element.remove());
  plotPoints = [];
  fieldLines.forEach(l => l.remove());
  fieldLines = [];
  if (isDrawingMode) toggleDrawMode();
}

/* --------------------
   Launch
-------------------- */
document.addEventListener('DOMContentLoaded', init);
