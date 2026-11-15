/** Aladin 3.8.2 maps cube channels linearly in frequency, while its
 * setSliceNumber helper interpolates wavelength and ignores firstframe.
 * Select the center of the desired FILE index explicitly through its public
 * frequency API. Actual channel wavelengths are read separately from IRSA.
 * See upstream src/core/src/renderable/hips/d3/mod.rs (Cube tile requests).
 */
export function cubeFileFrequency(
  frame: number,
  firstFrame: number,
  depth: number,
  emMin: number,
  emMax: number,
): number {
  const low = 299792458 / emMax;
  const high = 299792458 / emMin;
  return low + ((frame + firstFrame + 0.5) / depth) * (high - low);
}
