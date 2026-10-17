'use client';

import { db } from '@/lib/db';
import { applySyncedCategories, applySyncedPreferences, readSyncedCategories, readSyncedPreferences } from './preferences';
import type { DaymoBackup, LocalSyncSnapshot } from './types';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateBackup(value: unknown): DaymoBackup {
  if (!value || typeof value !== 'object') throw new Error('백업 파일 형식이 올바르지 않습니다.');
  const backup = value as DaymoBackup;
  if (backup.format !== 'daymo-backup' || backup.version !== 1 || !backup.data) throw new Error('지원하지 않는 Daymo 백업입니다.');
  for (const key of ['calendars', 'tasks', 'taskRanges', 'shiftTypes', 'shiftAssignments'] as const) {
    if (!Array.isArray(backup.data[key])) throw new Error(`백업의 ${key} 데이터가 올바르지 않습니다.`);
  }
  return backup;
}

export async function createLocalBackup(reason: string, userId?: string): Promise<{ backup: DaymoBackup; checksum: string }> {
  const createdAt = new Date().toISOString();
  const backup: DaymoBackup = {
    format: 'daymo-backup', version: 1, createdAt, databaseKey: db.getDatabaseKey(), userId,
    data: await db.exportSyncSnapshot(), categories: readSyncedCategories(createdAt), preferences: readSyncedPreferences(),
  };
  const checksum = await sha256(JSON.stringify(backup));
  backup.checksum = checksum;
  const payload = JSON.stringify(backup);
  await db.saveLocalBackup({ id: crypto.randomUUID(), createdAt, reason, checksum, payload });
  return { backup, checksum };
}

function bool(value: unknown) { return value ? 1 : 0; }

