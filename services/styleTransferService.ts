import { CustomModel, CreativeDomain } from "../types.ts";

export interface ContourData {
  points: { x: number; y: number }[];
  confidence: number;
  area: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface SubjectData {
  structure: {
    lineArt: string;
    volumeMap: string;
    contours: ContourData[];
    edges: { x: number; y: number; strength: number }[];
  };
  composition: {
    boundingBoxes: BoundingBox[];
    focalPoints: { x: number; y: number }[];
    perspective: 'flat' | 'perspective' | 'aerial';
    symmetry: number;
  };
  metadata: {
    width: number;
    height: number;
    dominantOrientation: 'horizontal' | 'vertical' | 'square';
    complexity: number;
  };
}

export interface MaterialProperties {
  texture: string;
  roughness: number;
  reflectivity: number;
  type: 'matte' | 'glossy' | 'metallic' | 'translucent' | 'textured';
  surfaceDetail: string;
}

export interface ColorPalette {
  dominantColors: { hex: string; percentage: number }[];
  accentColors: string[];
  temperature: 'warm' | 'cool' | 'neutral';
  saturation: number;
  brightness: number;
  contrast: number;
  harmony: 'monochromatic' | 'analogous' | 'complementary' | 'triadic';
}

export interface LightingConditions {
  direction: string;
  intensity: number;
  shadows: 'soft' | 'hard' | 'diffused';
  highlights: string[];
  ambientLevel: number;
  keyLightColor?: string;
  fillLightRatio?: number;
}

export interface AtmosphericQualities {
  mood: string;
  timeOfDay?: string;
  weather?: string;
  effects: string[];
  depth: 'shallow' | 'medium' | 'deep';
  haze: number;
  grain?: number;
}

export interface StyleData {
  material: MaterialProperties;
  colorScheme: ColorPalette;
  lighting: LightingConditions;
  atmosphere: AtmosphericQualities;
  artisticStyle: string;
  brushwork?: string;
}

export interface StyleTransferConfig {
  subjectWeight: number;
  styleWeight: number;
  preserveStructure: boolean;
  blendMode: 'seamless' | 'layered' | 'artistic';
  detailRetention: number;
}

export interface StyleTransferResult {
  subject: SubjectData;
  style: StyleData;
  combinedPrompt: string;
  config: StyleTransferConfig;
  timestamp: number;
}

const DEFAULT_CONFIG: StyleTransferConfig = {
  subjectWeight: 0.6,
  styleWeight: 0.4,
  preserveStructure: true,
  blendMode: 'seamless',
  detailRetention: 0.8,
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

async function getImageData(dataUrl: string): Promise<{ img: HTMLImageElement; imageData: ImageData }> {
  const img = await loadImage(dataUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { img, imageData };
}

export async function extractSubjectFromBaseImage(baseImageUrl: string): Promise<SubjectData> {
  console.log('[StyleTransfer] 开始提取基础图像主体信息...');
  
  const { img, imageData } = await getImageData(baseImageUrl);
  const { width, height } = img;
  const data = imageData.data;

  const lineArtCanvas = document.createElement('canvas');
  lineArtCanvas.width = width;
  lineArtCanvas.height = height;
  const lineCtx = lineArtCanvas.getContext('2d')!;

  const volumeCanvas = document.createElement('canvas');
  volumeCanvas.width = width;
  volumeCanvas.height = height;
  const volumeCtx = volumeCanvas.getContext('2d')!;

  const grayscale: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    grayscale.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const edgeData = new Uint8ClampedArray(width * height * 4);
  const volumeData = new Uint8ClampedArray(width * height * 4);
  const edges: { x: number; y: number; strength: number }[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const grayVal = grayscale[idx / 4] || 0;
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += grayVal * sobelX[ki];
          gy += grayVal * sobelY[ki];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const normalizedMag = Math.min(255, magnitude);
      const idx = (y * width + x) * 4;
      
      edgeData[idx] = normalizedMag;
      edgeData[idx + 1] = normalizedMag;
      edgeData[idx + 2] = normalizedMag;
      edgeData[idx + 3] = 255;

      const depthVal = Math.min(255, magnitude * 0.8 + (grayscale[y * width + x] || 0) * 0.3);
      volumeData[idx] = depthVal;
      volumeData[idx + 1] = depthVal;
      volumeData[idx + 2] = depthVal * 0.6;
      volumeData[idx + 3] = 255;

      if (normalizedMag > 50) {
        edges.push({ x, y, strength: normalizedMag });
      }
    }
  }

  lineCtx.putImageData(new ImageData(edgeData, width, height), 0, 0);
  volumeCtx.putImageData(new ImageData(volumeData, width, height), 0, 0);

  const lineArtBase64 = lineArtCanvas.toDataURL('image/png');
  const volumeMapBase64 = volumeCanvas.toDataURL('image/png');

  const contours = extractContours(edges, width, height);
  const boundingBoxes = detectBoundingBoxes(edges, width, height);
  const focalPoints = detectFocalPoints(grayscale, width, height);

  const dominantOrientation = width > height * 1.2 ? 'horizontal' : height > width * 1.2 ? 'vertical' : 'square';
  const complexity = calculateComplexity(edges, width, height);
  const symmetry = calculateSymmetry(grayscale, width, height);
  const perspective = detectPerspective(boundingBoxes, width, height);

  console.log(`[StyleTransfer] 主体提取完成: ${edges.length}条边, ${contours.length}个轮廓`);

  return {
    structure: {
      lineArt: lineArtBase64,
      volumeMap: volumeMapBase64,
      contours,
      edges: edges.slice(0, 500),
    },
    composition: {
      boundingBoxes,
      focalPoints,
      perspective,
      symmetry,
    },
    metadata: {
      width,
      height,
      dominantOrientation,
      complexity,
    },
  };
}

function extractContours(edges: { x: number; y: number; strength: number }[], width: number, height: number): ContourData[] {
  const contourMap = new Map<string, { points: { x: number; y: number }[]; totalStrength: number }>();
  const cellSize = 20;
  
  for (const edge of edges) {
    const cellKey = `${Math.floor(edge.x / cellSize)}_${Math.floor(edge.y / cellSize)}`;
    if (!contourMap.has(cellKey)) {
      contourMap.set(cellKey, { points: [], totalStrength: 0 });
    }
    const contour = contourMap.get(cellKey)!;
    contour.points.push({ x: edge.x, y: edge.y });
    contour.totalStrength += edge.strength;
  }

  const contours: ContourData[] = [];
  for (const [key, value] of contourMap) {
    if (value.points.length >= 5) {
      const minX = Math.min(...value.points.map(p => p.x));
      const maxX = Math.max(...value.points.map(p => p.x));
      const minY = Math.min(...value.points.map(p => p.y));
      const maxY = Math.max(...value.points.map(p => p.y));
      contours.push({
        points: value.points.slice(0, 50),
        confidence: Math.min(1, value.totalStrength / value.points.length / 128),
        area: (maxX - minX) * (maxY - minY),
      });
    }
  }

  return contours.sort((a, b) => b.area - a.area).slice(0, 50);
}

function detectBoundingBoxes(edges: { x: number; y: number; strength: number }[], width: number, height: number): BoundingBox[] {
  const regions: { points: { x: number; y: number }[]; strengths: number[] }[] = [];
  const visited = new Set<string>();
  const threshold = 80;

  for (const edge of edges) {
    if (edge.strength < threshold) continue;
    
    const key = `${edge.x}_${edge.y}`;
    if (visited.has(key)) continue;

    const region = { points: [edge], strengths: [edge.strength] };
    visited.add(key);
    
    const queue = [edge];
    while (queue.length > 0 && region.points.length < 1000) {
      const current = queue.shift()!;
      const neighbors = [
        { x: current.x - 10, y: current.y },
        { x: current.x + 10, y: current.y },
        { x: current.x, y: current.y - 10 },
        { x: current.x, y: current.y + 10 },
      ];
      
      for (const n of neighbors) {
        const nKey = `${n.x}_${n.y}`;
        if (!visited.has(nKey) && n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          visited.add(nKey);
          const nearbyEdge = edges.find(e => 
            Math.abs(e.x - n.x) < 15 && Math.abs(e.y - n.y) < 15 && e.strength >= threshold
          );
          if (nearbyEdge) {
            region.points.push(nearbyEdge);
            region.strengths.push(nearbyEdge.strength);
            queue.push(nearbyEdge);
          }
        }
      }
    }
    
    if (region.points.length >= 20) {
      regions.push(region);
    }
  }

  return regions.slice(0, 30).map(region => {
    const xs = region.points.map(p => p.x);
    const ys = region.points.map(p => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  });
}

function detectFocalPoints(grayscale: number[], width: number, height: number): { x: number; y: number }[] {
  const blockSize = Math.min(width, height) / 10;
  const blocks: { sum: number; count: number; x: number; y: number }[] = [];
  
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let sum = 0, count = 0;
      for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
          sum += grayscale[(by + dy) * width + (bx + dx)] || 0;
          count++;
        }
      }
      if (count > 0) {
        blocks.push({ 
          sum, 
          count, 
          x: bx + blockSize / 2, 
          y: by + blockSize / 2 
        });
      }
    }
  }

  blocks.sort((a, b) => (b.sum / b.count) - (a.sum / a.count));
  
  return blocks.slice(0, 5).map(b => ({ x: Math.round(b.x), y: Math.round(b.y) }));
}

