/* eslint-disable no-restricted-globals */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type Message =
  | { id: string; type: 'useDatabase'; databaseKey: string }
  | { id: string; type: 'init' }
  | { id: string; type: 'migrate' }
  | { id: string; type: 'run'; sql: string; params?: unknown[] }
  | { id: string; type: 'all'; sql: string; params?: unknown[] }
  | { id: string; type: 'batch'; statements: { sql: string; params?: unknown[] }[] };

type Response =
  | { id: string; ok: true; result?: unknown }
  | { id: string; ok: false; error: string };

let db: any = null;
let sqlite3: any = null;
let databaseKey = 'legacy';

function databasePath(key: string) {
  const safe = key === 'legacy' ? 'main' : `user-${key.replace(/[^a-zA-Z0-9-]/g, '')}`;
  return `/clarity/${safe}.sqlite3`;
}

async function ensureDB() {
  if (db) return db;
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule({});
  }
  try {
    db = new sqlite3.oo1.OpfsDb(databasePath(databaseKey));
  } catch (e) {
    // Fallback to transient db if OPFS unavailable
    db = new sqlite3.oo1.DB(databasePath(databaseKey), 'ct');
  }
  return db;
}

function migrateSQL(): string {
  return `
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL CHECK(kind IN ('local','google')),
  readOnly INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  deadline TEXT,
  estimatedMinutes INTEGER,
  priority TEXT CHECK(priority IN ('high','medium','low')) DEFAULT 'medium',
  stage TEXT NOT NULL CHECK(stage IN ('todo','in-progress','done')),
  checked INTEGER NOT NULL DEFAULT 0,
  completedAt TEXT,
  start TEXT,
  end TEXT,
  allDay INTEGER,
  isEvent INTEGER NOT NULL DEFAULT 0,
  hiddenOnCalendar INTEGER NOT NULL DEFAULT 0,
  linkedTo TEXT,
  parentId TEXT,
  subTasks TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  calendarId TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  sortOrder REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage);
CREATE INDEX IF NOT EXISTS idx_tasks_calendar ON tasks(calendarId);
CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(start, end);

INSERT OR IGNORE INTO calendars(id,title,enabled,kind,readOnly)
VALUES ('local','Local Tasks',1,'local',0);
-- New: per-task multiple time ranges timeline table
CREATE TABLE IF NOT EXISTS task_ranges (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  allDay INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_ranges_task ON task_ranges(taskId);
CREATE INDEX IF NOT EXISTS idx_task_ranges_time ON task_ranges(start, end);

CREATE TABLE IF NOT EXISTS shift_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  crossesMidnight INTEGER NOT NULL DEFAULT 0,
  isOff INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  CHECK (
    (isOff = 1 AND startTime IS NULL AND endTime IS NULL)
    OR
    (isOff = 0 AND startTime IS NOT NULL AND endTime IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  shiftTypeId TEXT NOT NULL REFERENCES shift_types(id),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_type ON shift_assignments(shiftTypeId);

INSERT OR IGNORE INTO shift_types(id,code,name,startTime,endTime,crossesMidnight,isOff,enabled,sortOrder)
VALUES
  ('shift-d','D','데이','06:30','14:30',0,0,1,1),
  ('shift-e','E','이브닝','14:30','22:30',0,0,1,2),
  ('shift-n','N','나이트','22:30','06:30',1,0,1,3),
  ('shift-d2','D2','데이2','10:30','18:30',0,0,1,4),
  ('shift-d7','D7','데이(12시간)','06:30','18:30',0,0,1,10),
  ('shift-n7','N7','나이트(12시간)','18:30','06:30',1,0,1,20),
  ('shift-off','OFF','오프',NULL,NULL,0,1,1,30);

CREATE TABLE IF NOT EXISTS sync_outbox (
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('upsert','delete')),
  changedAt TEXT NOT NULL,
  operationId TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  PRIMARY KEY(entityType, entityId)
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_changed ON sync_outbox(changedAt);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_backups (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  reason TEXT NOT NULL,
  checksum TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_backups_created ON sync_backups(createdAt DESC);

CREATE TABLE IF NOT EXISTS sync_control (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  applyingRemote INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_control(id, applyingRemote) VALUES(1, 0);
`;
}

