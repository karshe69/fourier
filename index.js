const toggleButton = document.getElementById('toggleButton');
const sidebar = document.getElementById('sidebar');
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const clearButton = document.getElementById('clearButton');
const pointsCount = document.getElementById('pointsCount');
const imageInput = document.getElementById('imageInput');
const edgeButton = document.getElementById('edgeButton');
const contourButton = document.getElementById('contourButton');
const fourierButton = document.getElementById('fourierBtn');
const testButton = document.getElementById('testButton');


let DrawInterval
let freq = 0
let delta = 0

let uploadedImage = null;

let drawing = false;
let points = [];
let path = []

function applySobel(imageData) {
  const { width, height, data } = imageData;
  const gray = new Uint8ClampedArray(width * height);

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const gradient = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  // Step 1: Compute gradient magnitude and direction
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * width + (x + kx)];
          const idx = (ky + 1) * 3 + (kx + 1);
          gx += Gx[idx] * val;
          gy += Gy[idx] * val;
        }
      }

      const idx = y * width + x;
      gradient[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  // Step 2: Non-maximum suppression
  const suppressed = new Uint8ClampedArray(width * height);
  const threshold = 100; // Lowered to preserve fine details

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx] * (180 / Math.PI);
      const mag = gradient[idx];

      let q = 0, r = 0;

      // Angle quantization
      if ((angle >= -22.5 && angle < 22.5) || angle >= 157.5 || angle < -157.5) {
        q = gradient[idx + 1];
        r = gradient[idx - 1];
      } else if ((angle >= 22.5 && angle < 67.5) || (angle < -112.5 && angle >= -157.5)) {
        q = gradient[idx + width + 1];
        r = gradient[idx - width - 1];
      } else if ((angle >= 67.5 && angle < 112.5) || (angle < -67.5 && angle >= -112.5)) {
        q = gradient[idx + width];
        r = gradient[idx - width];
      } else if ((angle >= 112.5 && angle < 157.5) || (angle < -22.5 && angle >= -67.5)) {
        q = gradient[idx + width - 1];
        r = gradient[idx - width + 1];
      }

      if (mag >= q && mag >= r && mag > threshold) {
        suppressed[idx] = 255;
      } else {
        suppressed[idx] = 0;
      }
    }
  }

  // Step 3: Build final output image data (1-pixel-thin edges)
  const output = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const val = suppressed[i];
    output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = val;
    output[i * 4 + 3] = 255;
  }

  return new ImageData(output, width, height);
}

function trimToRadix2() {
  if (points.length < 2) return;

  // 1. Calculate the total length of the path (perimeter)
  let totalLength = 0;
  let distances = [0];
  for (let i = 0; i < points.length - 1; i++) {
    let dx = points[i + 1].x - points[i].x;
    let dy = points[i + 1].y - points[i].y;
    let d = Math.sqrt(dx * dx + dy * dy);
    totalLength += d;
    distances.push(totalLength);
  }

  // 2. Determine Radix-2 target
  let power = Math.floor(Math.log2(points.length));
  let target = Math.pow(2, power);

  // 3. Interpolate points at equal distance intervals
  let newPoints = [];
  let interval = totalLength / (target - 1);

  for (let i = 0; i < target; i++) {
    let targetDist = i * interval;

    // Find the segment where this distance falls
    let j = 0;
    while (j < distances.length - 2 && distances[j + 1] < targetDist) {
      j++;
    }

    // Interpolate between points[j] and points[j+1]
    let segStartDist = distances[j];
    let segEndDist = distances[j + 1];
    let t = (segEndDist === segStartDist) ? 0 : (targetDist - segStartDist) / (segEndDist - segStartDist);

    let p1 = points[j];
    let p2 = points[j + 1];

    newPoints.push({
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    });
  }

  points = newPoints;
  updatePointsCount()
}


function FFT() {

  trimToRadix2()

  let DFT = ditFFT2(points, points.length)

  let circles = DFTtoCircle(DFT)

  freq = 2 * Math.PI / points.length * Math.ceil(points.length / 500)

  DrawInterval = setInterval(drawCircle, 10, circles)
  console.log(circles[circles.length - 1].amp);
  console.log(circles[circles.length / 2].amp);
}


function DFTtoCircle(DFT) {
  let circles = []
  for (let i = 0; i < DFT.length; i++) {
    circles.push({
      freq: i,
      amp: math.abs(DFT[i]),
      phase: math.atan2(DFT[i].im, DFT[i].re)
    })
  }
  circles.sort((a, b) => b.amp - a.amp)
  return circles
}