function calculateComplexity(edges: { x: number; y: number; strength: number }[], width: number, height: number): number {
  const pixelCount = width * height;
  const edgeDensity = edges.length / pixelCount;
  const avgStrength = edges.reduce((sum, e) => sum + e.strength, 0) / (edges.length || 1);
  return Math.min(1, (edgeDensity * 100 + avgStrength / 255) / 2);
}

function calculateSymmetry(grayscale: number[], width: number, height: number): number {
  let symmetricPixels = 0;
  let totalPixels = 0;
  const midX = width / 2;
  const tolerance = 20;

  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < midX; x += 5) {
      const leftVal = grayscale[y * width + x] || 0;
      const rightVal = grayscale[y * width + (width - 1 - x)] || 0;
      if (Math.abs(leftVal - rightVal) < tolerance) {
        symmetricPixels++;
      }
      totalPixels++;
    }
  }

  return totalPixels > 0 ? symmetricPixels / totalPixels : 0.5;
}

function detectPerspective(boundingBoxes: BoundingBox[], width: number, height: number): 'flat' | 'perspective' | 'aerial' {
  if (boundingBoxes.length === 0) return 'flat';

  const avgY = boundingBoxes.reduce((sum, bb) => sum + bb.y, 0) / boundingBoxes.length;
  const avgHeight = boundingBoxes.reduce((sum, bb) => sum + bb.height, 0) / boundingBoxes.length;
  
  if (avgHeight > height * 0.6) return 'flat';
  if (avgY < height * 0.3) return 'aerial';
  return 'perspective';
}

