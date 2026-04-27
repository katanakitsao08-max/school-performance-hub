// Singleton loader for face-api.js models.
// Models are served from a free public CDN (justadudewhohacks/face-api.js).
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let loadPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  })();
  return loadPromise;
}

export { faceapi };

/**
 * Compute a 128-d face descriptor from a video/image element.
 * Returns null if no clear face is detected.
 */
export async function computeDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
}

/**
 * Detect ALL faces in a frame and return their descriptors + bounding boxes.
 */
export async function computeAllDescriptors(input: HTMLVideoElement | HTMLImageElement) {
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return detections;
}

/** Euclidean distance between two descriptors. <0.5 = strong match, <0.6 = ok match. */
export function descriptorDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export const FACE_MATCH_THRESHOLD = 0.55;
