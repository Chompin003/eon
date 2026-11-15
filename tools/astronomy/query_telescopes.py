"""Public Hubble/JWST metadata via Astroquery/MAST. No image downloads or login."""
import argparse
import json
import math
from pathlib import Path

import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from astroquery.mast import Observations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ra', type=float, default=24.173958)
    parser.add_argument('--dec', type=float, default=15.783667)
    parser.add_argument('--radius', type=float, default=0.05, help='Search radius in degrees (0..1).')
    parser.add_argument('--telescope', choices=['Hubble', 'Webb', 'both'], default='both')
    parser.add_argument('--limit', type=int, default=25, help='First-page limit (1..100).')
    parser.add_argument('--output', type=Path, default=Path('data-cache/telescope-observations.json'))
    args = parser.parse_args()
    if not (math.isfinite(args.ra) and 0 <= args.ra < 360 and math.isfinite(args.dec) and -90 <= args.dec <= 90):
        parser.error('RA must be 0..360 and Dec -90..90 degrees.')
    if not (0 < args.radius <= 1 and 1 <= args.limit <= 100):
        parser.error('Radius must be >0 and <=1 degree; limit must be 1..100.')
    missions = ['HST', 'JWST'] if args.telescope == 'both' else ['HST' if args.telescope == 'Hubble' else 'JWST']
    Observations.TIMEOUT = 30
    rows = Observations.query_criteria(
        coordinates=SkyCoord(args.ra * u.deg, args.dec * u.deg, frame='icrs'),
        radius=args.radius * u.deg, obs_collection=missions, dataproduct_type='image',
        dataRights='PUBLIC', calib_level=[2, 3], pagesize=args.limit, page=1,
    )
    observations = []
    for row in rows:
        start = float(row['t_min'])
        observations.append({
            'obsid': str(row['obsid']), 'mission': str(row['obs_collection']),
            'target': str(row['target_name']), 'instrument': str(row['instrument_name']),
            'filters': str(row['filters']), 'ra': float(row['s_ra']), 'dec': float(row['s_dec']),
            'start_utc': Time(start, format='mjd', scale='utc').isot if math.isfinite(start) else None,
            'data_uri': str(row['dataURL']), 'calibration_level': int(row['calib_level']),
        })
    manifest = {'service': 'Astroquery/MAST', 'query': {'ra': args.ra, 'dec': args.dec, 'radius_deg': args.radius, 'missions': missions},
                'page': 1, 'page_size': args.limit, 'count': len(observations),
                'note': 'First page only. Coverage of these observations is not the full coverage of ESA preview mosaics.',
                'observations': observations}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'file': str(args.output), 'count': len(observations), 'missions': sorted({row['mission'] for row in observations})}))


if __name__ == '__main__':
    main()