export async function extractStyleFromReferenceImage(referenceImageUrl: string): Promise<StyleData> {
  console.log('[StyleTransfer] 开始提取参考图像风格信息...');
  
  const { img, imageData } = await getImageData(referenceImageUrl);
  const { width, height } = img;
  const data = imageData.data;

  const material = analyzeMaterial(data, width, height);
  const colorScheme = analyzeColorScheme(data, width, height);
  const lighting = analyzeLighting(data, width, height);
  const atmosphere = analyzeAtmosphere(data, width, height, colorScheme, lighting);
  const artisticStyle = determineArtisticStyle(material, colorScheme, lighting, atmosphere);
  const brushwork = analyzeBrushwork(data, width, height);

  console.log(`[StyleTransfer] 风格提取完成: 材质=${material.type}, 色温=${colorScheme.temperature}, 光照=${lighting.shadows}`);

  return {
    material,
    colorScheme,
    lighting,
    atmosphere,
    artisticStyle,
    brushwork,
  };
}

function analyzeMaterial(data: Uint8ClampedArray, width: number, height: number): MaterialProperties {
  let textureVariance = 0;
  let highFreqEnergy = 0;
  let specularHighlights = 0;
  let totalSamples = 0;

  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      
      const neighbors = [
        ((y - 1) * width + x) * 4,
        ((y + 1) * width + x) * 4,
        (y * width + (x - 1)) * 4,
        (y * width + (x + 1)) * 4,
      ];

      let localVariance = 0;
      for (const nIdx of neighbors) {
        localVariance += Math.abs(r - data[nIdx]) + 
                        Math.abs(g - data[nIdx + 1]) + 
                        Math.abs(b - data[nIdx + 2]);
      }
      localVariance /= 12;
      textureVariance += localVariance;

      if (localVariance > 40) highFreqEnergy++;

      const brightness = (r + g + b) / 3;
      if (brightness > 220) specularHighlights++;

      totalSamples++;
    }
  }

  const avgTextureVariance = textureVariance / (totalSamples || 1);
  const roughness = Math.min(1, avgTextureVariance / 60);
  const reflectivity = Math.min(1, specularHighlights / (totalSamples || 1) * 5);

  let type: MaterialProperties['type'] = 'matte';
  let texture = 'smooth';
  let surfaceDetail = 'uniform';

  if (reflectivity > 0.3) type = 'glossy';
  else if (roughness > 0.5 && reflectivity > 0.15) type = 'metallic';
  else if (roughness > 0.6) type = 'textured';
  else if (avgTextureVariance > 25 && reflectivity < 0.1) type = 'translucent';

  if (avgTextureVariance > 35) texture = 'rough';
  else if (avgTextureVariance > 20) texture = 'medium-texture';
  
  if (highFreqEnergy / (totalSamples || 1) > 0.3) surfaceDetail = 'intricate';
  else if (highFreqEnergy / (totalSamples || 1) > 0.15) surfaceDetail = 'moderate';

  return { texture, roughness, reflectivity, type, surfaceDetail };
}

function analyzeColorScheme(data: Uint8ClampedArray, width: number, height: number): ColorPalette {
  const colorCounts = new Map<string, number>();
  const hueBuckets = new Array(360).fill(0);
  let totalSaturation = 0;
  let totalBrightness = 0;
  let totalContrast = 0;
  let sampleCount = 0;
  const step = 4;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const s = max === min ? 0 : l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
      let h = 0;
      if (max !== min) {
        if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
        else h = ((r - g) / (max - min) + 4) / 6;
      }

      const quantizedHue = Math.round(h * 360) % 360;
      hueBuckets[quantizedHue]++;
      
      totalSaturation += s;
      totalBrightness += l;
      sampleCount++;

      const hex = `#${data[idx].toString(16).padStart(2, '0')}${data[idx+1].toString(16).padStart(2, '0')}${data[idx+2].toString(16).padStart(2, '0')}`;
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  const sortedColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, percentage: count / (sampleCount || 1) }));

  const dominantHues = findDominantHues(hueBuckets, 3);
  const temperature = determineTemperature(dominantHues);
  const saturation = totalSaturation / (sampleCount || 1);
  const brightness = totalBrightness / (sampleCount || 1);
  const contrast = calculateLocalContrast(data, width, height);
  const harmony = determineColorHarmony(dominantHues);

  return {
    dominantColors: sortedColors.slice(0, 5),
    accentColors: sortedColors.slice(5).map(c => c.hex),
    temperature,
    saturation,
    brightness,
    contrast,
    harmony,
  };
}

