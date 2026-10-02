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
  const { CALENDAR_THEMES, getCalendarTheme } = load('src/lib/theme/themes.ts');
  const { eventColors, contrastText, contrastRatio } = load('src/lib/theme/contrast.ts');
  assert.equal(normalizeCategory(undefined), 'other');
  assert.equal(normalizeCategory('invalid'), 'other');
  assert.equal(getCalendarTheme('bad').id, 'soft-pastel');
  assert.equal(CALENDAR_THEMES.length, 3);
  for (const theme of CALENDAR_THEMES) for (const category of EVENT_CATEGORIES) {
    for (const dark of [false,true]) {
      const color = eventColors(theme.categoryColors[category],dark);
      assert.ok(contrastRatio(color.background,color.text) >= 4.5, `${theme.id}/${category}/${dark}`);
    }
  }
  assert.equal(contrastText('#000000'), '#ffffff');
  assert.equal(contrastText('#ffffff'), '#000000');
  const { format } = load('src/lib/i18n/date.ts');
  const { timeBadge } = load('src/lib/format.ts');
  assert.equal(format(new Date(2026,8,27),'MMM d'), '9월 27일');
  assert.equal(format(new Date(2026,8,27),'MMMM yyyy'), '2026년 9월');
  const task = {id:'legacy',title:'기존 일정',stage:'todo',checked:false,calendarId:'local',createdAt:'2026-09-27',updatedAt:'2026-09-27',start:new Date(2026,8,30,18,30).toISOString(),end:new Date(2026,9,1,6,30).toISOString()};
  assert.match(timeBadge(task,{fullDate:true}), /9월 30일.*10월 1일/);
  const calls=[];
  const db = { listTasks:async()=>[{...task,ranges:[{start:task.start,end:task.end}]}], createTask:async(input)=>{calls.push(input);return input;}, updateTask:async(id,patch)=>{calls.push(patch);return patch;} };
  const { localCalendarProvider: provider } = load('src/lib/calendar/LocalCalendarProvider.ts', {'@/lib/db':{db}});
  await provider.createTask(task); assert.equal(calls[0].category,'other');
  await provider.updateEvent('legacy',{category:'research'});assert.deepEqual(calls[1],{category:'research'});
  assert.equal((await provider.getEvents(new Date(2026,9,1).toISOString(),new Date(2026,9,2).toISOString())).length,1);
  assert.equal((await provider.getEvents(task.end,new Date(2026,9,2).toISOString())).length,0);
  const { buildCSV, buildICS } = load('src/lib/export.ts');
  assert.match(buildCSV([{...task,category:'research'}]), /calendarId,category/);
  assert.match(buildCSV([{...task,category:'research'}]), /local,research/);
  assert.match(buildICS({events:[{...task,category:'research'}],todos:[]}), /CATEGORIES:research/);
  // Execute the actual worker migration SQL in SQLite WASM, including old records/ranges.
  const sqlite3 = await (await import('@sqlite.org/sqlite-wasm')).default();
  const sqlDB = new sqlite3.oo1.DB(':memory:');
  const workerSource = fs.readFileSync(path.join(root,'workers/db.worker.ts'),'utf8');
  const schema = workerSource.match(/function migrateSQL\(\): string \{\s*return `([\s\S]*?)`;/)[1];
  sqlDB.exec(schema);
  sqlDB.exec({sql:'INSERT INTO tasks(id,title,stage,checked,createdAt,updatedAt,calendarId) VALUES (?,?,?,?,?,?,?)',bind:['legacy','기존 일정','todo',0,'2026-09-27','2026-09-27','local']});
  sqlDB.exec({sql:'INSERT INTO task_ranges(id,taskId,start,end,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',bind:['range','legacy',task.start,task.end,'2026-09-27','2026-09-27']});
  const migration = workerSource.match(/dbi\.exec\("(ALTER TABLE tasks ADD COLUMN category[^\"]+)"\)/)[1];
  for(let i=0;i<2;i++) {
    const columns=sqlDB.exec({sql:'PRAGMA table_info(tasks)',returnValue:'resultRows',rowMode:'object'});
    if(!columns.some(c=>c.name==='category'))sqlDB.exec(migration);
  }
  assert.deepEqual(sqlDB.exec({sql:'SELECT title, category FROM tasks',returnValue:'resultRows',rowMode:'object'}).map(row => ({...row})),[{title:'기존 일정',category:'other'}]);
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM task_ranges',returnValue:'resultRows',rowMode:'object'})[0].n,1);
  sqlDB.close();
  console.log('PASS: 48 theme contrast cases, category defaults, Korean dates, overnight range/provider, CSV/ICS, additive migration and repeat migration retaining legacy tasks/ranges.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
