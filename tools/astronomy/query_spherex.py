"""Query actual SPHEREx exposures with Astroquery and verify a cutout with Astropy.

Based on IRSA's public SPHEREx spectral-image / cutout notebooks.
This is a reproducible science verification tool, not the browser's runtime.
"""
import argparse
import io
import json
from pathlib import Path

import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from astroquery.ipac.irsa import Irsa
import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ra', type=float, default=60.8109955)
    parser.add_argument('--dec', type=float, default=51.3404038)
    parser.add_argument('--detector', type=int, choices=range(1, 7), default=4)
    parser.add_argument('--max-records', type=int, default=2000)
    parser.add_argument('--verify-first', action='store_true')
    parser.add_argument('--output', type=Path, default=Path('data-cache/astroquery-manifest.json'))
    args = parser.parse_args()
    coord = SkyCoord(args.ra * u.deg, args.dec * u.deg, frame='icrs')
    if not 0 <= args.ra < 360 or not -90 <= args.dec <= 90:
        parser.error('RA debe ser [0,360) y Dec [-90,90].')
    results = Irsa.query_sia(
        pos=(coord, 0.0000001 * u.deg),
        collection=['spherex_dr1', 'spherex_qr3', 'spherex_dr1_deep', 'spherex_qr3_deep'],
        maxrec=args.max_records,
    )
    records = []
    for row in results:
        if str(row['energy_bandpassname']) != f'SPHEREx-D{args.detector}':
            continue
        records.append({
            'id': str(row['obs_id']), 'url': str(row['access_url']),
            'mjd': float(row['t_min']), 'date_utc': Time(float(row['t_min']), format='mjd', scale='utc').isot,
            'detector': str(row['energy_bandpassname']), 'collection': str(row['obs_collection']),
        })
    records.sort(key=lambda row: row['mjd'])
    manifest = {'coordinate_frame': 'ICRS', 'ra_deg': args.ra, 'dec_deg': args.dec,
                'retrieved_utc': Time.now().isot, 'returned_rows': len(results),
                'max_records': args.max_records, 'exposures': records}
    print(f'IRSA: {len(results)} filas; D{args.detector}: {len(records)} exposiciones.')
    if records:
        print(f"Fechas UTC: {records[0]['date_utc']} a {records[-1]['date_utc']}")
    if args.verify_first and records:
        response = requests.get(records[0]['url'], params={'center': f'{args.ra},{args.dec}d', 'size': 0.1}, timeout=120)
        response.raise_for_status()
        with fits.open(io.BytesIO(response.content)) as hdul:
            image = hdul['IMAGE']
            wcs = WCS(image.header).celestial
            x, y = wcs.world_to_pixel(coord)
            roundtrip = wcs.pixel_to_world(x, y).separation(coord).arcsec
            height, width = image.data.shape
            if not (-0.5 <= x < width - 0.5 and -0.5 <= y < height - 0.5 and roundtrip < 0.001):
                raise RuntimeError('El recorte no contiene la posición solicitada o su WCS no coincide.')
            manifest['verification'] = {
                'shape': [height, width], 'unit': image.header.get('BUNIT'),
                'ctype': list(wcs.wcs.ctype), 'sip': wcs.sip is not None,
                'target_pixel_zero_based': [float(x), float(y)], 'roundtrip_arcsec': float(roundtrip),
            }
            print('WCS verificada:', manifest['verification'])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Manifiesto: {args.output}')


if __name__ == '__main__':
    main()