function findDominantHues(hueBuckets: number[], count: number): number[] {
  const smoothed = [...hueBuckets];
  const window = 15;
  for (let i = 0; i < 360; i++) {
    let sum = 0;
    for (let j = -window; j <= window; j++) {
      sum += smoothed[(i + j + 360) % 360];
    }
    smoothed[i] = sum / (window * 2 + 1);
  }

  const peaks: { hue: number; value: number }[] = [];
  for (let i = 0; i < 360; i++) {
    const prev = smoothed[(i - 1 + 360) % 360];
    const next = smoothed[(i + 1) % 360];
    if (smoothed[i] > prev && smoothed[i] > next && smoothed[i] > 0) {
      peaks.push({ hue: i, value: smoothed[i] });
    }
  }

  return peaks.sort((a, b) => b.value - a.value).slice(0, count).map(p => p.hue);
}

function determineTemperature(dominantHues: number[]): 'warm' | 'cool' | 'neutral' {
  if (dominantHues.length === 0) return 'neutral';
  
  let warmScore = 0, coolScore = 0;
  for (const hue of dominantHues) {
    if ((hue >= 0 && hue <= 45) || (hue >= 315 && hue <= 360)) warmScore++;
    else if (hue >= 195 && hue <= 285) coolScore++;
  }

  if (warmScore > coolScore) return 'warm';
  if (coolScore > warmScore) return 'cool';
  return 'neutral';
}

function calculateLocalContrast(data: Uint8ClampedArray, width: number, height: number): number {
  let contrastSum = 0;
  let samples = 0;
  const step = 8;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const centerBrightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      const offsets = [[-step, 0], [step, 0], [0, -step], [0, step]];
      let localMax = 0, localMin = 255;
      
      for (const [dx, dy] of offsets) {
        const nIdx = ((y + dy) * width + (x + dx)) * 4;
        const brightness = (data[nIdx] + data[nIdx + 1] + data[nIdx + 2]) / 3;
        localMax = Math.max(localMax, brightness);
        localMin = Math.min(localMin, brightness);
      }
      
      contrastSum += (localMax - localMin) / 255;
      samples++;
    }
  }

  return samples > 0 ? contrastSum / samples : 0.5;
}

function determineColorHarmony(dominantHues: number[]): ColorPalette['harmony'] {
  if (dominantHues.length < 2) return 'monochromatic';
  
  const sorted = [...dominantHues].sort((a, b) => a - b);
  const diffs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    diffs.push(sorted[i + 1] - sorted[i]);
  }
  diffs.push((sorted[0] + 360) - sorted[sorted.length - 1]);

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  
  if (avgDiff <= 30) return 'analogous';
  if (avgDiff >= 150 && avgDiff <= 210) return 'complementary';
  if (dominantHues.length >= 3) return 'triadic';
  return 'analogous';
}

function analyzeLighting(data: Uint8ClampedArray, width: number, height: number): LightingConditions {
  let brightRegions = 0;
  let darkRegions = 0;
  let shadowTransitions = 0;
  const step = 6;
  let totalSamples = 0;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      if (brightness > 200) brightRegions++;
      else if (brightness < 55) darkRegions++;

      const rightIdx = (y * width + (x + step)) * 4;
      const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
      if (Math.abs(brightness - rightBrightness) > 80) shadowTransitions++;

      totalSamples++;
    }
  }

  const intensity = brightRegions / (totalSamples || 1);
  const shadowDensity = darkRegions / (totalSamples || 1);
  const shadowTransitionRate = shadowTransitions / (totalSamples || 1);

  let shadows: LightingConditions['shadows'] = 'diffused';
  if (shadowTransitionRate > 0.25) shadows = 'hard';
  else if (shadowTransitionRate > 0.12) shadows = 'soft';

  const direction = inferLightDirection(data, width, height);
  const highlights = detectHighlightColors(data, width, height);
  const ambientLevel = 1 - shadowDensity;
  const keyLightColor = identifyKeyLightColor(highlights);

  return {
    direction,
    intensity: Math.min(1, intensity * 2),
    shadows,
    highlights,
    ambientLevel,
    keyLightColor,
    fillLightRatio: Math.max(0, Math.min(1, ambientLevel - intensity)),
  };
}

