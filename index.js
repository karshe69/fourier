const toggleButton = document.getElementById('toggleButton');
const sidebar = document.getElementById('sidebar');
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const clearButton = document.getElementById('clearButton');
const pointsCount = document.getElementById('pointsCount');

let drawing = false;
let points = [];

// Handle sidebar toggle
toggleButton.addEventListener('click', () => {
  sidebar.classList.toggle('-translate-x-full');
});

// Handle canvas resizing
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial sizing

// Start drawing when mouse is down
canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  addPoint(e);
});

// Stop drawing when mouse is up
canvas.addEventListener('mouseup', () => {
  drawing = false;
});

// Capture drawing while moving mouse
canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  addPoint(e);
  drawLine();
});

// Add current mouse position to points array
function addPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  points.push({ x, y });
  updatePointsCount();
}

// Draw the lines based on points array
function drawLine() {
  if (points.length < 2) return; // Need at least 2 points to draw a line

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

// Clear canvas and reset points
clearButton.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  points = [];
  updatePointsCount();
});

// Update points count display
function updatePointsCount() {
  pointsCount.textContent = points.length;
}
