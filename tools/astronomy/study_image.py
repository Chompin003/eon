"""Detect point-source candidates in a scientific FITS and compare a real Gaia cone.

This is a local, reproducible feasibility tool, not a trained SPHEREx classifier.
No image/catalog data is fabricated. Output lives outside Git in data-cache.
"""
import argparse
import json
import time
from pathlib import Path

import astropy.units as u
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.io.votable import parse_single_table
from astropy.stats import sigma_clipped_stats
from astropy.wcs import WCS
from photutils.detection import DAOStarFinder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fits', required=True, type=Path)
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--fwhm', type=float, default=1.5)
    parser.add_argument('--sigma', type=float, default=5)
    parser.add_argument('--output', type=Path, default=Path('data-cache/image-study.json'))
    args = parser.parse_args()
    if not 0.5 <= args.fwhm <= 10 or not 3 <= args.sigma <= 20:
        parser.error('Use FWHM 0.5–10 pixels and threshold 3–20 sigma.')
    started = time.perf_counter()
    with fits.open(args.fits) as hdus:
        image = next(h for h in hdus if h.data is not None and h.data.ndim == 2)
        pixels = np.array(image.data, dtype=float)
        wcs = WCS(image.header).celestial
    if not np.isfinite(pixels).any():
        raise ValueError('FITS has no finite pixels.')
    _, background, noise = sigma_clipped_stats(pixels, sigma=3)
    if not np.isfinite(noise) or noise <= 0:
        raise ValueError('Background noise could not be estimated.')
    mask = ~np.isfinite(pixels)
    found = DAOStarFinder(threshold=args.sigma * noise, fwhm=args.fwhm,
                          exclude_border=True)(np.where(mask, 0, pixels-background), mask=mask)
    candidates = []
    catalog = parse_single_table(args.catalog).to_table() if args.catalog else None
    cat_sky = SkyCoord(catalog['ra'], catalog['dec'], unit='deg') if catalog is not None else None
    for row in ([] if found is None else found):
        x, y = float(row['x_centroid']), float(row['y_centroid'])
        position = wcs.pixel_to_world(x, y)
        candidate = dict(id=int(row['id']), x=x, y=y, ra=float(position.ra.deg),
                         dec=float(position.dec.deg), classification='unclassified',
                         sharpness=float(row['sharpness']), roundness=float(row['roundness1']))
        if cat_sky is not None:
            # Native-pixel radius is an exploratory association tolerance, not
            # a validated uncertainty model or proof of source identity.
            indices = np.where(position.separation(cat_sky) < 6.15*u.arcsec)[0]
            candidate['gaia_candidates_within_6_15_arcsec'] = [
                dict(source_id=str(catalog['source_id'][i]),
                     separation_arcsec=float(position.separation(cat_sky[i]).arcsec))
                for i in indices]
            candidate['association'] = 'ambiguous' if len(indices)>1 else 'candidate' if len(indices)==1 else 'none'
        candidates.append(candidate)
    report = dict(method='Photutils DAOStarFinder; original FITS WCS/SIP via Astropy',
                  fits=str(args.fits), catalog=str(args.catalog) if args.catalog else None,
                  shape=list(pixels.shape), fwhm_pixels=args.fwhm,
                  threshold_sigma=args.sigma, background=float(background),
                  clipped_noise=float(noise), detections=len(candidates), candidates=candidates,
                  seconds=time.perf_counter()-started,
                  limitations=['Point-source candidates only; no completeness/precision claim.',
                               'Diffuse emission, undersampling and blends can defeat the finder.',
                               'Gaia positions are at catalog epoch; associations are exploratory.',
                               'No new machine-learning model was trained.'])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf8')
    lo, hi = np.nanpercentile(pixels, [1, 99.5])
    visual = np.arcsinh(10*np.clip((pixels-lo)/max(hi-lo, 1e-20), 0, 1))
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.imshow(visual, origin='lower', cmap='gray', interpolation='nearest')
    for c in candidates:
        ax.plot(c['x'], c['y'], '+', color='#58bfff', markersize=12)
        ax.annotate(str(c['id']), (c['x']+1, c['y']+1), color='#58bfff', fontsize=8)
    ax.set_title(f"Photutils: {len(candidates)} point-source candidates · {args.sigma:g}σ")
    ax.set_xlabel('Original IMAGE pixel x'); ax.set_ylabel('Original IMAGE pixel y')
    fig.tight_layout(); fig.savefig(args.output.with_suffix('.png'), dpi=140); plt.close(fig)
    print(json.dumps({k: report[k] for k in ['method','detections','seconds']}))


if __name__ == '__main__':
    main()
