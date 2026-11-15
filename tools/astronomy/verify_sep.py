"""Independent SEP Python + Astropy reference for the browser's SEP WASM adapter."""
from pathlib import Path
import hashlib,json
import numpy as np
import sep
from astropy.io import fits
from astropy.wcs import WCS

root=Path(__file__).resolve().parents[2]
records=[]
for index in range(3):
    path=root/f'tests/fixtures/spherex/epoch-{index}.fits'
    with fits.open(path) as hdus:
        data=np.array(hdus[0].data,dtype=np.float32)
        wcs=WCS(hdus[0].header).celestial
    mask=~np.isfinite(data)|(data<=-1e30)
    data[mask]=0
    bkg=sep.Background(data,mask=mask,bw=min(32,data.shape[1]),bh=min(32,data.shape[0]),fw=3,fh=3)
    residual=data-bkg.back()
    objects=sep.extract(residual,5,err=bkg.rms(),mask=mask,minarea=5,filter_type='conv',deblend_nthresh=32,deblend_cont=1.0,clean=True,clean_param=1.0)
    values=[]
    for obj in objects:
        x,y=float(obj['x']),float(obj['y'])
        ra,dec=wcs.all_pix2world([[x,y]],0)[0]
        total,error,flag=sep.sum_circle(residual,np.array([x]),np.array([y]),2.5,err=bkg.rms(),mask=mask,subpix=5)
        area=sep.sum_circle(np.ones(data.shape,dtype=np.float32),np.array([x]),np.array([y]),2.5,subpix=5)[0][0]
        values.append(dict(x=x,y=y,a=float(obj['a']),b=float(obj['b']),peak=float(obj['peak']),npix=int(obj['npix']),flags=int(obj['flag']),ra=float(ra),dec=float(dec),mean=float(total[0]/area),error=float(error[0]/area),apertureFlags=int(flag[0])))
    records.append(dict(file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),background=bkg.globalback,noise=bkg.globalrms,objects=values))
output=dict(sep=sep.__version__,parameters=dict(threshold=5,minarea=5,mesh=32,filter_type='conv',aperture=2.5,subpix=5),exposures=records)
dest=root/'tests/fixtures/spherex/sep-reference.json'
dest.write_text(json.dumps(output,indent=2,allow_nan=False)+'\n',encoding='utf8')
print(json.dumps({r['file']:len(r['objects'])for r in records}))
