// === Original state (kept) ===
let currentTool = 'brush';
let currentColor = '#000000';
let brushSize = 10;
let backgroundColor = '#ffffff';
let isDrawing = false;
let lastX, lastY;
let startX, startY;

// (Original history variables kept for compatibility, but we’ll manage history per-layer)
let historyStack = [];
let currentHistoryIndex = -1;
let tempCanvas;

// === Layers + per-layer history ===
let layers = [];
let activeLayer = 0;
let history = [];     // array of stacks (per-layer)
let redoStack = [];   // array of stacks (per-layer)

// === Setup ===
function setup() {
  pixelDensity(1);
  const canvas = createCanvas(800, 500);
  canvas.parent('canvas-container');

  // Start with one transparent layer
  addNewLayer();

  // Seed initial state for that layer
  saveState();

  setupEventListeners();
}

// === Compose & live previews ===
function draw() {
  // Draw background then compose all layers
  background(backgroundColor);
  for (let g of layers) image(g, 0, 0);

  // Live tools
  if (isDrawing && (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
    drawPreview(); // preview overlays the composed scene
  }
  if (isDrawing && currentTool === 'spray') {
    drawSpray(layers[activeLayer]); // spray writes directly to active layer while dragging
  }
}

// === Controls / UI ===
function setupEventListeners() {
  document.getElementById('colorPicker').addEventListener('input', (e) => {
    currentColor = e.target.value;
  });

  const brushSizeSlider = document.getElementById('brushSize');
  const brushSizeValue  = document.getElementById('brushSizeValue');
  brushSizeSlider.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    brushSizeValue.textContent = brushSize;
  });

  document.getElementById('toolSelect').addEventListener('change', (e) => {
    currentTool = e.target.value;
  });

  const textSizeSlider = document.getElementById('textSize');
  const textSizeValue  = document.getElementById('textSizeValue');
  if (textSizeSlider && textSizeValue) {
    textSizeSlider.addEventListener('input', (e) => {
      textSizeValue.textContent = parseInt(e.target.value);
    });
  }

  // Background color picker (undoable as its own layer op? We keep it global like before)
  const bgColorPicker = document.getElementById('bgColorPicker');
  if (bgColorPicker) {
    bgColorPicker.addEventListener('input', (e) => {
      backgroundColor = e.target.value;
      // No per-layer save here; background is global
    });
  }

  // Layers UI
  document.getElementById('newLayerBtn').addEventListener('click', addNewLayer);
  document.getElementById('layerSelect').addEventListener('change', (e) => {
    activeLayer = +e.target.value;
  });

  // Undo/Redo (per active layer)

  // Clear active layer (undoable)
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear the active layer?')) {
      saveState();
      layers[activeLayer].clear();
    }
  });

  // Save whole composition to disk (same as before)
  document.getElementById('saveBtn').addEventListener('click', () => {
    // Temporarily render composition to screen (already done in draw), so just save canvas
    saveCanvas('my-painting', 'png');
  });
}

// === Mouse handlers (kept behavior; routed into active layer) ===
function mousePressed() {
  // Text tool places on click to active layer
  if (currentTool === 'text') {
    const inputEl = document.getElementById('textInput');
    const sizeEl  = document.getElementById('textSize');
    const textValue = (inputEl && inputEl.value || '').trim();
    const size = parseInt((sizeEl && sizeEl.value) || '24', 10);
    if (textValue.length > 0) {
      saveState();
      let g = layers[activeLayer];
      g.noStroke();
      g.fill(currentColor);
      g.textSize(size);
      // Use default p5 font unless you set one elsewhere
      g.text(textValue, mouseX, mouseY);
    }
    isDrawing = false;
    return;
  }

  isDrawing = true;
  startX = mouseX; startY = mouseY;
  lastX  = mouseX; lastY  = mouseY;

  // Snapshot BEFORE drawing so undo removes the whole action on this layer
  if (
    currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'spray' ||
    currentTool === 'line'  || currentTool === 'rectangle' || currentTool === 'circle'
  ) {
    saveState();
  }

  // For live shape preview, cache the current composed scene if needed
  if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
    // tempCanvas not required for compositing since preview draws on main canvas;
    // leaving as reference to original structure
    tempCanvas = null;
  }

  // Initial dot for brush/eraser
  if (currentTool === 'brush' || currentTool === 'eraser') {
    drawPoint(mouseX, mouseY);
  }
}

function mouseDragged() {
  if (!isDrawing) return;

  if (currentTool === 'brush') {
    drawLine(lastX, lastY, mouseX, mouseY);
  } else if (currentTool === 'eraser') {
    eraseLine(lastX, lastY, mouseX, mouseY);
  }

  lastX = mouseX;
  lastY = mouseY;
}

function mouseReleased() {
  if (!isDrawing) return;

  // Finalize shapes onto the active layer
  if (currentTool === 'line') {
    drawFinalLine();
  } else if (currentTool === 'rectangle') {
    drawFinalRectangle();
  } else if (currentTool === 'circle') {
    drawFinalCircle();
  }

  isDrawing = false;
  tempCanvas = null;
}

