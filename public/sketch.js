let currentTool = 'brush';
let currentColor = '#000000';
let brushSize = 10;
let backgroundColor = '#ffffff';
let isDrawing = false;
let lastX, lastY;
let startX, startY;
let canvasScale = 1.0;

let historyStack = [];
let currentHistoryIndex = -1;
let tempCanvas;

let layers = [];
let activeLayer = 0;
let history = [];     
let redoStack = [];


let gameActive = false;
let gamePromptText = '';
let gameOverlayAlpha = 0;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(1700, 800);
  canvas.parent('canvas-container');

  addNewLayer();
  saveState();
  setupEventListeners();
}

function draw() {
  background(backgroundColor);

  push();
  translate(width / 2, height / 2);
  scale(canvasScale);
  translate(-width / 2, -height / 2);

  for (let g of layers) image(g, 0, 0);
  if (isDrawing && (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
    drawPreview();
  }
  if (isDrawing && currentTool === 'spray') {
    drawSpray(layers[activeLayer]);
  }
  pop();

  
  if (gameActive && gamePromptText) {
    gameOverlayAlpha = min(gameOverlayAlpha + 10, 180);
    push();
    noStroke();
    fill(0, 0, 0, gameOverlayAlpha);
    rect(20, 20, 360, 90, 12);
    fill(255);
    textSize(22);
    textStyle(BOLD);
    text('Draw this:', 34, 52);
    textStyle(NORMAL);
    textSize(28);
    text(gamePromptText, 34, 88);
    pop();
  } else {
    gameOverlayAlpha = 0;
  }
}

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

  const bgColorPicker = document.getElementById('bgColorPicker');
  if (bgColorPicker) {
    bgColorPicker.addEventListener('input', (e) => {
      backgroundColor = e.target.value;
    });
  }

  document.getElementById('newLayerBtn').addEventListener('click', addNewLayer);
  document.getElementById('layerSelect').addEventListener('change', (e) => {
    activeLayer = +e.target.value;
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear the active layer?')) {
      saveState();
      layers[activeLayer].clear();
    }
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    saveCanvas('my-painting', 'png');
  });

  /* === Game buttons (NEW) === */
  const startBtn = document.getElementById('startGameBtn');
  const stopBtn  = document.getElementById('stopGameBtn');
  const promptEl = document.getElementById('gamePrompt');

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    promptEl.textContent = 'Getting a prompt…';
    try {
      // Uses your server endpoint which calls OpenAI and returns { prompt }.
      const res = await fetch('/api/get-prompt', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.prompt) {
        throw new Error(data?.error || 'Failed to get prompt');
      }
      gamePromptText = (data.prompt || '').trim();
      promptEl.textContent = `Prompt: ${gamePromptText}`;
      gameActive = true;
      gameOverlayAlpha = 0;
      stopBtn.disabled = false;
    } catch (err) {
      console.error(err);
      promptEl.textContent = 'Could not get a prompt. Try again.';
      gameActive = false;
    } finally {
      // Re-enable Start to let them fetch a new prompt anytime
      startBtn.disabled = false;
    }
  });

  stopBtn.addEventListener('click', () => {
    gameActive = false;
    gamePromptText = '';
    document.getElementById('gamePrompt').textContent = '';
    stopBtn.disabled = true;
  });

  // Initialize stop disabled
  stopBtn.disabled = true;
}

function mousePressed() {
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  
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
      g.text(textValue, adjustedMouseX, adjustedMouseY);
    }
    isDrawing = false;
    return;
  }

  isDrawing = true;
  startX = adjustedMouseX; startY = adjustedMouseY;
  lastX  = adjustedMouseX; lastY  = adjustedMouseY;

  if (
    currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'spray' ||
    currentTool === 'line'  || currentTool === 'rectangle' || currentTool === 'circle'
  ) {
    saveState();
  }

  if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
    tempCanvas = null;
  }

  if (currentTool === 'brush' || currentTool === 'eraser') {
    drawPoint(adjustedMouseX, adjustedMouseY);
  }
}