function inferLightDirection(data: Uint8ClampedArray, width: number, height: number): string {
  const quadrants = [
    { name: 'top-left', x: 0, y: 0, w: width / 2, h: height / 2 },
    { name: 'top-right', x: width / 2, y: 0, w: width / 2, h: height / 2 },
    { name: 'bottom-left', x: 0, y: height / 2, w: width / 2, h: height / 2 },
    { name: 'bottom-right', x: width / 2, y: height / 2, w: width / 2, h: height / 2 },
  ];

  const quadrantBrightness = quadrants.map(q => {
    let sum = 0, count = 0;
    for (let y = q.y; y < q.y + q.h; y += 10) {
      for (let x = q.x; x < q.x + q.w; x += 10) {
        const idx = (y * width + x) * 4;
        sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        count++;
      }
    }
    return { name: q.name, brightness: count > 0 ? sum / count : 0 };
  });

  quadrantBrightness.sort((a, b) => b.brightness - a.brightness);
  return quadrantBrightness[0]?.name?.replace('-', ' ') || 'frontal';
}

function detectHighlightColors(data: Uint8ClampedArray, width: number, height: number): string[] {
  const highlightColors = new Map<string, number>();
  const step = 10;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      if (brightness > 210) {
        let colorName = 'white';
        if (r > g && r > b && r - g > 30) colorName = 'warm-white';
        else if (b > r && b > g && b - r > 30) colorName = 'cool-white';
        else if (g > r && g > b && g - Math.min(r, b) > 20) colorName = 'tinted-white';
        
        highlightColors.set(colorName, (highlightColors.get(colorName) || 0) + 1);
      }
    }
  }

  return [...highlightColors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

function identifyKeyLightColor(highlights: string[]): string | undefined {
  if (highlights.includes('warm-white')) return '#FFF5E6';
  if (highlights.includes('cool-white')) return '#E6F0FF';
  if (highlights.includes('tinted-white')) return '#E6FFE6';
  return undefined;
}

function analyzeAtmosphere(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  colorScheme: ColorPalette, 
  lighting: LightingConditions
): AtmosphericQualities {
  const mood = determineMood(colorScheme, lighting);
  const timeOfDay = estimateTimeOfDay(lighting, colorScheme);
  const weather = estimateWeather(colorScheme, lighting);
  const effects = detectAtmosphericEffects(data, width, height, colorScheme);
  const depth = estimateDepth(data, width, height);
  const haze = estimateHaze(data, width, height);
  const grain = estimateGrain(data, width, height);

  return { mood, timeOfDay, weather, effects, depth, haze, grain };
}

function determineMood(colorScheme: ColorPalette, lighting: LightingConditions): string {
  const moods: string[] = [];
  
  if (colorScheme.saturation < 0.25) moods.push('muted');
  if (colorScheme.saturation > 0.65) moods.push('vibrant');
  if (lighting.intensity > 0.7) moods.push('bright');
  if (lighting.intensity < 0.3) moods.push('somber');
  if (lighting.shadows === 'hard') moods.push('dramatic');
  if (lighting.shadows === 'diffused') moods.push('gentle');
  if (colorScheme.temperature === 'warm') moods.push('warm');
  if (colorScheme.temperature === 'cool') moods.push('cool');

  return moods.length > 0 ? moods.slice(0, 3).join(', ') : 'balanced';
}

function estimateTimeOfDay(lighting: LightingConditions, colorScheme: ColorPalette): string | undefined {
  if (lighting.intensity > 0.75 && colorScheme.temperature === 'warm') return 'golden-hour';
  if (lighting.intensity > 0.75 && colorScheme.temperature === 'cool') return 'midday';
  if (lighting.intensity < 0.35 && colorScheme.temperature === 'warm') return 'sunset/sunrise';
  if (lighting.intensity < 0.35 && colorScheme.temperature === 'cool') return 'night/dusk';
  return undefined;
}

function estimateWeather(colorScheme: ColorPalette, lighting: LightingConditions): string | undefined {
  if (lighting.ambientLevel > 0.85) return 'clear';
  if (lighting.ambientLevel < 0.55 && lighting.shadows === 'diffused') return 'overcast';
  if (colorScheme.brightness < 0.35) return 'stormy/gloomy';
  return undefined;
}

function detectAtmosphericEffects(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  colorScheme: ColorPalette
): string[] {
  const effects: string[] = [];
  
  if (colorScheme.saturation < 0.2 && colorScheme.contrast < 0.3) effects.push('fog/mist');
  if (colorScheme.brightness > 0.8 && colorScheme.contrast > 0.6) effects.push('high-key');
  if (colorScheme.brightness < 0.25) effects.push('low-key/noir');
  if (colorScheme.temperature === 'warm' && colorScheme.saturation > 0.6) effects.push('golden-glow');
  if (hasBokehEffect(data, width, height)) effects.push('bokeh/depth-blur');
  if (hasLensFlare(data, width, height)) effects.push('lens-flare');
  if (hasVignette(data, width, height)) effects.push('vignette');

  return effects;
}

function hasBokehEffect(data: Uint8ClampedArray, width: number, height: number): boolean {
  const centerRegion = { x: width * 0.3, y: height * 0.3, w: width * 0.4, h: height * 0.4 };
  const edgeRegion = [
    { x: 0, y: 0, w: width * 0.15, h: height },
    { x: width * 0.85, y: 0, w: width * 0.15, h: height },
  ];

  let centerSharpness = 0, edgeBlur = 0;
  let centerSamples = 0, edgeSamples = 0;
  const step = 8;

  for (let y = centerRegion.y; y < centerRegion.y + centerRegion.h; y += step) {
    for (let x = centerRegion.x; x < centerRegion.x + centerRegion.w; x += step) {
      const idx = (y * width + x) * 4;
      const neighbors = [
        (y * width + Math.min(x + 2, width - 1)) * 4,
        (Math.min(y + 2, height - 1) * width + x) * 4,
      ];
      let diff = 0;
      for (const n of neighbors) {
        diff += Math.abs(data[idx] - data[n]) + Math.abs(data[idx + 1] - data[n + 1]);
      }
      centerSharpness += diff / 2;
      centerSamples++;
    }
  }

  for (const region of edgeRegion) {
    for (let y = region.y; y < region.y + region.h; y += step) {
      for (let x = region.x; x < region.x + region.w; x += step) {
        const idx = (y * width + x) * 4;
        const neighbors = [
          (y * width + Math.min(x + 2, width - 1)) * 4,
          (Math.min(y + 2, height - 1) * width + x) * 4,
        ];
        let diff = 0;
        for (const n of neighbors) {
          diff += Math.abs(data[idx] - data[n]) + Math.abs(data[idx + 1] - data[n + 1]);
        }
        edgeBlur += diff / 2;
        edgeSamples++;
      }
    }
  }

  const centerAvg = centerSamples > 0 ? centerSharpness / centerSamples : 0;
  const edgeAvg = edgeSamples > 0 ? edgeBlur / edgeSamples : 0;
  
  return centerAvg > edgeAvg * 2.5;
}

function hasLensFlare(data: Uint8ClampedArray, width: number, height: number): boolean {
  let flareCandidates = 0;
  const step = 12;
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      
      if (r > 240 && g > 230 && b > 200 && r - b > 20) {
        let surroundingDark = 0;
        const checkDist = 3;
        for (let dy = -checkDist; dy <= checkDist; dy++) {
          for (let dx = -checkDist; dx <= checkDist; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              if ((data[nIdx] + data[nIdx + 1] + data[nIdx + 2]) / 3 < 150) {
                surroundingDark++;
              }
            }
          }
        }
        if (surroundingDark > 4) flareCandidates++;
      }
    }
  }

  return flareCandidates > 3;
}

