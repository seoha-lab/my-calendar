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
  const { getShiftInterval, addLocalDays, buildShiftPattern, shiftAssignmentToCalendarEvent } = load('src/lib/shifts/utils.ts');
  const d7 = {id:'shift-d7',code:'D7',name:'데이',startTime:'06:30',endTime:'18:30',crossesMidnight:false,isOff:false,enabled:true,sortOrder:10};
  const n7 = {id:'shift-n7',code:'N7',name:'나이트',startTime:'18:30',endTime:'06:30',crossesMidnight:true,isOff:false,enabled:true,sortOrder:20};
  const off = {id:'shift-off',code:'OFF',name:'오프',startTime:null,endTime:null,crossesMidnight:false,isOff:true,enabled:true,sortOrder:30};
  const d7Interval = getShiftInterval('2026-10-01', d7);
  assert.deepEqual([d7Interval.start.getFullYear(),d7Interval.start.getMonth()+1,d7Interval.start.getDate(),d7Interval.start.getHours(),d7Interval.start.getMinutes()],[2026,10,1,6,30]);
  assert.deepEqual([d7Interval.end.getFullYear(),d7Interval.end.getMonth()+1,d7Interval.end.getDate(),d7Interval.end.getHours(),d7Interval.end.getMinutes()],[2026,10,1,18,30]);
  const n7Interval = getShiftInterval('2026-10-01', n7);
  assert.deepEqual([n7Interval.start.getFullYear(),n7Interval.start.getMonth()+1,n7Interval.start.getDate(),n7Interval.start.getHours(),n7Interval.start.getMinutes()],[2026,10,1,18,30]);
  assert.deepEqual([n7Interval.end.getFullYear(),n7Interval.end.getMonth()+1,n7Interval.end.getDate(),n7Interval.end.getHours(),n7Interval.end.getMinutes()],[2026,10,2,6,30]);
  assert.equal(getShiftInterval('2026-10-01', off), null);
  assert.deepEqual([getShiftInterval('2026-10-31', n7).end.getMonth()+1,getShiftInterval('2026-10-31', n7).end.getDate()],[11,1]);
  assert.deepEqual([getShiftInterval('2026-12-31', n7).end.getFullYear(),getShiftInterval('2026-12-31', n7).end.getMonth()+1,getShiftInterval('2026-12-31', n7).end.getDate()],[2027,1,1]);
  assert.equal(addLocalDays('2024-02-28',1),'2024-02-29');
  assert.equal(addLocalDays('2024-02-28',2),'2024-03-01');
  assert.equal(addLocalDays('2025-02-28',1),'2025-03-01');
  assert.deepEqual(buildShiftPattern('2026-10-01',[d7.id,n7.id,n7.id,off.id],2),[
    {date:'2026-10-01',shiftTypeId:d7.id},{date:'2026-10-02',shiftTypeId:n7.id},{date:'2026-10-03',shiftTypeId:n7.id},{date:'2026-10-04',shiftTypeId:off.id},
    {date:'2026-10-05',shiftTypeId:d7.id},{date:'2026-10-06',shiftTypeId:n7.id},{date:'2026-10-07',shiftTypeId:n7.id},{date:'2026-10-08',shiftTypeId:off.id},
  ]);
  const assignment = {id:'assignment',date:'2026-10-01',shiftTypeId:n7.id,createdAt:'2026-09-30',updatedAt:'2026-09-30'};
  const shiftEvent = shiftAssignmentToCalendarEvent(assignment,n7);
  assert.equal(shiftEvent.extendedProps.category,'hospital');
  assert.equal(new Date(shiftEvent.end).getDate(),2);
  for (const theme of CALENDAR_THEMES) {
    assert.equal(eventColors(theme.categoryColors[shiftEvent.extendedProps.category]).accent,theme.categoryColors.hospital);
  }
  const { getShiftBusyIntervals, getCombinedBusyIntervals } = load('src/lib/scheduling/busyIntervals.ts');
  assert.equal(getShiftBusyIntervals([{...assignment,shiftTypeId:off.id}],[off]).length,0);
  assert.equal(getShiftBusyIntervals([assignment],[n7]).length,1);
  assert.equal(getCombinedBusyIntervals([task],[assignment],[n7]).length,2);
  const { intervalsOverlap, findConflicts, mergeBusyIntervals, clipBusyIntervals, calculateFreeTime } = load('src/lib/scheduling/intervals.ts');
  const busy = (id,start,end,source='task') => ({source,sourceId:id,title:id,start:new Date(start),end:new Date(end)});
  const ten = busy('a','2026-10-02T10:00:00+09:00','2026-10-02T11:00:00+09:00');
  assert.equal(intervalsOverlap(ten,busy('b','2026-10-02T10:30:00+09:00','2026-10-02T12:00:00+09:00')),true);
  assert.equal(intervalsOverlap(ten,busy('touch','2026-10-02T11:00:00+09:00','2026-10-02T12:00:00+09:00')),false);
  assert.equal(findConflicts(ten,[ten],{source:'task',sourceId:'a'}).hasConflict,false);
  const merged = mergeBusyIntervals([
    busy('a','2026-10-02T09:00:00+09:00','2026-10-02T11:00:00+09:00'),
    busy('b','2026-10-02T10:30:00+09:00','2026-10-02T12:00:00+09:00'),
    busy('c','2026-10-02T12:00:00+09:00','2026-10-02T13:00:00+09:00'),
  ]);
  assert.equal(merged.length,1); assert.deepEqual([merged[0].start.getHours(),merged[0].end.getHours()],[9,13]);
  const clipped = clipBusyIntervals([busy('wide','2026-10-02T06:00:00+09:00','2026-10-03T01:00:00+09:00')],{start:new Date(2026,9,2,7),end:new Date(2026,9,2,23)});
  assert.deepEqual([clipped[0].start.getHours(),clipped[0].end.getHours()],[7,23]);
  const caseA = calculateFreeTime({date:'2026-10-02',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:[
    busy('one','2026-10-02T09:00:00+09:00','2026-10-02T10:00:00+09:00'),
    busy('two','2026-10-02T14:00:00+09:00','2026-10-02T15:30:00+09:00'),
  ]});
  assert.deepEqual(caseA.free.map(item=>[item.start.getHours(),item.start.getMinutes(),item.end.getHours(),item.end.getMinutes()]),[[7,0,9,0],[10,0,14,0],[15,30,23,0]]);
  assert.equal(calculateFreeTime({date:'2026-10-02',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:[]}).totalFreeMinutes,960);
  assert.equal(calculateFreeTime({date:'2026-10-02',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:[busy('all','2026-10-02T00:00:00+09:00','2026-10-03T00:00:00+09:00')]}).free.length,0);
  const d7Free = calculateFreeTime({date:'2026-10-01',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:getShiftBusyIntervals([{...assignment,shiftTypeId:d7.id}],[d7])});
  assert.deepEqual(d7Free.free.map(item=>[item.start.getHours(),item.end.getHours(),item.end.getMinutes()]),[[18,23,0]]); assert.equal(d7Free.free[0].start.getMinutes(),30);
  const n7Busy = getShiftBusyIntervals([assignment],[n7]);
  const n7StartDay = calculateFreeTime({date:'2026-10-01',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:n7Busy});
  assert.deepEqual([n7StartDay.free[0].start.getHours(),n7StartDay.free[0].end.getHours(),n7StartDay.free[0].end.getMinutes()],[7,18,30]);
  const n7NextDay = calculateFreeTime({date:'2026-10-02',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:n7Busy});
  assert.equal(n7NextDay.totalFreeMinutes,960);
  assert.equal(calculateFreeTime({date:'2026-10-01',dayStart:'07:00',dayEnd:'23:00',minimumMinutes:30,busyIntervals:getShiftBusyIntervals([{...assignment,shiftTypeId:off.id}],[off])}).totalFreeMinutes,960);
  const boundary = calculateFreeTime({date:'2026-10-02',dayStart:'07:00',dayEnd:'08:00',minimumMinutes:30,busyIntervals:[busy('short','2026-10-02T07:30:00+09:00','2026-10-02T08:00:00+09:00')]});
  assert.equal(boundary.free.length,1); assert.equal(boundary.free[0].durationMinutes,30);
  const reference = new Date(2026,9,2,10,0);
  const { parseKoreanInput, parseKoreanDate, parseKoreanTime, localDateTimeToISO } = load('src/lib/nlp/index.ts');
  assert.equal(parseKoreanDate('오늘',reference).date,'2026-10-02');
  assert.equal(parseKoreanDate('내일',reference).date,'2026-10-03');
  assert.equal(parseKoreanDate('모레',reference).date,'2026-10-04');
  assert.equal(parseKoreanDate('금요일',reference).date,'2026-10-02');
  assert.equal(parseKoreanDate('이번주 월요일',reference).date,'2026-09-28');
  assert.equal(parseKoreanDate('다음주 화요일',reference).date,'2026-10-06');
  assert.equal(parseKoreanDate('10월 5일',reference).date,'2026-10-05');
  assert.equal(parseKoreanDate('10/5',reference).date,'2026-10-05');
  assert.equal(parseKoreanDate('2026년 10월 5일 월요일',reference).date,'2026-10-05');
  assert.deepEqual(parseKoreanTime('오전 9시 30분'),{startTime:'09:30',span:{start:0,end:9,text:'오전 9시 30분'},ambiguities:[]});
  assert.equal(parseKoreanTime('오후 3시').startTime,'15:00');
  assert.equal(parseKoreanTime('저녁 7시').startTime,'19:00');
  assert.equal(parseKoreanTime('밤 10시').startTime,'22:00');
  assert.equal(parseKoreanTime('15시 30분').startTime,'15:30');
  assert.equal(parseKoreanTime('정오').startTime,'12:00');
  assert.equal(parseKoreanTime('자정').startTime,'00:00');
  assert.deepEqual([parseKoreanTime('오후 3시부터 4시까지').startTime,parseKoreanTime('오후 3시부터 4시까지').endTime],['15:00','16:00']);
  assert.deepEqual([parseKoreanTime('15:00-16:00').startTime,parseKoreanTime('15:00-16:00').endTime],['15:00','16:00']);
  const meeting = parseKoreanInput('내일 오후 3시 학교에서 교수회의',reference);
  assert.deepEqual({kind:meeting.kind,title:meeting.title,date:meeting.date,startTime:meeting.startTime,location:meeting.location,category:meeting.category},{kind:'event',title:'교수회의',date:'2026-10-03',startTime:'15:00',location:'학교',category:'lecture'});
  assert.equal(parseKoreanInput('금요일 오전 9시 수영',reference).category,'exercise');
  assert.deepEqual(Object.fromEntries(Object.entries(parseKoreanInput('다음주 화요일 오후 2시 대학원 수업',reference)).filter(([key])=>['date','startTime','category','title'].includes(key))),{title:'대학원 수업',date:'2026-10-06',startTime:'14:00',category:'graduate'});
  assert.equal(parseKoreanInput('10월 5일 병원 교육',reference).category,'hospital');
  assert.deepEqual({kind:parseKoreanInput('내일 나이트',reference).kind,date:parseKoreanInput('내일 나이트',reference).date,shiftCode:parseKoreanInput('내일 나이트',reference).shiftCode},{kind:'shift',date:'2026-10-03',shiftCode:'N7'});
  assert.equal(parseKoreanInput('금요일 오프',reference).shiftCode,'OFF');
  assert.equal(parseKoreanInput('10월 8일 D7',reference).shiftCode,'D7');
  const quickAddD7 = parseKoreanInput('오늘 오전 9시 수영',new Date(2026,9,1,8));
  const quickStart = new Date(localDateTimeToISO(quickAddD7.date,quickAddD7.startTime));
  const quickEnd = new Date(localDateTimeToISO(quickAddD7.date,quickAddD7.endTime));
  assert.equal(findConflicts({start:quickStart,end:quickEnd},getShiftBusyIntervals([{...assignment,shiftTypeId:d7.id}],[d7])).hasConflict,true);
  const ambiguous = parseKoreanInput('내일 3시 회의',reference);
  assert.equal(ambiguous.startTime,undefined); assert.ok(ambiguous.ambiguities.some(item=>item.includes('오전인지 오후인지')));
  const failure = parseKoreanInput('회의',reference);
  assert.equal(failure.date,undefined); assert.equal(failure.startTime,undefined); assert.equal(failure.title,'회의');
  const localISO = localDateTimeToISO('2026-10-05','15:00');
  assert.deepEqual([new Date(localISO).getFullYear(),new Date(localISO).getMonth()+1,new Date(localISO).getDate(),new Date(localISO).getHours()],[2026,10,5,15]);
  const { parseQuickInput } = load('src/lib/nlp/englishParser.ts');
  const english = parseQuickInput('tomorrow 3pm meeting');
  assert.equal(english.task.title,'meeting'); assert.ok(english.task.start); assert.equal(english.task.allDay,false);
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
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM shift_types',returnValue:'resultRows',rowMode:'object'})[0].n,3);
  sqlDB.exec({sql:'INSERT INTO tasks(id,title,stage,checked,createdAt,updatedAt,calendarId) VALUES (?,?,?,?,?,?,?)',bind:['legacy','기존 일정','todo',0,'2026-09-27','2026-09-27','local']});
  sqlDB.exec({sql:'UPDATE tasks SET location = ? WHERE id = ?',bind:['학교','legacy']});
  sqlDB.exec({sql:'INSERT INTO task_ranges(id,taskId,start,end,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',bind:['range','legacy',task.start,task.end,'2026-09-27','2026-09-27']});
  const migration = workerSource.match(/dbi\.exec\("(ALTER TABLE tasks ADD COLUMN category[^\"]+)"\)/)[1];
  for(let i=0;i<2;i++) {
    const columns=sqlDB.exec({sql:'PRAGMA table_info(tasks)',returnValue:'resultRows',rowMode:'object'});
    if(!columns.some(c=>c.name==='category'))sqlDB.exec(migration);
  }
  assert.deepEqual(sqlDB.exec({sql:'SELECT title, category FROM tasks',returnValue:'resultRows',rowMode:'object'}).map(row => ({...row})),[{title:'기존 일정',category:'other'}]);
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM task_ranges',returnValue:'resultRows',rowMode:'object'})[0].n,1);
  sqlDB.exec({sql:'INSERT INTO shift_assignments(id,date,shiftTypeId,createdAt,updatedAt) VALUES (?,?,?,?,?)',bind:['assignment','2026-10-01',d7.id,'now','now']});
  sqlDB.exec({sql:`INSERT INTO shift_assignments(id,date,shiftTypeId,createdAt,updatedAt) VALUES (?,?,?,?,?)
    ON CONFLICT(date) DO UPDATE SET shiftTypeId = excluded.shiftTypeId, updatedAt = excluded.updatedAt`,bind:['replacement','2026-10-01',n7.id,'later','later']});
  assert.equal(sqlDB.exec({sql:'SELECT shiftTypeId FROM shift_assignments WHERE date = ?',bind:['2026-10-01'],returnValue:'resultRows',rowMode:'object'})[0].shiftTypeId,n7.id);
  sqlDB.exec(schema);
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM tasks',returnValue:'resultRows',rowMode:'object'})[0].n,1);
  assert.equal(sqlDB.exec({sql:'SELECT location FROM tasks WHERE id = ?',bind:['legacy'],returnValue:'resultRows',rowMode:'object'})[0].location,'학교');
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM task_ranges',returnValue:'resultRows',rowMode:'object'})[0].n,1);
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM shift_assignments',returnValue:'resultRows',rowMode:'object'})[0].n,1);
  sqlDB.exec({sql:'DELETE FROM shift_assignments WHERE date = ?',bind:['2026-10-01']});
  assert.equal(sqlDB.exec({sql:'SELECT COUNT(*) AS n FROM shift_assignments',returnValue:'resultRows',rowMode:'object'})[0].n,0);
  sqlDB.close();
  console.log('PASS: Korean NLP, interval conflicts/touching/self-exclusion, merge/clipping, D7/N7/OFF free time, previous-day N7, minimum duration, timezone, shifts and SQLite persistence.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