function ditFFT2(x, N, s = 1) {
  const X = new Array(N)
  if (N === 1) {
    X[0] = math.complex(x[0].x, x[0].y)
    return X
  }
  const even = ditFFT2(x, N / 2, 2 * s)
  const odd = ditFFT2(x.slice(s), N / 2, 2 * s)
  for (let k = 0; k < N / 2; k++) {
    const t = math.multiply(
      math.exp(math.multiply(math.i, 2 * Math.PI * k / N)),
      odd[k]
    )
    X[k] = math.add(even[k], t)
    X[k + N / 2] = math.subtract(even[k], t)
  }

  if (s === 1) {
    for (let i = 0; i < N; i++) {
      X[i] = math.divide(X[i], N)
    }
  }
  return X
}

// Persistent off-screen buffer variables
let trailCanvas = null;
let trailCtx = null;
let lastX = null;
let lastY = null;

function drawCircle(circles) {
  if (!circles || !ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Initialize or Resize Buffer
  if (!trailCanvas || trailCanvas.width !== w || trailCanvas.height !== h) {
    trailCanvas = document.createElement('canvas');
    trailCanvas.width = w;
    trailCanvas.height = h;
    trailCtx = trailCanvas.getContext('2d');
  }

  // Clear main canvas
  ctx.clearRect(0, 0, w, h);

  let x = 0;
  let y = 0;

  const circlePath = new Path2D();
  const connectorPath = new Path2D();
  connectorPath.moveTo(x, y);

  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    // if (i >= circles.length / 2 && c.amp <= 0.005) break;

    const angle = c.phase + delta * c.freq;
    const nextX = x + c.amp * Math.cos(angle);
    const nextY = y + c.amp * Math.sin(angle);

    if (c.amp > 0.5) {
      circlePath.moveTo(x + c.amp, y);
      circlePath.arc(x, y, c.amp, 0, 2 * Math.PI);
    }

    connectorPath.lineTo(nextX, nextY);
    x = nextX;
    y = nextY;
  }

  // Update original path array
  path.push({ x, y });

  // Call the original fadeOut function structure
  fadeOut();

  // Draw the buffer to the main screen
  ctx.drawImage(trailCanvas, 0, 0);

  // Draw structure
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.stroke(circlePath);
  ctx.strokeStyle = "cyan";
  ctx.stroke(connectorPath);

  delta += freq;
}

function fadeOut() {
  if (!trailCtx) return;

  // Clear the buffer each frame so we can redraw the path with original logic
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

  let alpha = 1;
  // Calculate dt based on a full rotation as requested
  // dt ^ (2*PI / freq) = 0.001 (threshold for complete fade)
  dt = math.pow(0.2, freq / (2 * math.pi))

  // Original loop structure
  for (let i = path.length - 1; i >= 1; i--) {
    // If alpha is effectively 0, stop drawing and trim path to save memory
    if (alpha < 0.005) {
      path.splice(0, i); // Memory management: remove old points that are invisible
      break;
    }

    trailCtx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
    trailCtx.lineWidth = 2;
    trailCtx.beginPath();
    trailCtx.moveTo(path[i].x, path[i].y);
    trailCtx.lineTo(path[i - 1].x, path[i - 1].y);
    trailCtx.stroke();

    alpha *= dt;
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // compute total path length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    let dx = points[i].x - points[i - 1].x
    let dy = points[i].y - points[i - 1].y
    totalLength += Math.hypot(dx, dy)
  }

  let distance = 0

  for (let i = 1; i < points.length; i++) {
    let dx = points[i].x - points[i - 1].x
    let dy = points[i].y - points[i - 1].y
    let segLength = Math.hypot(dx, dy)

    distance += segLength
    let hue = (distance / totalLength) * 360

    ctx.strokeStyle = `hsl(${hue},100%,50%)`

    ctx.beginPath()
    ctx.moveTo(points[i - 1].x, points[i - 1].y)
    ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }
}

