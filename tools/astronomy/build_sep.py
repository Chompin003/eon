"""Rebuild the separately replaceable SEP 1.4.1 ES module with Emscripten 4.0.23."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--emsdk',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[2]
sdk=args.emsdk.resolve()
out=root/'public/vendor/sep'
out.mkdir(parents=True,exist_ok=True)
sources=['analyse','convolve','deblend','extract','lutz','aperture','background','util']
command=[sys.executable,str(sdk/'upstream/emscripten/emcc.py'),'-O3','-I'+str(root/'vendor/sep/src'),
         str(root/'tools/astronomy/sep_bridge.c'),*[str(root/f'vendor/sep/src/{n}.c')for n in sources],
         '-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,worker,node',
         '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=16777216','-sMAXIMUM_MEMORY=67108864',
         '-sEXPORTED_FUNCTIONS=["_malloc","_free","_eon_extract"]',
         '-sEXPORTED_RUNTIME_METHODS=["HEAPF32","HEAPU8","HEAPF64"]',
         '-o',str(out/'sep.mjs')]
env={**os.environ,'EM_CONFIG':str(sdk/'.emscripten'),'EMSDK':str(sdk)}
subprocess.run(command,env=env,check=True,cwd=root)