function hasVignette(data: Uint8ClampedArray, width: number, height: number): boolean {
  const centerX = width / 2, centerY = height / 2;
  const innerRadius = Math.min(width, height) * 0.3;
  const outerRadius = Math.min(width, height) * 0.48;

  let innerBrightness = 0, outerBrightness = 0;
  let innerCount = 0, outerCount = 0;
  const step = 10;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      if (dist < innerRadius) {
        innerBrightness += brightness;
        innerCount++;
      } else if (dist > outerRadius && dist < outerRadius * 1.3) {
        outerBrightness += brightness;
        outerCount++;
      }
    }
  }

  const innerAvg = innerCount > 0 ? innerBrightness / innerCount : 128;
  const outerAvg = outerCount > 0 ? outerBrightness / outerCount : 128;

  return innerAvg > outerAvg * 1.15;
}

function estimateDepth(data: Uint8ClampedArray, width: number, height: number): AtmosphericQualities['depth'] {
  let gradientStrength = 0;
  const step = 15;
  let samples = 0;

  for (let y = step; y < height - step; y += step) {
    const topBrightness = getAverageBrightness(data, width, y - step, 1, width);
    const bottomBrightness = getAverageBrightness(data, width, y + step, 1, width);
    gradientStrength += Math.abs(topBrightness - bottomBrightness);
    samples++;
  }

  const avgGradient = samples > 0 ? gradientStrength / samples : 0;
  
  if (avgGradient > 40) return 'deep';
  if (avgGradient > 20) return 'medium';
  return 'shallow';
}

function getAverageBrightness(data: Uint8ClampedArray, width: number, startY: number, rows: number, cols: number): number {
  let sum = 0, count = 0;
  for (let y = startY; y < startY + rows && y * width < data.length / 4; y++) {
    for (let x = 0; x < cols && x < width; x++) {
      const idx = (y * width + x) * 4;
      sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      count++;
    }
  }
  return count > 0 ? sum / count : 128;
}

function estimateHaze(data: Uint8ClampedArray, width: number, height: number): number {
  let lowContrastPixels = 0;
  let totalPixels = 0;
  const step = 8;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const range = Math.max(r, g, b) - Math.min(r, g, b);
      
      if (range < 30) lowContrastPixels++;
      totalPixels++;
    }
  }

  return totalPixels > 0 ? lowContrastPixels / totalPixels : 0;
}