// === Drawing primitives (same API; target the active layer) ===
function drawPoint(x, y) {
  let g = layers[activeLayer];
  if (currentTool === 'brush') {
    g.stroke(currentColor);
    g.strokeWeight(brushSize);
    g.point(x, y);
  } else if (currentTool === 'eraser') {
    // true erase (transparent) on this layer
    g.erase();
    g.strokeWeight(brushSize);
    g.point(x, y);
    g.noErase();
  }
}

function drawLine(x1, y1, x2, y2) {
  let g = layers[activeLayer];
  g.strokeWeight(brushSize);
  g.strokeCap(ROUND);
  if (currentTool === 'brush') {
    g.stroke(currentColor);
    g.line(x1, y1, x2, y2);
  }
}

function eraseLine(x1, y1, x2, y2) {
  let g = layers[activeLayer];
  g.strokeWeight(brushSize);
  g.strokeCap(ROUND);
  g.erase();
  g.line(x1, y1, x2, y2);
  g.noErase();
}

function drawFinalLine() {
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.line(startX, startY, mouseX, mouseY);
}

function drawFinalRectangle() {
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.noFill();
  g.rect(startX, startY, mouseX - startX, mouseY - startY);
}

function drawFinalCircle() {
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.noFill();
  const diameter = dist(startX, startY, mouseX, mouseY) * 2;
  g.ellipse(startX, startY, diameter, diameter);
}

// === Spray (writes to active layer during drag) ===
function drawSpray(g) {
  g.fill(currentColor);
  g.noStroke();
  for (let i = 0; i < 3; i++) {
    const a = random(TWO_PI);
    const r = random(brushSize * 2);
    const x = mouseX + cos(a) * r;
    const y = mouseY + sin(a) * r;
    const size = random(1, brushSize / 3);
    g.ellipse(x, y, size, size);
  }
}

// === Live shape preview (drawn on composed view only) ===
function drawPreview() {
  push();
  stroke(currentColor);
  strokeWeight(2);
  noFill();
  if (currentTool === 'line') {
    line(startX, startY, mouseX, mouseY);
  } else if (currentTool === 'rectangle') {
    rect(startX, startY, mouseX - startX, mouseY - startY);
  } else if (currentTool === 'circle') {
    const diameter = dist(startX, startY, mouseX, mouseY) * 2;
    ellipse(startX, startY, diameter, diameter);
  }
  pop();
}

// === Layers management ===
function addNewLayer() {
  let g = createGraphics(width, height);
  g.clear(); // transparent layer
  layers.push(g);
  history.push([]);      // stack for this layer
  redoStack.push([]);    // stack for this layer

  const sel = document.getElementById('layerSelect');
  const index = layers.length - 1;
  const opt = document.createElement('option');
  opt.value = index;
  opt.text  = `Layer ${index + 1}`;
  sel.appendChild(opt);

  sel.value = index;
  activeLayer = index;
}

// === Per-layer Undo/Redo ===
function saveState() {
  // snapshot current active layer pixels into its history
  history[activeLayer].push(layers[activeLayer].get());
  redoStack[activeLayer] = [];
}

function undo() {
  if (history[activeLayer].length > 0) {
    // push current image to redo, restore last history image
    redoStack[activeLayer].push(layers[activeLayer].get());
    const prevImg = history[activeLayer].pop();
    layers[activeLayer].clear();
    layers[activeLayer].image(prevImg, 0, 0);
  }
}

function redo() {
  if (redoStack[activeLayer].length > 0) {
    history[activeLayer].push(layers[activeLayer].get());
    const nextImg = redoStack[activeLayer].pop();
    layers[activeLayer].clear();
    layers[activeLayer].image(nextImg, 0, 0);
  }
}

// === Keyboard shortcuts (kept) ===
function keyPressed() {
  const textInput = document.getElementById('textInput');
  if (textInput && document.activeElement === textInput) {
    return true; // allow normal typing
  }

  if (key >= '1' && key <= '5') {
    const sizes = [5, 10, 15, 20, 30];
    brushSize = sizes[key - 1];
    document.getElementById('brushSize').value = brushSize;
    document.getElementById('brushSizeValue').textContent = brushSize;
  }

  if (key === 'b') currentTool = 'brush';
  if (key === 'e') currentTool = 'eraser';
  if (key === 's') currentTool = 'spray';
  if (key === 'l') currentTool = 'line';
  if (key === 'r') currentTool = 'rectangle';
  if (key === 'c') currentTool = 'circle';
  if (key === 't') currentTool = 'text';
  document.getElementById('toolSelect').value = currentTool;

  // Clear active layer with Delete/Backspace (undoable)
  if (keyCode === DELETE || keyCode === 8) {
    saveState();
    layers[activeLayer].clear();
  }

  // Save composition with Ctrl/Cmd+S
  if (keyCode === 83 && (keyIsDown(CONTROL) || keyIsDown(91))) {
    saveCanvas('my-painting', 'png');
    return false;
  }

  // Undo/Redo shortcuts (per layer)
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === 'z' || key === 'Z')) {
    undo();
    return false;
  }
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === 'y' || key === 'Y')) {
    redo();
    return false;
  }
}