function extractContours() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;
  let visited = new Uint8Array(width * height);

  function isWhite(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    let i = (y * width + x) * 4;
    return data[i] > 200;
  }

  function markPixel(x, y, r, g, b) {
    let i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }

  const neighbors = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  // --- CONFIG ---
  const minKeepSize = 15;
  const skipDist = 3;

  function traceAdaptive(startX, startY) {
    let contour = [];
    let history = [];
    let current = { x: startX, y: startY };
    let lastSaved = { x: startX, y: startY };
    let totalPixels = 0;

    visited[startY * width + startX] = 1;
    contour.push({ x: startX, y: startY });
    history.push(current);

    while (history.length > 0) {
      let next = null;
      for (let [dx, dy] of neighbors) {
        let nx = current.x + dx, ny = current.y + dy;
        if (isWhite(nx, ny) && !visited[ny * width + nx]) {
          next = { x: nx, y: ny };
          break;
        }
      }

      if (next) {
        visited[next.y * width + next.x] = 1;
        history.push(next);
        totalPixels++;
        let distSq = Math.pow(next.x - lastSaved.x, 2) + Math.pow(next.y - lastSaved.y, 2);
        if (totalPixels < 15 || distSq >= skipDist * skipDist) {
          contour.push(next);
          lastSaved = next;
        }
        current = next;
      } else {
        if (current.x !== lastSaved.x || current.y !== lastSaved.y) {
          contour.push({ x: current.x, y: current.y });
          lastSaved = current;
        }
        history.pop();
        if (history.length > 0) current = history[history.length - 1];
      }
    }
    return { path: contour, size: totalPixels };
  }

  let finalContours = [];
  let tinySegments = [];

  // Phase 1: Initial Tracing
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWhite(x, y) && !visited[y * width + x]) {
        let result = traceAdaptive(x, y);
        if (result.size >= minKeepSize) {
          finalContours.push(result.path);
        } else {
          tinySegments.push(result);
        }
      }
    }
  }

  // Phase 2: Recursive / Team-Up Bridging
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = tinySegments.length - 1; i >= 0; i--) {
      let small = tinySegments[i];
      let shouldKeep = false;

      // Calculate radius based on its own size
      let dynamicRadius = 2.0 + (small.size * 0.8); // Slightly boosted reach
      let dynamicRadiusSq = dynamicRadius * dynamicRadius;

      // Check against established finalContours
      for (let large of finalContours) {
        // Check BOTH start and end of the small segment for better connectivity
        let pointsToCheck = [small.path[0], small.path[small.path.length - 1]];

        for (let sP of pointsToCheck) {
          for (let j = 0; j < large.length; j += 2) {
            let dx = sP.x - large[j].x;
            let dy = sP.y - large[j].y;
            if (dx * dx + dy * dy <= dynamicRadiusSq) {
              shouldKeep = true;
              break;
            }
          }
          if (shouldKeep) break;
        }
        if (shouldKeep) break;
      }

      if (shouldKeep) {
        finalContours.push(small.path);
        tinySegments.splice(i, 1);
        changed = true; // A new island was added, so other tiny ones might now connect to IT
      }
    }
  }

  // --- THE FIX: COLOR ALL FINAL CONTOURS GREEN ---
  for (let contour of finalContours) {
    for (let p of contour) {
      markPixel(p.x, p.y, 0, 255, 0);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Connection logic
  if (typeof connectContours === "function") {
    finalContours = connectContours(finalContours);
  }

  // Draw Connections (Blue)
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 1;
  for (let i = 1; i < finalContours.length; i++) {
    let a = finalContours[i - 1][finalContours[i - 1].length - 1];
    let b = finalContours[i][0];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  return finalContours;
}

function connectContours(contours) {
  if (contours.length <= 1) return contours;

  let remaining = [...contours];
  // Start with the contour that has the leftmost point (usually a safe bet)
  let bestStartIdx = 0;
  let minX = Infinity;
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i][0].x < minX) { minX = remaining[i][0].x; bestStartIdx = i; }
  }

  let currentContour = remaining.splice(bestStartIdx, 1)[0];
  let fullPath = [...currentContour];

  while (remaining.length > 0) {
    let lastPoint = fullPath[fullPath.length - 1];
    let bestDist = Infinity;
    let bestIdx = -1;
    let reverseCandidate = false;

    // Find the closest point in the remaining islands
    for (let i = 0; i < remaining.length; i++) {
      let dStart = Math.hypot(lastPoint.x - remaining[i][0].x, lastPoint.y - remaining[i][0].y);
      let dEnd = Math.hypot(lastPoint.x - remaining[i][remaining[i].length - 1].x, lastPoint.y - remaining[i][remaining[i].length - 1].y);

      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; reverseCandidate = false; }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; reverseCandidate = true; }
    }

    let next = remaining.splice(bestIdx, 1)[0];
    if (reverseCandidate) next.reverse();

    // --- THE RETRACING LOGIC ---
    // If the gap to the next segment is large (e.g., > 10px), 
    // we "retrace" our path backwards until we find a point that is closer 
    // to the next segment's start.
    if (bestDist > 10) {
      let bestRetraceIdx = fullPath.length - 1;
      let minRetraceDist = bestDist;
      let targetPoint = next[0];

      // Look back through the last 500 points we've drawn
      let lookbackLimit = Math.max(0, fullPath.length - 500);
      for (let j = fullPath.length - 1; j > lookbackLimit; j--) {
        let d = Math.hypot(fullPath[j].x - targetPoint.x, fullPath[j].y - targetPoint.y);
        if (d < minRetraceDist) {
          minRetraceDist = d;
          bestRetraceIdx = j;
        }
      }

      // If we found a significantly better jump-off point, retrace to it
      if (bestRetraceIdx < fullPath.length - 1) {
        for (let r = fullPath.length - 2; r >= bestRetraceIdx; r--) {
          fullPath.push(fullPath[r]); // Add the "walk back" points
        }
      }
    }

    // Finally, add the new segment
    fullPath = fullPath.concat(next);
  }

  // We return a single array wrapped in an array to keep your code compatible
  return [fullPath];
}