function estimateGrain(data: Uint8ClampedArray, width: number, height: number): number {
  let noiseSum = 0;
  let samples = 0;
  const step = 5;

  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      const idx = (y * width + x) * 4;
      const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      const neighbors = [
        (y * width + x + 1) * 4,
        (y * width + x - 1) * 4,
        ((y + 1) * width + x) * 4,
        ((y - 1) * width + x) * 4,
      ];

      let localNoise = 0;
      for (const n of neighbors) {
        localNoise += Math.abs(center - (data[n] + data[n + 1] + data[n + 2]) / 3);
      }
      noiseSum += localNoise / 4;
      samples++;
    }
  }

  return samples > 0 ? noiseSum / samples / 25 : 0;
}

function determineArtisticStyle(
  material: MaterialProperties, 
  colorScheme: ColorPalette, 
  lighting: LightingConditions, 
  atmosphere: AtmosphericQualities
): string {
  const styles: string[] = [];

  if (material.type === 'metallic' && lighting.shadows === 'hard') styles.push('industrial');
  if (material.type === 'matte' && colorScheme.harmony === 'monochromatic') styles.push('minimalist');
  if (colorScheme.saturation > 0.7 && atmosphere.mood.includes('vibrant')) styles.push('pop-art');
  if (atmosphere.effects.includes('bokeh/depth-blur')) styles.push('cinematic');
  if (lighting.direction.includes('top') && colorScheme.temperature === 'warm') styles.push('renaissance');
  if (material.surfaceDetail === 'intricate' && colorScheme.contrast > 0.6) styles.push('hyperrealistic');
  if (colorScheme.saturation < 0.3 && atmosphere.haze > 0.4) styles.push('impressionistic');
  if (lighting.shadows === 'soft' && material.texture === 'smooth') styles.push('ethereal');
  if (colorScheme.harmony === 'complementary' && lighting.intensity > 0.6) styles.push('bold-dramatic');
  if (material.type === 'textured' && colorScheme.temperature === 'warm') styles.push('organic-natural');

  return styles.length > 0 ? styles.join('-') : 'photorealistic';
}

function analyzeBrushwork(data: Uint8ClampedArray, width: number, height: number): string {
  let strokePatterns = 0;
  let uniformAreas = 0;
  const step = 6;
  let samples = 0;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const horizontalDiff = Math.abs(data[idx] - data[(y * width + x + step) * 4]);
      const verticalDiff = Math.abs(data[idx] - data[((y + step) * width + x) * 4]);
      
      if (Math.abs(horizontalDiff - verticalDiff) > 30) strokePatterns++;
      else if (horizontalDiff < 10 && verticalDiff < 10) uniformAreas++;
      
      samples++;
    }
  }

  const patternRatio = samples > 0 ? strokePatterns / samples : 0;
  const uniformRatio = samples > 0 ? uniformAreas / samples : 0;

  if (patternRatio > 0.35) return 'expressive-visible-brushstrokes';
  if (patternRatio > 0.2) return 'subtle-textured';
  if (uniformRatio > 0.6) return 'smooth-airbrushed';
  return 'photographic-realism';
}

export async function executeStyleTransfer(
  baseImageUrl: string,
  referenceImageUrl: string,
  userPrompt: string,
  config: Partial<StyleTransferConfig> = {},
  domain: CreativeDomain = 'architecture'
): Promise<StyleTransferResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[StyleTransfer] 开始执行风格迁移...');
  console.log(`[StyleTransfer] 配置: subjectWeight=${mergedConfig.subjectWeight}, styleWeight=${mergedConfig.styleWeight}`);

  const [subject, style] = await Promise.all([
    extractSubjectFromBaseImage(baseImageUrl),
    extractStyleFromReferenceImage(referenceImageUrl),
  ]);

  const combinedPrompt = buildStyleTransferPrompt(subject, style, userPrompt, mergedConfig, domain);

  const result: StyleTransferResult = {
    subject,
    style,
    combinedPrompt,
    config: mergedConfig,
    timestamp: Date.now(),
  };

  console.log('[StyleTransfer] 风格迁移准备完成，生成提示词长度:', combinedPrompt.length);
  return result;
}

