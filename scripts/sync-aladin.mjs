import { copyFile, mkdir } from 'node:fs/promises';

// Ship the library unmodified as a replaceable module, including its LGPL/GPL texts.
await mkdir('public/vendor/aladin', { recursive: true });
await copyFile('node_modules/aladin-lite/dist/aladin.js', 'public/vendor/aladin/aladin.js');
for (const name of ['LICENSE', 'COPYING', 'COPYING.LESSER']) {
  await copyFile(`node_modules/aladin-lite/${name}`, `public/vendor/aladin/${name}.txt`);
}
