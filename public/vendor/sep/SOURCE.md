# SEP 1.4.1 — corresponding source and rebuilding

SEP authors: Kyle Barbary and contributors; extraction algorithms include code derived from SExtractor by Emmanuel Bertin. Upstream: https://github.com/sep-developers/sep/tree/v1.4.1, commit `4c3acca6ce357d74b050cb46481af00c0bc96e32`.

The unmodified upstream C/H sources used for this build are in `vendor/sep/src/` of https://github.com/Chompin003/eon. The MIT adapter is `tools/astronomy/sep_bridge.c`; exact compilation arguments and exported functions are in `tools/astronomy/build_sep.py`. Install and activate Emscripten 4.0.23, then run:

```
python tools/astronomy/build_sep.py --emsdk PATH_TO_EMSDK
```

This produces the separately replaceable `sep.mjs` and `sep.wasm` modules in this directory. The application imposes no signature/integrity check or restriction on reverse engineering to debug modifications to this library. You may rebuild and replace these modules independently.

SEP is LGPL-3.0-or-later; included `LGPL_LICENSE.txt` and `COPYING.txt` provide LGPL/GPL terms. Upstream BSD and MIT notices are retained in `BSD_LICENSE.txt` and `MIT_LICENSE.txt`. Emscripten runtime notices are in `EMSCRIPTEN_LICENSE.txt`. Application code remains MIT. No SEP C sources were modified; background/extraction/aperture parameters are configured by the adapter. Deblending is disabled deliberately because unresolved emission groups must not be presented as separately identified objects.
