'use client';

import { db } from '@/lib/db';
import type { LocalSyncSnapshot, RemoteSyncBundle, SyncEntityType, SyncOutboxEntry } from './types';
import { shouldApplyRemote } from './merge';

type Statement = { sql: string; params?: unknown[] };
const bit = (input: unknown) => input ? 1 : 0;
const hhmm = (input: unknown) => typeof input === 'string' ? input.slice(0, 5) : input;

export function localEntityMap(snapshot: LocalSyncSnapshot): Record<Exclude<SyncEntityType, 'category'|'preferences'>, Map<string, Record<string, unknown>>> {
  return {
    calendar: new Map(snapshot.calendars.map((row) => [String(row.id), row])),
    task: new Map(snapshot.tasks.map((row) => [String(row.id), row])),
    task_range: new Map(snapshot.taskRanges.map((row) => [String(row.id), row])),
    shift_type: new Map(snapshot.shiftTypes.map((row) => [String(row.id), row])),
    shift_assignment: new Map(snapshot.shiftAssignments.map((row) => [String(row.id), row])),
  };
}

export async function enqueueEntireSnapshot(snapshot: LocalSyncSnapshot): Promise<void> {
  const now = new Date().toISOString();
  const statements: Statement[] = [];
  for (const [entityType, rows] of Object.entries(localEntityMap(snapshot))) {
    for (const [entityId, row] of rows) {
      const changedAt = String(row.updatedAt || row.createdAt || now);
      statements.push({ sql: `INSERT INTO sync_outbox(entityType,entityId,action,changedAt,operationId) VALUES(?,?,?,?,?) ON CONFLICT(entityType,entityId) DO NOTHING`, params: [entityType, entityId, 'upsert', changedAt, crypto.randomUUID()] });
    }
  }
  await db.runSyncStatements(statements, true);
}

function remoteRows(bundle: RemoteSyncBundle): [Exclude<SyncEntityType, 'category'|'preferences'>, Record<string, unknown>[]][] {
  return [
    ['calendar', bundle.calendars], ['shift_type', bundle.shiftTypes], ['task', bundle.tasks],
    ['task_range', bundle.taskRanges], ['shift_assignment', bundle.shiftAssignments],
  ];
}

function upsertStatement(type: Exclude<SyncEntityType, 'category'|'preferences'>, row: Record<string, unknown>): Statement {
  switch (type) {
    case 'calendar': return { sql: `INSERT INTO calendars(id,title,enabled,kind,readOnly,updatedAt) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,enabled=excluded.enabled,kind=excluded.kind,readOnly=excluded.readOnly,updatedAt=excluded.updatedAt`, params: [row.id,row.title,bit(row.enabled),row.kind,bit(row.read_only),row.updated_at] };
    case 'shift_type': return { sql: `INSERT INTO shift_types(id,code,name,startTime,endTime,crossesMidnight,isOff,enabled,sortOrder,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,startTime=excluded.startTime,endTime=excluded.endTime,crossesMidnight=excluded.crossesMidnight,isOff=excluded.isOff,enabled=excluded.enabled,sortOrder=excluded.sortOrder,updatedAt=excluded.updatedAt`, params: [row.id,row.code,row.name,hhmm(row.start_time),hhmm(row.end_time),bit(row.crosses_midnight),bit(row.is_off),bit(row.enabled),row.sort_order,row.updated_at] };
    case 'task': return { sql: `INSERT INTO tasks(id,title,description,location,deadline,estimatedMinutes,priority,stage,checked,completedAt,start,end,allDay,isEvent,hiddenOnCalendar,linkedTo,parentId,subTasks,createdAt,updatedAt,calendarId,sortOrder,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,location=excluded.location,deadline=excluded.deadline,estimatedMinutes=excluded.estimatedMinutes,priority=excluded.priority,stage=excluded.stage,checked=excluded.checked,completedAt=excluded.completedAt,start=excluded.start,end=excluded.end,allDay=excluded.allDay,isEvent=excluded.isEvent,hiddenOnCalendar=excluded.hiddenOnCalendar,linkedTo=excluded.linkedTo,parentId=excluded.parentId,subTasks=excluded.subTasks,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt,calendarId=excluded.calendarId,sortOrder=excluded.sortOrder,category=excluded.category`, params: [row.id,row.title,row.description,row.location,row.deadline_at,row.estimated_minutes,row.priority,row.stage,bit(row.checked),row.completed_at,row.start_at,row.end_at,bit(row.all_day),bit(row.is_event),bit(row.hidden_on_calendar),JSON.stringify(row.linked_to ?? []),row.parent_id,JSON.stringify(row.sub_tasks ?? []),row.created_at,row.updated_at,row.calendar_id,row.sort_order,row.category_id] };
    case 'task_range': return { sql: `INSERT INTO task_ranges(id,taskId,start,end,allDay,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET taskId=excluded.taskId,start=excluded.start,end=excluded.end,allDay=excluded.allDay,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt`, params: [row.id,row.task_id,row.start_at,row.end_at,bit(row.all_day),row.created_at,row.updated_at] };
    case 'shift_assignment': return { sql: `INSERT INTO shift_assignments(id,date,shiftTypeId,createdAt,updatedAt) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,shiftTypeId=excluded.shiftTypeId,createdAt=excluded.createdAt,updatedAt=excluded.updatedAt`, params: [row.id,row.shift_date,row.shift_type_id,row.created_at,row.updated_at] };
  }
}

