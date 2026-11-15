"""Independent reference from a large, official IRSA cutout; no synthetic runtime data."""
from pathlib import Path
import json,hashlib
import numpy as np
import sep
from astropy.io import fits
from astropy.wcs import WCS
from astropy.coordinates import SkyCoord,SkyOffsetFrame
import astropy.units as u
root=Path(__file__).resolve().parents[2]
path=root/'tests/fixtures/spherex/wide-epoch.fits'
with fits.open(path) as hdus:
    data=np.array(hdus[0].data,dtype=np.float32); wcs=WCS(hdus[0].header).celestial
mask=~np.isfinite(data)|(data<=-1e30);data[mask]=0
bkg=sep.Background(data,mask=mask,bw=32,bh=32,fw=3,fh=3)
objects=sep.extract(data-bkg.back(),5,err=bkg.rms(),mask=mask,minarea=5,filter_type='conv',deblend_cont=1.0,clean=True,clean_param=1.0)
origin=SkyCoord(60.8109955*u.deg,51.3404038*u.deg)
records=[]
for obj in objects:
    x,y=float(obj['x']),float(obj['y']);ra,dec=wcs.all_pix2world([[x,y]],0)[0]
    offset=SkyCoord(ra*u.deg,dec*u.deg).transform_to(SkyOffsetFrame(origin=origin)).cartesian
    if max(abs(float(offset.y/offset.x)),abs(float(offset.z/offset.x)))>np.tan(np.deg2rad(.5)):continue
    records.append(dict(x=x,y=y,a=float(obj['a']),b=float(obj['b']),peak=float(obj['peak']),npix=int(obj['npix']),flags=int(obj['flag']),ra=float(ra),dec=float(dec)))
count=len(records)
if count>500:records=sorted(records,key=lambda r:-r['peak'])[:500]
record=dict(sha256=hashlib.sha256(path.read_bytes()).hexdigest(),shape=list(data.shape),background=bkg.globalback,noise=bkg.globalrms,total=len(objects),inRegion=count,detections=records)
(path.parent/'wide-sep-reference.json').write_text(json.dumps(record,indent=2,allow_nan=False)+'\n',encoding='utf8')
print(json.dumps(dict(shape=record['shape'],total=record['total'],in_region=len(records))))
