/**
 * Client-side background removal for product photos.
 * Uses Canvas API to detect and remove white/light backgrounds
 * via edge-sampling + flood-fill approach.
 */

/** Check if a pixel is "close" to the background color */
function isBackground(
  r: number, g: number, b: number,
  bgR: number, bgG: number, bgB: number,
  tolerance: number
): boolean {
  const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
  return dist < tolerance;
}

/** Sample corner/edge pixels to detect the dominant background color */
function detectBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number] {
  const samples: [number, number, number][] = [];
  const samplePoints = [
    [0, 0], [width - 1, 0],                         // top corners
    [0, height - 1], [width - 1, height - 1],        // bottom corners
    [Math.floor(width / 2), 0],                      // top center
    [Math.floor(width / 2), height - 1],             // bottom center
    [0, Math.floor(height / 2)],                     // left center
    [width - 1, Math.floor(height / 2)],             // right center
    [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3], // near corners
  ];

  for (const [x, y] of samplePoints) {
    const idx = (y * width + x) * 4;
    samples.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  // Average the samples
  let rSum = 0, gSum = 0, bSum = 0;
  for (const [r, g, b] of samples) {
    rSum += r; gSum += g; bSum += b;
  }
  const n = samples.length;
  return [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)];
}

/** Flood-fill from edges to mark background pixels */
function floodFillEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgR: number, bgG: number, bgB: number,
  tolerance: number
): Set<number> {
  const visited = new Set<number>();
  const bgPixels = new Set<number>();
  const stack: number[] = [];

  // Seed from all edge pixels
  for (let x = 0; x < width; x++) {
    stack.push(x);                           // top row
    stack.push((height - 1) * width + x);    // bottom row
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width);                   // left column
    stack.push(y * width + (width - 1));     // right column
  }

  while (stack.length > 0) {
    const pixelIdx = stack.pop()!;
    if (visited.has(pixelIdx)) continue;
    visited.add(pixelIdx);

    const x = pixelIdx % width;
    const y = Math.floor(pixelIdx / width);
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const dataIdx = pixelIdx * 4;
    const r = data[dataIdx];
    const g = data[dataIdx + 1];
    const b = data[dataIdx + 2];

    if (isBackground(r, g, b, bgR, bgG, bgB, tolerance)) {
      bgPixels.add(pixelIdx);

      // Add 4-connected neighbors
      if (x > 0) stack.push(pixelIdx - 1);
      if (x < width - 1) stack.push(pixelIdx + 1);
      if (y > 0) stack.push(pixelIdx - width);
      if (y < height - 1) stack.push(pixelIdx + width);
    }
  }

  return bgPixels;
}

/** Soften edges by adjusting alpha for pixels near the boundary */
function softenEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgPixels: Set<number>,
  featherRadius: number
) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      if (bgPixels.has(pixelIdx)) continue;  // already transparent

      // Check if this is near a background pixel
      let minDist = featherRadius + 1;
      for (let dy = -featherRadius; dy <= featherRadius; dy++) {
        for (let dx = -featherRadius; dx <= featherRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (bgPixels.has(nIdx)) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
          }
        }
      }

      if (minDist <= featherRadius) {
        const dataIdx = pixelIdx * 4;
        const alpha = Math.min(255, Math.round((minDist / featherRadius) * 255));
        data[dataIdx + 3] = Math.min(data[dataIdx + 3], alpha);
      }
    }
  }
}

export interface RemoveBgOptions {
  /** Color distance tolerance (0-255). Higher = more aggressive. Default: 55 */
  tolerance?: number;
  /** Edge feather radius in pixels. Default: 2 */
  featherRadius?: number;
  /** Max dimension to process (for performance). Default: 800 */
  maxDimension?: number;
}

/**
 * Remove the background from a garment product photo.
 * Returns a new Blob with transparent background.
 */
export async function removeBackground(
  imageSource: string | File | Blob,
  options: RemoveBgOptions = {}
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  const {
    tolerance = 55,
    featherRadius = 2,
    maxDimension = 800,
  } = options;

  // Load image
  const img = new Image();
  img.crossOrigin = "anonymous";

  const loadPromise = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  if (imageSource instanceof File || imageSource instanceof Blob) {
    img.src = URL.createObjectURL(imageSource);
  } else {
    img.src = imageSource;
  }

  await loadPromise;

  // Scale down for performance
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (Math.max(w, h) > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // Detect background color
  const [bgR, bgG, bgB] = detectBackgroundColor(data, w, h);

  // Flood-fill from edges to find background
  const bgPixels = floodFillEdges(data, w, h, bgR, bgG, bgB, tolerance);

  // Set background pixels to transparent
  for (const pixelIdx of bgPixels) {
    const dataIdx = pixelIdx * 4;
    data[dataIdx + 3] = 0;
  }

  // Soften edges
  if (featherRadius > 0) {
    softenEdges(data, w, h, bgPixels, featherRadius);
  }

  // Write back
  ctx.putImageData(imageData, 0, 0);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to create blob"));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);

  // Cleanup temp URL
  if (imageSource instanceof File || imageSource instanceof Blob) {
    URL.revokeObjectURL(img.src);
  }

  return { blob, url, width: w, height: h };
}