const tableByType = { calendar: 'calendars', task: 'tasks', task_range: 'task_ranges', shift_type: 'shift_types', shift_assignment: 'shift_assignments' } as const;

export async function applyRemoteBundle(bundle: RemoteSyncBundle, snapshot: LocalSyncSnapshot, outbox: SyncOutboxEntry[]): Promise<void> {
  const locals = localEntityMap(snapshot);
  const pending = new Map(outbox.map((item) => [`${item.entityType}:${item.entityId}`, item]));
  const statements: Statement[] = [];
  for (const [type, rows] of remoteRows(bundle)) {
    for (const row of rows) {
      const id = String(row.id);
      const local = locals[type].get(id);
      const remoteUpdatedAt = String(row.updated_at || '');
      const localUpdatedAt = local ? String(local.updatedAt || local.createdAt || '') : undefined;
      const localPending = pending.get(`${type}:${id}`);
      if (!shouldApplyRemote(remoteUpdatedAt, localUpdatedAt, localPending?.changedAt)) continue;
      if (row.deleted_at) statements.push({ sql: `DELETE FROM ${tableByType[type]} WHERE id = ?`, params: [id] });
      else statements.push(upsertStatement(type, row));
      if (localPending) statements.push({ sql: 'DELETE FROM sync_outbox WHERE entityType=? AND entityId=? AND operationId=?', params: [type,id,localPending.operationId] });
    }
  }
  await db.runSyncStatements(statements, true);
}

export function mapLocalRowToRemote(type: Exclude<SyncEntityType, 'category'|'preferences'>, row: Record<string, unknown>, userId: string, changedAt?: string): Record<string, unknown> {
  const updatedAt = String(changedAt || row.updatedAt || row.createdAt || new Date().toISOString());
  switch (type) {
    case 'calendar': return { user_id:userId,id:row.id,title:row.title,enabled:!!row.enabled,kind:row.kind,read_only:!!row.readOnly,updated_at:updatedAt,deleted_at:null };
    case 'shift_type': return { user_id:userId,id:row.id,code:row.code,name:row.name,start_time:row.startTime,end_time:row.endTime,crosses_midnight:!!row.crossesMidnight,is_off:!!row.isOff,enabled:!!row.enabled,sort_order:row.sortOrder,updated_at:updatedAt,deleted_at:null };
    case 'task': return { user_id:userId,id:row.id,calendar_id:row.calendarId,title:row.title,description:row.description,location:row.location,category_id:row.category || 'other',deadline_at:row.deadline,estimated_minutes:row.estimatedMinutes,priority:row.priority || 'medium',stage:row.stage,checked:!!row.checked,completed_at:row.completedAt,start_at:row.start,end_at:row.end,all_day:!!row.allDay,is_event:!!row.isEvent,hidden_on_calendar:!!row.hiddenOnCalendar,linked_to:JSON.parse(String(row.linkedTo || '[]')),parent_id:row.parentId,sub_tasks:JSON.parse(String(row.subTasks || '[]')),sort_order:row.sortOrder || 0,created_at:row.createdAt,updated_at:updatedAt,deleted_at:null };
    case 'task_range': return { user_id:userId,id:row.id,task_id:row.taskId,start_at:row.start,end_at:row.end,all_day:!!row.allDay,created_at:row.createdAt,updated_at:updatedAt,deleted_at:null };
    case 'shift_assignment': return { user_id:userId,id:row.id,shift_date:row.date,shift_type_id:row.shiftTypeId,created_at:row.createdAt,updated_at:updatedAt,deleted_at:null };
  }
}

export function entityRows(snapshot: LocalSyncSnapshot, type: Exclude<SyncEntityType, 'category'|'preferences'>) { return localEntityMap(snapshot)[type]; }
