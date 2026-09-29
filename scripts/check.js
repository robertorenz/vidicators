'use strict';
// Syntax-checks every game script: `npm run check`.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'js');
let failed = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'pipe' });
    console.log('ok    js/' + f);
  } catch (e) {
    failed++;
    console.error('FAIL  js/' + f + '\n' + String(e.stderr));
  }
}
if (failed) { console.error(`${failed} file(s) failed`); process.exit(1); }