function contoursToPoints(contours) {
  points = []
  for (let c of contours) {
    for (let p of c) {
      points.push(p)
    }
  }
  updatePointsCount()
}

function drawLine(p1, p2, color = 'white') {
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
}

function addPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  points.push({ x, y })
  updatePointsCount()
}

function updatePointsCount() {
  pointsCount.textContent = points.length
}

toggleButton.addEventListener('click', () => {
  sidebar.classList.toggle('-translate-x-full')
})

window.addEventListener('resize', resizeCanvas)

resizeCanvas()

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  redraw()
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true
  if (fourierButton.disabled) {
    fourierBtn.removeAttribute("disabled")
  }
  addPoint(e)
  redraw()
})

canvas.addEventListener('mouseup', () => {
  drawing = false
  drawLine(points[points.length - 1], points[0], "lime")
})

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  addPoint(e);
  if (points.length < 2) return;
  drawLine(points[points.length - 2], points[points.length - 1]);
});

fourierButton.addEventListener('click', () => {
  fourierBtn.setAttribute("disabled", true)
  FFT()
})

clearButton.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  points = []
  path = []
  updatePointsCount()

  // Clear uploaded image and file input
  imageInput.value = ''
  uploadedImage = null
  edgeButton.classList.add('hidden') // Optionally hide the button again
  contourButton.classList.add('hidden')
  clearInterval(DrawInterval)
})

imageInput.addEventListener('change', event => {
  const file = event.target.files[0]
  if (!file) return

  const img = new Image()
  const reader = new FileReader()

  reader.onload = e => {
    img.onload = () => {
      console.log('Image loaded successfully') // ADD THIS LINE
      uploadedImage = img
      edgeButton.classList.remove('hidden')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Optional: show the original image scaled to fit canvas
      const aspectRatio = img.width / img.height
      let drawWidth = canvas.width
      let drawHeight = canvas.height

      if (canvas.width / canvas.height > aspectRatio) {
        drawWidth = canvas.height * aspectRatio
      } else {
        drawHeight = canvas.width / aspectRatio
      }

      ctx.drawImage(img, 0, 0, drawWidth, drawHeight)
    }
    img.src = e.target.result;
  }

  reader.readAsDataURL(file)
})

edgeButton.addEventListener('click', () => {
  if (!uploadedImage) return

  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCanvas.width = uploadedImage.width
  tempCanvas.height = uploadedImage.height
  tempCtx.drawImage(uploadedImage, 0, 0)

  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const edgeData = applySobel(imageData)

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const scaleCanvas = document.createElement('canvas')
  scaleCanvas.width = edgeData.width
  scaleCanvas.height = edgeData.height
  const scaleCtx = scaleCanvas.getContext('2d')
  scaleCtx.putImageData(edgeData, 0, 0)

  // Scale edge image to fit canvas
  const aspectRatio = scaleCanvas.width / scaleCanvas.height;
  let drawWidth = canvas.width;
  let drawHeight = canvas.height;

  if (canvas.width / canvas.height > aspectRatio) {
    drawWidth = canvas.height * aspectRatio;
  } else {
    drawHeight = canvas.width / aspectRatio;
  }

  ctx.drawImage(scaleCanvas, 0, 0, drawWidth, drawHeight);
  contourButton.classList.remove('hidden')
});

contourButton.addEventListener('click', () => {
  const contours = extractContours()
  contoursToPoints(contours)
  fourierButton.removeAttribute("disabled")
  testButton.classList.remove('hidden')
})

testButton.addEventListener('click', () => {
  redraw()
})