const toggleButton = document.getElementById('toggleButton');
const sidebar = document.getElementById('sidebar');
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const clearButton = document.getElementById('clearButton');
const pointsCount = document.getElementById('pointsCount');
const imageInput = document.getElementById('imageInput');
const edgeButton = document.getElementById('edgeButton');
const fourierButton = document.getElementById('fourierBtn');
let DrawInterval
let freq = 0
let delta = 0

let uploadedImage = null;


let drawing = false;
let points = [];

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

function FFT() {
  fixToRadix2()
  let DFT = new Array(points.length).fill(0)
  DFT = ditFFT2(points, points.length)
  let circles = DFTtoCircle(DFT)
  freq = 2 * math.pi / points.length * math.ceil(points.length / 700)  
  DrawInterval = setInterval(drawCircle, 10, circles);
}

function DFTtoCircle(DFT) {
  let circles = []
  for (let i = 0; i < DFT.length; i++) {
    circles.push({ freq: i, amp: math.abs(DFT[i]), phase: math.atan2(DFT[i].im, DFT[i].re) })
  }
  circles.sort((a, b) => b.amp - a.amp)
  return circles
}

function ditFFT2(x, N, s = 1) {
  // Allocate output array
  const X = new Array(N);

  // Base case
  if (N === 1) {
    X[0] = math.complex(x[0].x, x[0].y)
    return X;
  }

  // Recursive DFTs of even and odd indices
  const even = ditFFT2(x, N / 2, 2 * s);         // x0, x2s, x4s, ...
  const odd = ditFFT2(x.slice(s), N / 2, 2 * s); // xs, x3s, x5s, ...

  // Combine
  for (let k = 0; k < N / 2; k++) {
    const t = math.multiply(math.exp(math.multiply(math.i, 2 * Math.PI * k / N)), odd[k]);
    X[k] = math.add(even[k], t);
    X[k + N / 2] = math.subtract(even[k], t);
  }

  if (s === 1) {
    for (let i = 0; i < N; i++) {
      X[i] = math.divide(X[i], N);
    }
  }

  return X;
}

function fixToRadix2() {
  let dots = points.length
  let fix = 0
  let power
  for (power = 0; dots > 1; power++) {
    if (dots % 2 == 1) {
      dots += 1
      fix += 2 ** power
    }
    dots /= 2
  }
  // let dist = points.length/fix
  for (let i = 0; i < fix; i++) {
    points.push(points[points.length - 1])
  }
}

function drawCircle(circles) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let x = 0, y = 0
  let way = []
  for (let i = 0; i < circles.length; i++) {
    way.push({ x, y })
    x += circles[i].amp * math.cos(circles[i].phase + delta * circles[i].freq)
    y += circles[i].amp * math.sin(circles[i].phase + delta * circles[i].freq)
  }
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  for (let index = 1; index < way.length; index++) {
    ctx.beginPath();
    ctx.arc(way[index].x, way[index].y, circles[index].amp, 0, 2 * Math.PI)
    ctx.stroke();
  }
  
  ctx.strokeStyle = "cyan";
  ctx.beginPath();
  ctx.moveTo(way[0].x, way[0].y)
  for (let index = 1; index < way.length; index++) {
    ctx.lineTo(way[index].x, way[index].y)
  }
  ctx.lineTo(x, y)
  ctx.stroke();

  ctx.strokeStyle = "red"
  ctx.beginPath();
  ctx.moveTo(x, y)
  ctx.lineTo(x, y)
  ctx.stroke();

  delta += freq
  console.log(delta);
  
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawLine(p1, p2, color = 'white') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function addPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  points.push({ x, y });
  updatePointsCount();
}

function updatePointsCount() {
  pointsCount.textContent = points.length;
}

toggleButton.addEventListener('click', () => {
  sidebar.classList.toggle('-translate-x-full');
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  if (fourierButton.disabled) {
    fourierBtn.removeAttribute("disabled");
  }
  addPoint(e);
  redraw()
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
  drawLine(points[points.length - 1], points[0], "lime");
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  addPoint(e);
  if (points.length < 2) return;
  drawLine(points[points.length - 2], points[points.length - 1]);
});

fourierButton.addEventListener('click', () => {
  fourierBtn.setAttribute("disabled", true);
  FFT()
});

clearButton.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  points = [];
  updatePointsCount();

  // Clear uploaded image and file input
  imageInput.value = '';
  uploadedImage = null;
  edgeButton.classList.add('hidden'); // Optionally hide the button again
  clearInterval(DrawInterval)
});

imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = function (e) {
    img.onload = function () {
      console.log('Image loaded successfully'); // ADD THIS LINE
      uploadedImage = img;
      edgeButton.classList.remove('hidden'); // Show the button
      console.log(edgeButton.classList);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Optional: show the original image scaled to fit canvas
      const aspectRatio = img.width / img.height;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;

      if (canvas.width / canvas.height > aspectRatio) {
        drawWidth = canvas.height * aspectRatio;
      } else {
        drawHeight = canvas.width / aspectRatio;
      }

      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
});

edgeButton.addEventListener('click', () => {
  if (!uploadedImage) return;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = uploadedImage.width;
  tempCanvas.height = uploadedImage.height;
  tempCtx.drawImage(uploadedImage, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

  const edgeData = applySobel(imageData);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleCanvas = document.createElement('canvas');
  scaleCanvas.width = edgeData.width;
  scaleCanvas.height = edgeData.height;
  const scaleCtx = scaleCanvas.getContext('2d');
  scaleCtx.putImageData(edgeData, 0, 0);

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
});