export async function restoreLocalBackup(input: unknown): Promise<void> {
  const backup = validateBackup(input);
  if (backup.checksum) {
    const { checksum, ...content } = backup;
    if (await sha256(JSON.stringify(content)) !== checksum) throw new Error('백업 파일 무결성 검증에 실패했습니다.');
  }
  await createLocalBackup('before-restore', backup.userId);
  const data: LocalSyncSnapshot = backup.data;
  const restoredAt = new Date().toISOString();
  const statements: { sql: string; params?: unknown[] }[] = [
    { sql: 'DELETE FROM task_ranges' }, { sql: 'DELETE FROM shift_assignments' },
    { sql: 'DELETE FROM tasks' }, { sql: 'DELETE FROM shift_types' }, { sql: 'DELETE FROM calendars' },
  ];
  for (const row of data.calendars) statements.push({ sql: 'INSERT INTO calendars(id,title,enabled,kind,readOnly,updatedAt) VALUES(?,?,?,?,?,?)', params: [row.id,row.title,bool(row.enabled),row.kind,bool(row.readOnly),restoredAt] });
  for (const row of data.shiftTypes) statements.push({ sql: 'INSERT INTO shift_types(id,code,name,startTime,endTime,crossesMidnight,isOff,enabled,sortOrder,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)', params: [row.id,row.code,row.name,row.startTime,row.endTime,bool(row.crossesMidnight),bool(row.isOff),bool(row.enabled),row.sortOrder,restoredAt] });
  for (const row of data.tasks) statements.push({ sql: `INSERT INTO tasks(id,title,description,location,deadline,estimatedMinutes,priority,stage,checked,completedAt,start,end,allDay,isEvent,hiddenOnCalendar,linkedTo,parentId,subTasks,createdAt,updatedAt,calendarId,sortOrder,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, params: [row.id,row.title,row.description,row.location,row.deadline,row.estimatedMinutes,row.priority,row.stage,bool(row.checked),row.completedAt,row.start,row.end,bool(row.allDay),bool(row.isEvent),bool(row.hiddenOnCalendar),row.linkedTo,row.parentId,row.subTasks,row.createdAt,restoredAt,row.calendarId,row.sortOrder,row.category] });
  for (const row of data.taskRanges) statements.push({ sql: 'INSERT INTO task_ranges(id,taskId,start,end,allDay,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', params: [row.id,row.taskId,row.start,row.end,bool(row.allDay),row.createdAt,restoredAt] });
  for (const row of data.shiftAssignments) statements.push({ sql: 'INSERT INTO shift_assignments(id,date,shiftTypeId,createdAt,updatedAt) VALUES(?,?,?,?,?)', params: [row.id,row.date,row.shiftTypeId,row.createdAt,restoredAt] });
  await db.runSyncStatements(statements, false);
  applySyncedCategories((backup.categories || []).map((category) => ({ ...category, updatedAt: restoredAt })));
  applySyncedPreferences(backup.preferences || {});
  localStorage.setItem('daymo:preferences-updated-at', restoredAt);
}

export async function mergeLocalBackup(input: unknown): Promise<void> {
  const backup = validateBackup(input);
  const statements: { sql: string; params?: unknown[] }[] = [];
  for (const row of backup.data.calendars) statements.push({ sql: `INSERT INTO calendars(id,title,enabled,kind,readOnly,updatedAt) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,enabled=excluded.enabled,kind=excluded.kind,readOnly=excluded.readOnly,updatedAt=excluded.updatedAt WHERE COALESCE(excluded.updatedAt,'') > COALESCE(calendars.updatedAt,'')`, params: [row.id,row.title,bool(row.enabled),row.kind,bool(row.readOnly),row.updatedAt] });
  for (const row of backup.data.shiftTypes) statements.push({ sql: `INSERT INTO shift_types(id,code,name,startTime,endTime,crossesMidnight,isOff,enabled,sortOrder,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,startTime=excluded.startTime,endTime=excluded.endTime,crossesMidnight=excluded.crossesMidnight,isOff=excluded.isOff,enabled=excluded.enabled,sortOrder=excluded.sortOrder,updatedAt=excluded.updatedAt WHERE COALESCE(excluded.updatedAt,'') > COALESCE(shift_types.updatedAt,'')`, params: [row.id,row.code,row.name,row.startTime,row.endTime,bool(row.crossesMidnight),bool(row.isOff),bool(row.enabled),row.sortOrder,row.updatedAt] });
  for (const row of backup.data.tasks) statements.push({ sql: `INSERT INTO tasks(id,title,description,location,deadline,estimatedMinutes,priority,stage,checked,completedAt,start,end,allDay,isEvent,hiddenOnCalendar,linkedTo,parentId,subTasks,createdAt,updatedAt,calendarId,sortOrder,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,location=excluded.location,deadline=excluded.deadline,estimatedMinutes=excluded.estimatedMinutes,priority=excluded.priority,stage=excluded.stage,checked=excluded.checked,completedAt=excluded.completedAt,start=excluded.start,end=excluded.end,allDay=excluded.allDay,isEvent=excluded.isEvent,hiddenOnCalendar=excluded.hiddenOnCalendar,linkedTo=excluded.linkedTo,parentId=excluded.parentId,subTasks=excluded.subTasks,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt,calendarId=excluded.calendarId,sortOrder=excluded.sortOrder,category=excluded.category WHERE excluded.updatedAt > tasks.updatedAt`, params: [row.id,row.title,row.description,row.location,row.deadline,row.estimatedMinutes,row.priority,row.stage,bool(row.checked),row.completedAt,row.start,row.end,bool(row.allDay),bool(row.isEvent),bool(row.hiddenOnCalendar),row.linkedTo,row.parentId,row.subTasks,row.createdAt,row.updatedAt,row.calendarId,row.sortOrder,row.category] });
  for (const row of backup.data.taskRanges) statements.push({ sql: `INSERT INTO task_ranges(id,taskId,start,end,allDay,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET taskId=excluded.taskId,start=excluded.start,end=excluded.end,allDay=excluded.allDay,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt WHERE excluded.updatedAt > task_ranges.updatedAt`, params: [row.id,row.taskId,row.start,row.end,bool(row.allDay),row.createdAt,row.updatedAt] });
  for (const row of backup.data.shiftAssignments) statements.push({ sql: `INSERT INTO shift_assignments(id,date,shiftTypeId,createdAt,updatedAt) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,shiftTypeId=excluded.shiftTypeId,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt WHERE excluded.updatedAt > shift_assignments.updatedAt`, params: [row.id,row.date,row.shiftTypeId,row.createdAt,row.updatedAt] });
  await db.runSyncStatements(statements, false);
}

export function downloadBackup(backup: DaymoBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `daymo-backup-${backup.createdAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
