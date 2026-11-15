"""Independent Astropy/WCSLIB + SciPy reference for the display-only region grid."""
import json
import math
from pathlib import Path
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from scipy.ndimage import map_coordinates

root = Path(__file__).resolve().parents[2]
region = dict(longitude=60.8109955, latitude=51.3404038, sizeDeg=0.1)
size = math.ceil(region['sizeDeg'] * 3600 / 6.15)
scale = 2 * math.tan(math.radians(region['sizeDeg']) / 2) * 180 / math.pi / size
target = WCS(naxis=2)
target.wcs.ctype = ['RA---TAN', 'DEC--TAN']
target.wcs.crpix = [(size+1)/2, (size+1)/2]
target.wcs.crval = [region['longitude'], region['latitude']]
target.wcs.cd = np.array([[-scale, 0], [0, scale]])
y, x = np.indices((size, size), dtype=float)
ra, dec = target.all_pix2world(x, size-1-y, 0)
records = []
for filename in ['epoch-0.fits', 'epoch-1.fits', 'epoch-2.fits']:
    with fits.open(root / 'tests/fixtures/spherex' / filename) as hdul:
        image = hdul[0]
        source = WCS(image.header, naxis=2)
        px, py = source.all_world2pix(ra, dec, 0, tolerance=1e-10, maxiter=100)
        values = map_coordinates(image.data, [py, px], order=1, mode='constant', cval=np.nan, prefilter=False)
        samples = []
        for cx, cy in [(0,0),(size-1,0),(0,size-1),(size-1,size-1),(size//2,size//2),(12,34),(43,19),(20,20),(35,42)]:
            value = float(values[cy,cx])
            samples.append(dict(target=[cx,cy], world=[float(ra[cy,cx]),float(dec[cy,cx])],
                source=[float(px[cy,cx]),float(py[cy,cx])], flux=value if math.isfinite(value) else None))
        records.append(dict(fixture=filename, samples=samples, validPixels=int(np.isfinite(values).sum())))
result = dict(reference='Astropy/WCSLIB all_world2pix + SciPy map_coordinates(order=1)', region=region, size=size, scaleDeg=scale, exposures=records)
output = root / 'tests/fixtures/spherex/region-reference.json'
output.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(output)
