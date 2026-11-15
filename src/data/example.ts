import type { Observation, FITSFrame } from '../shared';
import manifest from '../../public/examples/spherex/manifest.json';
export const exampleRegion = manifest.region;
export const exampleObservations: Observation[] = manifest.frames.map((f) => ({
  id: f.id,
  dateUtc: f.dateUtc,
  mjd: f.mjd,
  detector: 'SPHEREx-D4',
  url: f.originalUrl,
  collection: 'Ejemplo real guardado · IRSA DR1/QR3',
}));
export const exampleFrames: FITSFrame[] = manifest.frames.map((f) => ({
  kind: 'fits',
  id: f.id,
  title: manifest.label,
  dateUtc: f.dateUtc,
  center: { longitude: manifest.region.longitude, latitude: manifest.region.latitude },
  url: '/examples/spherex/' + f.file,
  dataset: 'ngc1491-example',
}));
