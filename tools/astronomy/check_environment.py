"""Offline environment check. No archive requests, credentials, or real observations."""

from importlib import import_module
from importlib.metadata import version
from io import BytesIO

import matplotlib

matplotlib.use("Agg")

import astropy.units as u
import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.visualization import ImageNormalize, PercentileInterval, AsinhStretch
from astroquery.ipac.irsa import Irsa
from matplotlib import pyplot as plt
from PIL import Image
from scipy.ndimage import gaussian_filter


def main():
    # An explicitly synthetic small image verifies the FITS/PNG stack offline.
    pixels = gaussian_filter(np.eye(16, dtype=np.float32), sigma=0.7)
    fits_buffer = BytesIO()
    fits.PrimaryHDU(pixels).writeto(fits_buffer)
    fits_buffer.seek(0)
    with fits.open(fits_buffer) as hdus:
        recovered = np.array(hdus[0].data, copy=True)
    assert np.allclose(pixels, recovered)

    png_buffer = BytesIO()
    normalization = ImageNormalize(recovered, interval=PercentileInterval(99), stretch=AsinhStretch())
    plt.imsave(png_buffer, normalization(recovered), format="png", cmap="gray")
    png_buffer.seek(0)
    with Image.open(png_buffer) as png:
        assert png.size == (16, 16)
        png.verify()

    position = SkyCoord("08h55m10.831s", "-07d14m42.53s", frame="fk5", equinox="J2000")
    assert 0 <= position.ra.to_value(u.deg) < 360
    assert position.dec.to_value(u.deg) < 0
    assert callable(Irsa.query_region)

    for module in ("pyvo", "mocpy", "astropy_healpix", "boto3", "regions"):
        import_module(module)

    for package in ("astroquery", "astropy", "numpy", "scipy", "matplotlib", "Pillow", "pyvo", "mocpy", "astropy-healpix", "boto3", "regions"):
        print(f"{package} {version(package)}")
    print("OK: imports, J2000, synthetic FITS round-trip and in-memory PNG. No data downloaded.")


if __name__ == "__main__":
    main()
