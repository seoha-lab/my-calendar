process.env.TZ = 'Asia/Seoul';
// Uses the existing TypeScript dependency; no additional test runner needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file, mocks = {}) {
  file = path.resolve(root, file);
  if (cache.has(file) && !Object.keys(mocks).length) return cache.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) { const base = path.join(root, 'src', name.slice(2)); return load(fs.existsSync(base+'.ts') ? base+'.ts' : base+'/index.ts', mocks); }
    if (name.startsWith('.')) { const base = path.resolve(path.dirname(file), name); return load(fs.existsSync(base+'.ts') ? base+'.ts' : base+'/index.ts', mocks); }
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})', { filename:file })(req,mod,mod.exports);
  if (!Object.keys(mocks).length) cache.set(file, mod.exports);
  return mod.exports;
}
async function main() {
  const { EVENT_CATEGORIES, normalizeCategory } = load('src/lib/calendar/categories.ts');
  const { CALENDAR_THEMES, getCalendarTheme } = load('s���q�^