function buildStyleTransferPrompt(
  subject: SubjectData,
  style: StyleData,
  userPrompt: string,
  config: StyleTransferConfig,
  domain: CreativeDomain
): string {
  const parts: string[] = [];

  parts.push(`[STYLE-TRANSFER-MODE]`);
  parts.push(`Preserve the exact structural composition and subject layout from the source image while applying the following stylistic transformation:`);

  parts.push(`\n## SUBJECT STRUCTURE (retain ${config.subjectWeight * 100}%)`);
  parts.push(`- Composition: ${subject.metadata.dominantOrientation} orientation, ${subject.composition.perspective} perspective view`);
  parts.push(`- Complexity level: ${(subject.metadata.complexity * 100).toFixed(0)}% (${subject.metadata.complexity > 0.6 ? 'complex/detailed' : subject.metadata.complexity > 0.3 ? 'moderate' : 'simple/clean'})`);
  parts.push(`- Symmetry: ${(subject.composition.symmetry * 100).toFixed(0)}% balanced`);
  parts.push(`- Key structural elements: ${subject.structure.contours.length} major forms detected`);
  parts.push(`- Focal point arrangement: ${subject.composition.focalPoints.length} visual anchors`);

  parts.push(`\n## STYLE CHARACTERISTICS (apply ${config.styleWeight * 100}%)`);
  parts.push(`- Artistic style: ${style.artisticStyle}`);
  parts.push(`- Material properties: ${style.material.type}, ${style.material.texture} texture, ${style.material.surfaceDetail} surface detail`);
  parts.push(`- Color scheme: ${style.colorScheme.temperature} palette, ${style.colorScheme.harmony} harmony, saturation ${(style.colorScheme.saturation * 100).toFixed(0)}%`);
  parts.push(`- Dominant colors: ${style.colorScheme.dominantColors.slice(0, 3).map(c => c.hex).join(', ')}`);
  parts.push(`- Lighting: ${style.lighting.direction} light source, ${style.lighting.shadows} shadows, intensity ${(style.lighting.intensity * 100).toFixed(0)}%`);
  parts.push(`- Atmosphere: ${style.atmosphere.mood}, ${style.atmosphere.depth} depth of field`);
  if (style.atmosphere.timeOfDay) parts.push(`- Time of day: ${style.atmosphere.timeOfDay}`);
  if (style.atmosphere.weather) parts.push(`- Weather condition: ${style.atmosphere.weather}`);
  if (style.brushwork) parts.push(`- Rendering technique: ${style.brushwork}`);

  if (style.atmosphere.effects.length > 0) {
    parts.push(`- Special effects: ${style.atmosphere.effects.join(', ')}`);
  }

  parts.push(`\n## BLEND MODE: ${config.blendMode.toUpperCase()}`);
  parts.push(`Structure preservation priority: ${config.preserveStructure ? 'HIGH' : 'MODERATE'}`);
  parts.push(`Detail retention: ${(config.detailRetention * 100).toFixed(0)}%`);

  if (domain === 'architecture') {
    parts.push(`\n## DOMAIN-SPECIFIC GUIDANCE (Architecture)`);
    parts.push(`Maintain architectural integrity: structural lines, load-bearing elements, and spatial relationships must remain geometrically accurate.`);
    parts.push(`Apply style to surface treatments, material rendering, environmental context, and atmospheric perspective only.`);
  } else if (domain === 'product') {
    parts.push(`\n## DOMAIN-SPECIFIC GUIDANCE (Product Design)`);
    parts.push(`Preserve product form factor, functional interfaces, and brand identity elements.`);
    parts.push(`Transform material finish, presentation context, and lifestyle atmosphere according to reference style.`);
  } else if (domain === 'art') {
    parts.push(`\n## DOMAIN-SPECIFIC GUIDANCE (Creative Art)`);
    parts.push(`Balance creative interpretation with compositional fidelity. Allow artistic enhancement while respecting original subject placement and proportions.`);
  }

  if (userPrompt.trim()) {
    parts.push(`\n## USER DIRECTIVE`);
    parts.push(userPrompt);
  }

  return parts.join('\n');
}

export function serializeStyleTransferData(result: StyleTransferResult): string {
  return JSON.stringify({
    version: '1.0',
    timestamp: result.timestamp,
    config: result.config,
    subject: {
      metadata: result.subject.metadata,
      composition: {
        perspective: result.subject.composition.perspective,
        symmetry: result.subject.composition.symmetry,
        dominantOrientation: result.subject.metadata.dominantOrientation,
        complexity: result.subject.metadata.complexity,
      },
      structureSummary: {
        contourCount: result.subject.structure.contours.length,
        edgeCount: result.subject.structure.edges.length,
      },
    },
    style: {
      artisticStyle: result.style.artisticStyle,
      material: {
        type: result.style.material.type,
        texture: result.style.material.texture,
        surfaceDetail: result.style.material.surfaceDetail,
        roughness: result.style.material.roughness,
        reflectivity: result.style.material.reflectivity,
      },
      colorScheme: {
        temperature: result.style.colorScheme.temperature,
        harmony: result.style.colorScheme.harmony,
        saturation: result.style.colorScheme.saturation,
        brightness: result.style.colorScheme.brightness,
        contrast: result.style.colorScheme.contrast,
        dominantColors: result.style.colorScheme.dominantColors,
      },
      lighting: {
        direction: result.style.lighting.direction,
        intensity: result.style.lighting.intensity,
        shadows: result.style.lighting.shadows,
        ambientLevel: result.style.lighting.ambientLevel,
      },
      atmosphere: {
        mood: result.style.atmosphere.mood,
        timeOfDay: result.style.atmosphere.timeOfDay,
        weather: result.style.atmosphere.weather,
        depth: result.style.atmosphere.depth,
        haze: result.style.atmosphere.haze,
        effects: result.style.atmosphere.effects,
      },
      brushwork: result.style.brushwork,
    },
    promptLength: result.combinedPrompt.length,
  }, null, 2);
}