function createSyncTriggers(dbi: any) {
  const specs = [
    ['calendars', 'calendar'], ['tasks', 'task'], ['task_ranges', 'task_range'],
    ['shift_types', 'shift_type'], ['shift_assignments', 'shift_assignment'],
  ] as const;
  for (const [table, entity] of specs) {
    const updated = table === 'tasks' || table === 'task_ranges' || table === 'shift_assignments'
      ? "COALESCE(NEW.updatedAt, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
      : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
    dbi.exec(`
      CREATE TRIGGER IF NOT EXISTS sync_${table}_insert AFTER INSERT ON ${table}
      WHEN (SELECT applyingRemote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_outbox(entityType,entityId,action,changedAt,operationId)
        VALUES('${entity}',NEW.id,'upsert',${updated},lower(hex(randomblob(16))))
        ON CONFLICT(entityType,entityId) DO UPDATE SET action='upsert',changedAt=excluded.changedAt,operationId=excluded.operationId,attempts=0,lastError=NULL;
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${table}_update AFTER UPDATE ON ${table}
      WHEN (SELECT applyingRemote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_outbox(entityType,entityId,action,changedAt,operationId)
        VALUES('${entity}',NEW.id,'upsert',${updated},lower(hex(randomblob(16))))
        ON CONFLICT(entityType,entityId) DO UPDATE SET action='upsert',changedAt=excluded.changedAt,operationId=excluded.operationId,attempts=0,lastError=NULL;
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${table}_delete AFTER DELETE ON ${table}
      WHEN (SELECT applyingRemote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_outbox(entityType,entityId,action,changedAt,operationId)
        VALUES('${entity}',OLD.id,'delete',strftime('%Y-%m-%dT%H:%M:%fZ','now'),lower(hex(randomblob(16))))
        ON CONFLICT(entityType,entityId) DO UPDATE SET action='delete',changedAt=excluded.changedAt,operationId=excluded.operationId,attempts=0,lastError=NULL;
      END;
    `);
  }
}

