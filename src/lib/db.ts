/*
  DB Worker RPC client
*/
import { normalizeCategory } from '@/lib/calendar/categories';
import { Task, CalendarSource, Stage, TaskRange, ShiftAssignment, ShiftType } from '@/types';
import type { ShiftAssignmentInput, ShiftTypeInput } from '@/lib/shifts/ShiftProvider';

type WorkerMsg =
  | { id: string; type: 'init' }
  | { id: string; type: 'migrate' }
  | { id: string; type: 'run'; sql: string; params?: unknown[] }
  | { id: string; type: 'all'; sql: string; params?: unknown[] }
  | { id: string; type: 'batch'; statements: { sql: string; params?: unknown[] }[] };

type WorkerResp<T = unknown> =
  | { id: string; ok: true; result?: T }
  | { id: string; ok: false; error: string };

let worker: Worker | null = null;
let ready = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/db.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

function call<T = unknown>(msg: WorkerMsg): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = getWorker();
    const handler = (e: MessageEvent<WorkerResp<T>>) => {
      const res = e.data;
      if (res.id !== msg.id) return;
      w.removeEventListener('message', handler as EventListener);
      if (res.ok) resolve((res as any).result as T);
      else reject(new Error(res.error));
    };
    w.addEventListener('message', handler as EventListener);
    w.postMessage(msg);
  });
}

async function ensureReady() {
  if (!ready) {
    const id1 = crypto.randomUUID();
    await call({ id: id1, type: 'init' });
    const id2 = crypto.randomUUID();
    await call({ id: id2, type: 'migrate' });
    ready = true;
  } else {
    // Re-run additive migrations after HMR or when a long-lived tab receives new code.
    const cols = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'PRAGMA table_info(tasks);', params: [] });
    const shiftTables = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('shift_types','shift_assignments');", params: [] });
    const hasCompletedAt = Array.isArray(cols) && cols.some((r: any) => String(r.name || '') === 'completedAt');
    const hasLocation = Array.isArray(cols) && cols.some((r: any) => String(r.name || '') === 'location');
    const hasScheduling = ['deadline', 'estimatedMinutes', 'priority'].every((name) => Array.isArray(cols) && cols.some((r: any) => String(r.name || '') === name));
    if (!hasCompletedAt || !hasLocation || !hasScheduling || shiftTables.length !== 2) {
      await call({ id: crypto.randomUUID(), type: 'migrate' });
    }
  }
}

// Utilities to marshal Task rows
function rowToTask(row: any): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    category: normalizeCategory(row.category),
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    deadline: row.deadline ?? undefined,
    estimatedMinutes: row.estimatedMinutes == null ? undefined : Number(row.estimatedMinutes),
    priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'medium',
    stage: row.stage as Stage,
    checked: !!row.checked,
    completedAt: row.completedAt ?? undefined,
    start: row.start ?? undefined,
    end: row.end ?? undefined,
    allDay: row.allDay != null ? !!row.allDay : undefined,
    isEvent: !!row.isEvent,
    hiddenOnCalendar: !!row.hiddenOnCalendar,
    linkedTo: row.linkedTo ? JSON.parse(row.linkedTo) : undefined,
    parentId: row.parentId ?? undefined,
    subTasks: row.subTasks ? JSON.parse(row.subTasks) : undefined,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    calendarId: String(row.calendarId),
    order: typeof row.sortOrder === 'number' ? row.sortOrder : (typeof row.order === 'number' ? row.order : undefined),
  };
}

function taskToDB(task: Partial<Task>): { cols: string[]; vals: unknown[]; placeholders: string[] } {
  const cols: string[] = [];
  const vals: unknown[] = [];
  const placeholders: string[] = [];
  const push = (c: string, v: unknown) => { cols.push(c); vals.push(v); placeholders.push('?'); };
  for (const [k, v] of Object.entries(task)) {
    if (v === undefined) continue;
    switch (k) {
      case 'ranges': // Stored separately in task_ranges
        break;
      case 'id':
        // id is handled separately
        break;
      case 'linkedTo': push('linkedTo', JSON.stringify(v)); break;
      case 'subTasks': push('subTasks', JSON.stringify(v)); break;
      case 'checked': push('checked', v ? 1 : 0); break;
      case 'completedAt': push('completedAt', v as any); break;
      case 'allDay': push('allDay', v ? 1 : 0); break;
      case 'isEvent': push('isEvent', v ? 1 : 0); break;
      case 'hiddenOnCalendar': push('hiddenOnCalendar', v ? 1 : 0); break;
      case 'order': push('sortOrder', v as number); break;
      default: push(k, v as any); break;
    }
  }
  return { cols, vals, placeholders };
}

