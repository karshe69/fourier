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

  let power = Math.floor(Math.log2(points.length))
  let target = 2 ** power

  let step = points.length / target
  let newPoints = []

  for (let i = 0; i < target; i++) {
    newPoints.push(points[Math.floor(i * step)])
  }

  points = newPoints
}


function FFT() {

  trimToRadix2()

  let DFT = ditFFT2(points, points.length)

  let circles = DFTtoCircle(DFT)

  freq = 2 * Math.PI / points.length * Math.ceil(points.length / 500)

  DrawInterval = setInterval(drawCircle, 10, circles)

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

function drawCircle(circles) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  let x = 0
  let y = 0
  let way = []
  for (let i = 0; i < circles.length; i++) {
    way.push({ x, y })
    x += circles[i].amp * Math.cos(circles[i].phase + delta * circles[i].freq)
    y += circles[i].amp * Math.sin(circles[i].phase + delta * circles[i].freq)
  }
  ctx.strokeStyle = "white"
  for (let i = 1; i < way.length; i++) {
    ctx.beginPath()
    ctx.arc(way[i].x, way[i].y, circles[i].amp, 0, 2 * Math.PI)
    ctx.stroke()
  }

  ctx.strokeStyle = "cyan"
  ctx.beginPath()
  ctx.moveTo(way[0].x, way[0].y)
  for (let i = 1; i < way.length; i++) {
    ctx.lineTo(way[i].x, way[i].y)
  }
  ctx.lineTo(x, y)
  ctx.stroke()

  path.push({ x, y })
  delta += freq
  fadeOut()
}

function fadeOut() {
  let alpha = 1
  dt = math.pow(0.2, freq / (2 * math.pi))
  for (let i = path.length - 1; i >= 1; i--) {
    ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(path[i].x, path[i].y)
    ctx.lineTo(path[i - 1].x, path[i - 1].y)
    ctx.stroke();
    alpha *= dt
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = "white"
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
}

function extractContours() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;
  let visited = new Uint8Array(width * height);

  function isWhite(x, y) {
    let i = (y * width + x) * 4;
    return data[i] > 200; // Checking the thinned Sobel output
  }

  function markPixel(x, y, r, g, b) {
    let i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }

  // UPDATED: Line-following tracer for 1-pixel thin edges
  function traceLine(startX, startY) {
    let contour = [];
    let stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      let { x, y } = stack.pop();
      let idx = y * width + x;

      if (visited[idx] || !isWhite(x, y)) continue;
      visited[idx] = 1;

      contour.push({ x, y });
      markPixel(x, y, 0, 255, 0); // Green for the line

      // 8-neighbor check to follow the path
      const neighbors = [
        [1, 0], [1, 1], [0, 1], [-1, 1],
        [-1, 0], [-1, -1], [0, -1], [1, -1]
      ];

      for (let [dx, dy] of neighbors) {
        let nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          let nIdx = ny * width + nx;
          if (isWhite(nx, ny) && !visited[nIdx]) {
            stack.push({ x: nx, y: ny });
            // CRITICAL: Stop looking for other neighbors once we find the next step
            // This prevents the "clumping" and forces a single line path
            break;
          }
        }
      }
    }
    return contour;
  }

  let contours = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = y * width + x;
      if (isWhite(x, y) && !visited[idx]) {
        let contour = traceLine(x, y);

        // Filter out tiny noise, but keep shorter lines than before
        if (contour.length > 15) {
          contours.push(contour);
        } else {
          for (let p of contour) markPixel(p.x, p.y, 255, 0, 0); // Red for noise
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply your connection logic
  if (typeof connectContours === "function") {
    contours = connectContours(contours);
  }

  // Draw connections (Blue)
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 1;
  for (let i = 1; i < contours.length; i++) {
    let prevContour = contours[i - 1];
    let currContour = contours[i];
    let a = prevContour[prevContour.length - 1]; // End of previous
    let b = currContour[0];                     // Start of current

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  return contours;
}

function connectContours(contours) {

  if (contours.length === 0) return

  let remaining = contours.slice(1)
  let ordered = [contours[0]]

  while (remaining.length > 0) {

    let lastContour = ordered[ordered.length - 1]
    let lastPoint = lastContour[lastContour.length - 1]

    let bestIndex = 0
    let bestDist = Infinity

    for (let i = 0; i < remaining.length; i++) {

      let candidate = remaining[i][0]

      let dx = lastPoint.x - candidate.x
      let dy = lastPoint.y - candidate.y

      let dist = dx * dx + dy * dy

      if (dist < bestDist) {
        bestDist = dist
        bestIndex = i
      }
    }

    ordered.push(remaining[bestIndex])
    remaining.splice(bestIndex, 1)
  }

  return ordered
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