function mouseDragged() {
  if (!isDrawing) return;

  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();

  if (currentTool === 'brush') {
    drawLine(lastX, lastY, adjustedMouseX, adjustedMouseY);
  } else if (currentTool === 'eraser') {
    eraseLine(lastX, lastY, adjustedMouseX, adjustedMouseY);
  }

  lastX = adjustedMouseX;
  lastY = adjustedMouseY;
}

function mouseReleased() {
  if (!isDrawing) return;

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

function getAdjustedMouseX() {
  return (mouseX - width / 2) / canvasScale + width / 2;
}

function getAdjustedMouseY() {
  return (mouseY - height / 2) / canvasScale + height / 2;
}

function drawPoint(x, y) {
  let g = layers[activeLayer];
  if (currentTool === 'brush') {
    g.stroke(currentColor);
    g.strokeWeight(brushSize);
    g.point(x, y);
  } else if (currentTool === 'eraser') {
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
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.line(startX, startY, adjustedMouseX, adjustedMouseY);
}

function drawFinalRectangle() {
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.noFill();
  g.rect(startX, startY, adjustedMouseX - startX, adjustedMouseY - startY);
}

function drawFinalCircle() {
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  let g = layers[activeLayer];
  g.stroke(currentColor);
  g.strokeWeight(brushSize);
  g.noFill();
  const diameter = dist(startX, startY, adjustedMouseX, adjustedMouseY) * 2;
  g.ellipse(startX, startY, diameter, diameter);
}

function drawSpray(g) {
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  g.fill(currentColor);
  g.noStroke();
  for (let i = 0; i < 3; i++) {
    const a = random(TWO_PI);
    const r = random(brushSize * 2);
    const x = adjustedMouseX + cos(a) * r;
    const y = adjustedMouseY + sin(a) * r;
    const size = random(1, brushSize / 3);
    g.ellipse(x, y, size, size);
  }
}

function drawPreview() {
  let adjustedMouseX = getAdjustedMouseX();
  let adjustedMouseY = getAdjustedMouseY();
  stroke(currentColor);
  strokeWeight(2);
  noFill();
  if (currentTool === 'line') {
    line(startX, startY, adjustedMouseX, adjustedMouseY);
  } else if (currentTool === 'rectangle') {
    rect(startX, startY, adjustedMouseX - startX, adjustedMouseY - startY);
  } else if (currentTool === 'circle') {
    const diameter = dist(startX, startY, adjustedMouseX, adjustedMouseY) * 2;
    ellipse(startX, startY, diameter, diameter);
  }
}

function addNewLayer() {
  let g = createGraphics(width, height);
  g.clear();
  layers.push(g);
  history.push([]);
  redoStack.push([]);

  const sel = document.getElementById('layerSelect');
  const index = layers.length - 1;
  const opt = document.createElement('option');
  opt.value = index;
  opt.text  = `Layer ${index + 1}`;
  sel.appendChild(opt);

  sel.value = index;
  activeLayer = index;
}

function saveState() {
  history[activeLayer].push(layers[activeLayer].get());
  redoStack[activeLayer] = [];
}

function undo() {
  if (history[activeLayer].length > 0) {
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

function keyPressed() {
  const textInput = document.getElementById('textInput');
  if (textInput && document.activeElement === textInput) {
    return true;
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

  if (keyCode === DELETE || keyCode === 8) {
    saveState();
    layers[activeLayer].clear();
  }

  if (keyCode === 83 && (keyIsDown(CONTROL) || keyIsDown(91))) {
    saveCanvas('my-painting', 'png');
    return false;x
  }

  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === 'z' || key === 'Z')) {
    undo();
    return false;
  }
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === 'y' || key === 'Y')) {
    redo();
    return false;
  }
  
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === '=' || key === '+')) {
    canvasScale = constrain(canvasScale + 0.1, 0.3, 3.0);
    return false;
  }
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && (key === '-' || key === '_')) {
    canvasScale = constrain(canvasScale - 0.1, 0.3, 3.0);
    return false;
  }
  if ((keyIsDown(CONTROL) || keyIsDown(91)) && key === '0') {
    canvasScale = 1.0;
    return false;
  }
}