function rowToShiftType(row: any): ShiftType {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    startTime: row.startTime == null ? null : String(row.startTime),
    endTime: row.endTime == null ? null : String(row.endTime),
    crossesMidnight: !!row.crossesMidnight,
    isOff: !!row.isOff,
    enabled: !!row.enabled,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

function rowToShiftAssignment(row: any): ShiftAssignment {
  return {
    id: String(row.id),
    date: String(row.date),
    shiftTypeId: String(row.shiftTypeId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function validateShiftTypeTimes(startTime: string | null, endTime: string | null, crossesMidnight: boolean) {
  const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!pattern.test(startTime ?? '') || !pattern.test(endTime ?? '')) throw new Error('유효한 근무 시간을 입력해 주세요.');
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  if (!crossesMidnight && minutes(endTime!) <= minutes(startTime!)) throw new Error('종료시간은 시작시간보다 늦어야 합니다.');
}

export const db = {
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    await ensureReady();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const full: Task = { ...task, id, createdAt: now, updatedAt: now };
    const { cols, vals, placeholders } = taskToDB(full);
    cols.unshift('id');
    vals.unshift(id);
    placeholders.unshift('?');
    const sql = `INSERT INTO tasks(${cols.join(',')}) VALUES(${placeholders.join(',')})`;
    await call({ id: crypto.randomUUID(), type: 'run', sql, params: vals });
    // If a start/end was provided, also create a range row for timeline support
    try {
      if (full.start && full.end) {
        const rid = crypto.randomUUID();
        const now2 = new Date().toISOString();
        await call({ id: crypto.randomUUID(), type: 'run', sql: 'INSERT INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', params: [rid, id, full.start, full.end, full.allDay ? 1 : 0, now2, now2] });
      }
    } catch {}
    // Return with ranges attached
    return await this.getTask(id);
  },

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    await ensureReady();
    const p = { ...patch, updatedAt: new Date().toISOString() } as Partial<Task>;
    const { cols, vals } = taskToDB(p);
    if (cols.length === 0) {
      return await this.getTask(id);
    }
    const sets = cols.map((c) => `${c} = ?`).join(',');
    const sql = `UPDATE tasks SET ${sets} WHERE id = ?`;
    try {
      await call({ id: crypto.randomUUID(), type: 'run', sql, params: [...vals, id] });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('no such column') && msg.includes('completedat')) {
        try { await call({ id: crypto.randomUUID(), type: 'migrate' } as any); } catch {}
        await call({ id: crypto.randomUUID(), type: 'run', sql, params: [...vals, id] });
      } else {
        throw err as Error;
      }
    }
    // Keep task_ranges in sync for single-range cases
    try {
      const hasTimePatch = Object.prototype.hasOwnProperty.call(p, 'start') || Object.prototype.hasOwnProperty.call(p, 'end') || Object.prototype.hasOwnProperty.call(p, 'allDay');
      if (hasTimePatch) {
        const ranges = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges WHERE taskId = ? ORDER BY start ASC', params: [id] });
        const start = (p as any).start as string | undefined;
        const end = (p as any).end as string | undefined;
        const allDay = (p as any).allDay as boolean | undefined;
        if (ranges.length === 0) {
          if (start && end) {
            const rid = crypto.randomUUID();
            const now2 = new Date().toISOString();
            await call({ id: crypto.randomUUID(), type: 'run', sql: 'INSERT INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', params: [rid, id, start, end, allDay ? 1 : 0, now2, now2] });
          }
        } else if (ranges.length === 1) {
          const r = ranges[0] as any;
          const nextStart = start ?? String(r.start);
          const nextEnd = end ?? String(r.end);
          const nextAll = allDay != null ? (allDay ? 1 : 0) : (r.allDay ? 1 : 0);
          await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE task_ranges SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [nextStart, nextEnd, nextAll, new Date().toISOString(), String(r.id)] });
        } else {
          // Multiple ranges exist: do not implicitly add another range via updateTask.
          // Range additions must go through addRange to avoid accidental duplicates.
        }
      }
    } catch {}
    return await this.getTask(id);
  },

  async deleteTask(id: string): Promise<void> {
    await ensureReady();
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'DELETE FROM tasks WHERE id = ?', params: [id] });
  },

  async listTasks(): Promise<Task[]> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM tasks ORDER BY createdAt ASC', params: [] });
    const tasks = rows.map(rowToTask);
    try {
      const tr = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges ORDER BY start ASC', params: [] });
      const byTask: Record<string, TaskRange[]> = {};
      for (const r of tr) {
        const item: TaskRange = { id: String(r.id), taskId: String(r.taskId), start: String(r.start), end: String(r.end), allDay: !!r.allDay, createdAt: r.createdAt, updatedAt: r.updatedAt };
        (byTask[item.taskId] ||= []).push(item);
      }
      for (const t of tasks) {
        if (byTask[t.id]?.length) t.ranges = byTask[t.id];
      }
    } catch {}
    return tasks;
  },

  async listEventsInRange(from: string, to: string): Promise<Task[]> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM tasks WHERE isEvent = 1 AND start IS NOT NULL AND end IS NOT NULL AND ((start <= ? AND end >= ?) OR (start >= ? AND start <= ?))', params: [to, from, from, to] });
    return rows.map(rowToTask);
  },

  async listTasksInRange(from: string, to: string): Promise<Task[]> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM tasks WHERE (start IS NULL OR end IS NULL) OR ((start <= ? AND end >= ?) OR (start >= ? AND start <= ?))', params: [to, from, from, to] });
    return rows.map(rowToTask);
  },

  async listCompletedInRange(from: string, to: string): Promise<Task[]> {
    await ensureReady();
    try {
      const rows = await call<any[]>({
        id: crypto.randomUUID(),
        type: 'all',
        sql: `
          SELECT * FROM tasks
          WHERE checked = 1 AND (
            (completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ?)
            OR (completedAt IS NULL AND updatedAt >= ? AND updatedAt <= ?)
          )
          ORDER BY COALESCE(completedAt, updatedAt) ASC
        `,
        params: [from, to, from, to],
      });
      return rows.map(rowToTask);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('no such column') && msg.includes('completedat')) {
        // Attempt a migration and retry once
        try { await call({ id: crypto.randomUUID(), type: 'migrate' } as any); } catch {}
        try {
          const rows = await call<any[]>({
            id: crypto.randomUUID(),
            type: 'all',
            sql: `
              SELECT * FROM tasks
              WHERE checked = 1 AND (
                (completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ?)
                OR (completedAt IS NULL AND updatedAt >= ? AND updatedAt <= ?)
              )
              ORDER BY COALESCE(completedAt, updatedAt) ASC
            `,
            params: [from, to, from, to],
          });
          return rows.map(rowToTask);
        } catch {}
        // Fallback query without referencing completedAt
        const rows = await call<any[]>({
          id: crypto.randomUUID(),
          type: 'all',
          sql: 'SELECT * FROM tasks WHERE checked = 1 AND updatedAt >= ? AND updatedAt <= ? ORDER BY updatedAt ASC',
          params: [from, to],
        });
        return rows.map(rowToTask);
      }
      throw err as Error;
    }
  },

  async listCalendars(): Promise<CalendarSource[]> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM calendars ORDER BY id', params: [] });
    return rows.map((r) => ({ id: String(r.id), title: String(r.title), enabled: !!r.enabled, readOnly: !!r.readOnly, kind: r.kind as CalendarSource['kind'] }));
  },

  async toggleCalendarEnabled(id: string, enabled: boolean): Promise<void> {
    await ensureReady();
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE calendars SET enabled = ? WHERE id = ?', params: [enabled ? 1 : 0, id] });
  },
  
  // --- Ranges (timeline) ---
  async getTask(id: string): Promise<Task> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM tasks WHERE id = ?', params: [id] });
    const t = rowToTask(rows[0]);
    try {
      const tr = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges WHERE taskId = ? ORDER BY start ASC', params: [id] });
      if (tr.length) {
        t.ranges = tr.map((r: any) => ({ id: String(r.id), taskId: String(r.taskId), start: String(r.start), end: String(r.end), allDay: !!r.allDay, createdAt: r.createdAt, updatedAt: r.updatedAt }));
      }
    } catch {}
    return t;
  },

  async addRange(taskId: string, input: { start: string; end: string; allDay?: boolean }): Promise<Task> {
    await ensureReady();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'INSERT INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', params: [id, taskId, input.start, input.end, input.allDay ? 1 : 0, now, now] });
    // Keep task.start/end in sync to represent last added range
    try { await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE tasks SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [input.start, input.end, input.allDay ? 1 : 0, now, taskId] }); } catch {}
    return await this.getTask(taskId);
  },

  async addRanges(taskId: string, inputs: { start: string; end: string; allDay?: boolean }[]): Promise<Task> {
    await ensureReady();
    if (inputs.length === 0) return await this.getTask(taskId);
    const now = new Date().toISOString();
    const statements = inputs.map((input) => ({
      sql: 'INSERT INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
      params: [crypto.randomUUID(), taskId, input.start, input.end, input.allDay ? 1 : 0, now, now],
    }));
    const last = inputs[inputs.length - 1];
    statements.push({ sql: 'UPDATE tasks SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [last.start, last.end, last.allDay ? 1 : 0, now, taskId] });
    await call({ id: crypto.randomUUID(), type: 'batch', statements });
    return await this.getTask(taskId);
  },

  async addRangesBatch(groups: { taskId: string; ranges: { start: string; end: string; allDay?: boolean }[] }[]): Promise<Task[]> {
    await ensureReady();
    const nonEmpty = groups.filter((group) => group.ranges.length > 0);
    if (nonEmpty.length === 0) return [];
    const now = new Date().toISOString();
    const statements: { sql: string; params?: unknown[] }[] = [];
    for (const group of nonEmpty) {
      for (const range of group.ranges) statements.push({ sql: 'INSERT INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', params: [crypto.randomUUID(), group.taskId, range.start, range.end, range.allDay ? 1 : 0, now, now] });
      const last = group.ranges[group.ranges.length - 1];
      statements.push({ sql: 'UPDATE tasks SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [last.start, last.end, last.allDay ? 1 : 0, now, group.taskId] });
    }
    await call({ id: crypto.randomUUID(), type: 'batch', statements });
    return await Promise.all(nonEmpty.map((group) => this.getTask(group.taskId)));
  },

  async updateRange(rangeId: string, patch: Partial<Pick<TaskRange, 'start'|'end'|'allDay'>>): Promise<Task> {
    await ensureReady();
    const row = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges WHERE id = ?', params: [rangeId] });
    if (!row[0]) throw new Error('Range not found');
    const taskId = String(row[0].taskId);
    const nextStart = patch.start ?? String(row[0].start);
    const nextEnd = patch.end ?? String(row[0].end);
    const nextAll = patch.allDay != null ? (patch.allDay ? 1 : 0) : (row[0].allDay ? 1 : 0);
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE task_ranges SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [nextStart, nextEnd, nextAll, new Date().toISOString(), rangeId] });
    // Heuristic: mirror edited range onto task.start/end
    try { await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE tasks SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [nextStart, nextEnd, nextAll, new Date().toISOString(), taskId] }); } catch {}
    return await this.getTask(taskId);
  },

  async deleteRange(rangeId: string): Promise<Task> {
    await ensureReady();
    const row = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges WHERE id = ?', params: [rangeId] });
    const taskId = row[0] ? String(row[0].taskId) : '';
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'DELETE FROM task_ranges WHERE id = ?', params: [rangeId] });
    // Update task.start/end to latest remaining range or clear
    try {
      const remaining = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM task_ranges WHERE taskId = ? ORDER BY start DESC', params: [taskId] });
      if (remaining[0]) {
        const r = remaining[0];
        await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE tasks SET start = ?, end = ?, allDay = ?, updatedAt = ? WHERE id = ?', params: [String(r.start), String(r.end), (r.allDay ? 1 : 0), new Date().toISOString(), taskId] });
      } else {
        await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE tasks SET start = NULL, end = NULL, updatedAt = ? WHERE id = ?', params: [new Date().toISOString(), taskId] });
      }
    } catch {}
    return await this.getTask(taskId);
  },

  // --- Shifts ---
  async listShiftTypes(): Promise<ShiftType[]> {
    await ensureReady();
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_types ORDER BY sortOrder ASC, code ASC', params: [] });
    return rows.map(rowToShiftType);
  },

  async createShiftType(input: ShiftTypeInput): Promise<ShiftType> {
    await ensureReady();
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) throw new Error('근무 코드와 이름을 입력해 주세요.');
    const existing = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT id FROM shift_types WHERE UPPER(code) = UPPER(?)', params: [code] });
    if (existing.length) throw new Error('이미 사용 중인 근무 코드입니다.');
    const isOff = !!input.isOff;
    const startTime = isOff ? null : input.startTime;
    const endTime = isOff ? null : input.endTime;
    if (!isOff) validateShiftTypeTimes(startTime, endTime, input.crossesMidnight);
    const orderRows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT COALESCE(MAX(sortOrder),0) AS maxOrder FROM shift_types', params: [] });
    const sortOrder = input.sortOrder ?? Number(orderRows[0]?.maxOrder ?? 0) + 10;
    const id = crypto.randomUUID();
    await call({
      id: crypto.randomUUID(),
      type: 'run',
      sql: 'INSERT INTO shift_types(id,code,name,startTime,endTime,crossesMidnight,isOff,enabled,sortOrder) VALUES (?,?,?,?,?,?,?,?,?)',
      params: [id, code, name, startTime, endTime, input.crossesMidnight ? 1 : 0, isOff ? 1 : 0, input.enabled === false ? 0 : 1, sortOrder],
    });
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_types WHERE id = ?', params: [id] });
    return rowToShiftType(rows[0]);
  },

  async updateShiftType(id: string, patch: Partial<ShiftTypeInput>): Promise<ShiftType> {
    await ensureReady();
    const currentRows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_types WHERE id = ?', params: [id] });
    if (!currentRows[0]) throw new Error('근무 유형을 찾을 수 없습니다.');
    const current = rowToShiftType(currentRows[0]);
    const next = {
      code: (patch.code ?? current.code).trim().toUpperCase(),
      name: (patch.name ?? current.name).trim(),
      startTime: patch.startTime === undefined ? current.startTime : patch.startTime,
      endTime: patch.endTime === undefined ? current.endTime : patch.endTime,
      crossesMidnight: patch.crossesMidnight ?? current.crossesMidnight,
      isOff: patch.isOff ?? current.isOff,
      enabled: patch.enabled ?? current.enabled,
      sortOrder: patch.sortOrder ?? current.sortOrder,
    };
    if (!next.code || !next.name) throw new Error('근무 코드와 이름을 입력해 주세요.');
    const duplicate = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT id FROM shift_types WHERE UPPER(code) = UPPER(?) AND id <> ?', params: [next.code, id] });
    if (duplicate.length) throw new Error('이미 사용 중인 근무 코드입니다.');
    if (next.isOff) {
      next.startTime = null;
      next.endTime = null;
      next.crossesMidnight = false;
    } else validateShiftTypeTimes(next.startTime, next.endTime, next.crossesMidnight);
    await call({
      id: crypto.randomUUID(),
      type: 'run',
      sql: 'UPDATE shift_types SET code=?, name=?, startTime=?, endTime=?, crossesMidnight=?, isOff=?, enabled=?, sortOrder=? WHERE id=?',
      params: [next.code, next.name, next.startTime, next.endTime, next.crossesMidnight ? 1 : 0, next.isOff ? 1 : 0, next.enabled ? 1 : 0, next.sortOrder, id],
    });
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_types WHERE id = ?', params: [id] });
    return rowToShiftType(rows[0]);
  },

  async deleteShiftType(id: string): Promise<void> {
    await ensureReady();
    const used = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT COUNT(1) AS count FROM shift_assignments WHERE shiftTypeId = ?', params: [id] });
    if (Number(used[0]?.count ?? 0) > 0) throw new Error('이미 입력된 근무가 있어 삭제할 수 없습니다. 대신 비활성화해 주세요.');
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'DELETE FROM shift_types WHERE id = ?', params: [id] });
  },

  async listShiftAssignments(from?: string, to?: string): Promise<ShiftAssignment[]> {
    await ensureReady();
    let sql = 'SELECT * FROM shift_assignments';
    const params: string[] = [];
    if (from && to) {
      sql += ' WHERE date >= ? AND date <= ?';
      params.push(from, to);
    } else if (from) {
      sql += ' WHERE date >= ?';
      params.push(from);
    } else if (to) {
      sql += ' WHERE date <= ?';
      params.push(to);
    }
    sql += ' ORDER BY date ASC';
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql, params });
    return rows.map(rowToShiftAssignment);
  },

  async setShiftAssignment(input: ShiftAssignmentInput): Promise<ShiftAssignment> {
    await ensureReady();
    const existing = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_assignments WHERE date = ?', params: [input.date] });
    const now = new Date().toISOString();
    if (existing[0]) {
      await call({ id: crypto.randomUUID(), type: 'run', sql: 'UPDATE shift_assignments SET shiftTypeId = ?, updatedAt = ? WHERE date = ?', params: [input.shiftTypeId, now, input.date] });
    } else {
      await call({ id: crypto.randomUUID(), type: 'run', sql: 'INSERT INTO shift_assignments(id, date, shiftTypeId, createdAt, updatedAt) VALUES (?,?,?,?,?)', params: [crypto.randomUUID(), input.date, input.shiftTypeId, now, now] });
    }
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_assignments WHERE date = ?', params: [input.date] });
    if (!rows[0]) throw new Error('Shift assignment was not saved');
    return rowToShiftAssignment(rows[0]);
  },

  async setShiftAssignments(inputs: ShiftAssignmentInput[]): Promise<ShiftAssignment[]> {
    await ensureReady();
    if (inputs.length === 0) return [];
    const now = new Date().toISOString();
    await call({
      id: crypto.randomUUID(),
      type: 'batch',
      statements: inputs.map((input) => ({
        sql: `INSERT INTO shift_assignments(id, date, shiftTypeId, createdAt, updatedAt)
          VALUES (?,?,?,?,?)
          ON CONFLICT(date) DO UPDATE SET shiftTypeId = excluded.shiftTypeId, updatedAt = excluded.updatedAt`,
        params: [crypto.randomUUID(), input.date, input.shiftTypeId, now, now],
      })),
    });
    const dates = inputs.map((input) => input.date);
    const placeholders = dates.map(() => '?').join(',');
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: `SELECT * FROM shift_assignments WHERE date IN (${placeholders}) ORDER BY date ASC`, params: dates });
    return rows.map(rowToShiftAssignment);
  },

  async applyShiftAssignmentChanges(upserts: ShiftAssignmentInput[], deleteDates: string[]): Promise<ShiftAssignment[]> {
    await ensureReady();
    const now = new Date().toISOString();
    const statements = [
      ...deleteDates.map((date) => ({ sql: 'DELETE FROM shift_assignments WHERE date = ?', params: [date] })),
      ...upserts.map((input) => ({
        sql: 'INSERT INTO shift_assignments(id, date, shiftTypeId, createdAt, updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET shiftTypeId = excluded.shiftTypeId, updatedAt = excluded.updatedAt',
        params: [crypto.randomUUID(), input.date, input.shiftTypeId, now, now],
      })),
    ];
    if (statements.length) await call({ id: crypto.randomUUID(), type: 'batch', statements });
    if (!upserts.length) return [];
    const dates = upserts.map((input) => input.date);
    const placeholders = dates.map(() => '?').join(',');
    const rows = await call<any[]>({ id: crypto.randomUUID(), type: 'all', sql: 'SELECT * FROM shift_assignments WHERE date IN (' + placeholders + ') ORDER BY date ASC', params: dates });
    return rows.map(rowToShiftAssignment);
  },

  async deleteShiftAssignment(date: string): Promise<void> {
    await ensureReady();
    await call({ id: crypto.randomUUID(), type: 'run', sql: 'DELETE FROM shift_assignments WHERE date = ?', params: [date] });
  },
};
