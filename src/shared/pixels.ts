import type { ObjectClass, StudyObject } from './study';
import type { FITSFrame, SkyRegion } from './contracts';
export interface SourceDetection {
  id: string;
  longitude: number;
  latitude: number;
  x: number;
  y: number;
  a: number;
  b: number;
  theta: number;
  fwhmArcsec: number;
  pixelScaleArcsec: number;
  peak: number;
  area: number;
  flags: number;
  apertureMean?: number;
  apertureError?: number;
  apertureFlags: number;
  association: 'none' | 'candidate' | 'ambiguous';
  candidates: readonly {
    id: string;
    name: string;
    provider: string;
    category: ObjectClass;
    distanceArcsec: number;
    probability?: number;
  }[];
  category: ObjectClass;
}
export interface DetectedExposure {
  inputUrl?: string;
  frameId: string;
  dateUtc: string;
  mjd: number;
  bunit: string;
  background: number;
  noise: number;
  coverage: number;
  truncated: boolean;
  /** Detections in the ROI before applying the display/export result cap. */
  detectedCount?: number;
  detections: readonly SourceDetection[];
}
export interface DetectionTrack {
  id: string;
  measurements: readonly { frameId: string; detectionId: string }[];
}
export interface PixelStudy {
  dataset?: 'ngc1491-example';
  catalogQueriedAt?: string;
  method: 'SEP 1.4.1';
  region: SkyRegion;
  frames: readonly DetectedExposure[];
  tracks: readonly DetectionTrack[];
  failures: readonly { frameId: string; message: string }[];
  omittedFrames: number;
  parameters: {
    threshold: number;
    minArea: number;
    associationRadiusArcsec: number;
    trackingMarginArcsec: number;
  };
  seconds: number;
}
export interface PixelStudyRequest {
  dataset?: 'ngc1491-example';
  catalogQueriedAt?: string;
  frames: readonly FITSFrame[];
  activeFrameId: string;
  region: SkyRegion;
  catalog: readonly StudyObject[];
  threshold: number;
}
export interface PixelProgress {
  completed: number;
  total: number;
  message: string;
}
export function separationArcsec(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const r = Math.PI / 180,
    d = (b[1] - a[1]) * r,
    l = (b[0] - a[0]) * r;
  const s = Math.sin(d / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(l / 2) ** 2;
  return (Math.asin(Math.sqrt(Math.max(0, Math.min(1, s)))) / r) * 7200;
}