self.onmessage = async (e: MessageEvent<Message>) => {
  const msg = e.data;
  const send = (res: Response) => (self as unknown as Worker).postMessage(res);
  try {
    switch (msg.type) {
      case 'useDatabase': {
        if (db) {
          try { db.close(); } catch {}
          db = null;
        }
        databaseKey = msg.databaseKey || 'legacy';
        await ensureDB();
        send({ id: msg.id, ok: true });
        break;
      }
      case 'init': {
        await ensureDB();
        send({ id: msg.id, ok: true });
        break;
      }
      case 'migrate': {
        const dbi = await ensureDB();
        dbi.exec(migrateSQL());
        // Attempt to migrate old column name 'order' -> 'sortOrder'
        try {
          dbi.exec('ALTER TABLE tasks RENAME COLUMN "order" TO sortOrder;');
        } catch (_) {
          // ignore if not present or already migrated
        }
        // If legacy 'color' column exists, rebuild table without it
        try {
          const cols = dbi.exec({ sql: 'PRAGMA table_info(tasks);', returnValue: 'resultRows', rowMode: 'object' }) as any[];
          // Add completedAt column if missing
          const hasCompletedAt = Array.isArray(cols) && cols.some((r) => String((r as any).name || '') === 'completedAt');
          if (!hasCompletedAt) {
            try { dbi.exec('ALTER TABLE tasks ADD COLUMN completedAt TEXT;'); } catch {}
            try { dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_completedAt ON tasks(completedAt);'); } catch {}
          }
          const hasColor = Array.isArray(cols) && cols.some((r) => String((r as any).name || '') === 'color');
          if (hasColor) {
            const hasLocation = cols.some((r) => String((r as any).name || '') === 'location');
            const hasDeadline = cols.some((r) => String((r as any).name || '') === 'deadline');
            const hasEstimatedMinutes = cols.some((r) => String((r as any).name || '') === 'estimatedMinutes');
            const hasPriority = cols.some((r) => String((r as any).name || '') === 'priority');
            dbi.exec('BEGIN;');
            dbi.exec(`
CREATE TABLE IF NOT EXISTS tasks__new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  deadline TEXT,
  estimatedMinutes INTEGER,
  priority TEXT CHECK(priority IN ('high','medium','low')) DEFAULT 'medium',
  stage TEXT NOT NULL CHECK(stage IN ('todo','in-progress','done')),
  checked INTEGER NOT NULL DEFAULT 0,
  completedAt TEXT,
  start TEXT,
  end TEXT,
  allDay INTEGER,
  isEvent INTEGER NOT NULL DEFAULT 0,
  hiddenOnCalendar INTEGER NOT NULL DEFAULT 0,
  linkedTo TEXT,
  parentId TEXT,
  subTasks TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  calendarId TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  sortOrder REAL NOT NULL DEFAULT 0
);
`);
            dbi.exec(`INSERT INTO tasks__new (id,title,description,location,deadline,estimatedMinutes,priority,stage,checked,completedAt,start,end,allDay,isEvent,hiddenOnCalendar,linkedTo,parentId,subTasks,createdAt,updatedAt,calendarId,sortOrder)
SELECT id,title,description,${hasLocation ? 'location' : 'NULL'},${hasDeadline ? 'deadline' : 'NULL'},${hasEstimatedMinutes ? 'estimatedMinutes' : 'NULL'},${hasPriority ? 'priority' : "'medium'"},stage,checked,completedAt,start,end,allDay,isEvent,hiddenOnCalendar,linkedTo,parentId,subTasks,createdAt,updatedAt,calendarId,sortOrder FROM tasks;`);
            dbi.exec('DROP TABLE tasks;');
            dbi.exec('ALTER TABLE tasks__new RENAME TO tasks;');
            dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage);');
            dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_calendar ON tasks(calendarId);');
            dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(start, end);');
            dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_completedAt ON tasks(completedAt);');
            dbi.exec('COMMIT;');
          }
        } catch (_) {
          try { dbi.exec('ROLLBACK;'); } catch {}
        }
        // Ensure index exists when no rebuild was needed and column already present
        try { dbi.exec('CREATE INDEX IF NOT EXISTS idx_tasks_completedAt ON tasks(completedAt);'); } catch {}

        const calendarColumns = dbi.exec({ sql: 'PRAGMA table_info(calendars);', returnValue: 'resultRows', rowMode: 'object' }) as { name: string }[];
        if (!calendarColumns.some((column) => column.name === 'updatedAt')) dbi.exec('ALTER TABLE calendars ADD COLUMN updatedAt TEXT;');
        const shiftTypeColumns = dbi.exec({ sql: 'PRAGMA table_info(shift_types);', returnValue: 'resultRows', rowMode: 'object' }) as { name: string }[];
        if (!shiftTypeColumns.some((column) => column.name === 'updatedAt')) dbi.exec('ALTER TABLE shift_types ADD COLUMN updatedAt TEXT;');
        dbi.exec("UPDATE calendars SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updatedAt IS NULL;");
        dbi.exec("UPDATE shift_types SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updatedAt IS NULL;");

        // Phase 2: additive, repeatable category migration. Never reset existing data.
        const categoryColumns = dbi.exec({ sql: 'PRAGMA table_info(tasks);', returnValue: 'resultRows', rowMode: 'object' }) as { name: string }[];
        if (!categoryColumns.some((column) => column.name === 'category')) {
          dbi.exec("ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'other';");
        }

        // Phase 7: additive, repeatable event location migration.
        const locationColumns = dbi.exec({ sql: 'PRAGMA table_info(tasks);', returnValue: 'resultRows', rowMode: 'object' }) as { name: string }[];
        if (!locationColumns.some((column) => column.name === 'location')) {
          dbi.exec('ALTER TABLE tasks ADD COLUMN location TEXT;');
        }

        // Phase 10: additive, repeatable task scheduling fields.
        const schedulingColumns = dbi.exec({ sql: 'PRAGMA table_info(tasks);', returnValue: 'resultRows', rowMode: 'object' }) as { name: string }[];
        if (!schedulingColumns.some((column) => column.name === 'deadline')) dbi.exec('ALTER TABLE tasks ADD COLUMN deadline TEXT;');
        if (!schedulingColumns.some((column) => column.name === 'estimatedMinutes')) dbi.exec('ALTER TABLE tasks ADD COLUMN estimatedMinutes INTEGER;');
        if (!schedulingColumns.some((column) => column.name === 'priority')) dbi.exec("ALTER TABLE tasks ADD COLUMN priority TEXT CHECK(priority IN ('high','medium','low')) DEFAULT 'medium';");

        // Backfill: for any task with start/end but no task_ranges rows, create one
        try {
          const missing: any[] = dbi.exec({
            sql: `
              SELECT t.id AS taskId, t.start AS start, t.end AS end, COALESCE(t.allDay,0) AS allDay
              FROM tasks t
              LEFT JOIN (
                SELECT taskId, COUNT(1) AS cnt FROM task_ranges GROUP BY taskId
              ) tr ON tr.taskId = t.id
              WHERE (t.start IS NOT NULL AND t.end IS NOT NULL) AND (tr.cnt IS NULL OR tr.cnt = 0)
            `,
            returnValue: 'resultRows',
            rowMode: 'object',
          }) as any[];
          if (Array.isArray(missing) && missing.length > 0) {
            dbi.exec('BEGIN;');
            for (const r of missing) {
              const id = (self.crypto || globalThis.crypto).randomUUID();
              const now = new Date().toISOString();
              dbi.exec({
                sql: 'INSERT OR IGNORE INTO task_ranges(id, taskId, start, end, allDay, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
                bind: [id, String((r as any).taskId), String((r as any).start), String((r as any).end), ((r as any).allDay ? 1 : 0), now, now],
              });
            }
            dbi.exec('COMMIT;');
          }
        } catch (_) {
          try { dbi.exec('ROLLBACK;'); } catch {}
        }
        createSyncTriggers(dbi);
        send({ id: msg.id, ok: true });
        break;
      }
      case 'run': {
        const dbi = await ensureDB();
        dbi.exec({ sql: msg.sql, bind: msg.params ?? [] });
        send({ id: msg.id, ok: true });
        break;
      }
      case 'all': {
        const dbi = await ensureDB();
        const rows = dbi.exec({
          sql: msg.sql,
          bind: msg.params ?? [],
          returnValue: 'resultRows',
          rowMode: 'object',
        });
        send({ id: msg.id, ok: true, result: rows });
        break;
      }
      case 'batch': {
        const dbi = await ensureDB();
        dbi.exec('BEGIN;');
        try {
          for (const statement of msg.statements) {
            dbi.exec({ sql: statement.sql, bind: statement.params ?? [] });
          }
          dbi.exec('COMMIT;');
        } catch (error) {
          dbi.exec('ROLLBACK;');
          throw error;
        }
        send({ id: msg.id, ok: true });
        break;
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    send({ id: msg.id, ok: false, error });
  }
};
