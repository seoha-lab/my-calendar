export type SyncEntityType = 'calendar' | 'category' | 'shift_type' | 'task' | 'task_range' | 'shift_assignment' | 'preferences';
export type SyncAction = 'upsert' | 'delete';

export type SyncOutboxEntry = {
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  changedAt: string;
  operationId: string;
  attempts: number;
  lastError?: string;
};

export type LocalSyncSnapshot = {
  calendars: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  taskRanges: Record<string, unknown>[];
  shiftTypes: Record<string, unknown>[];
  shiftAssignments: Record<string, unknown>[];
};

export type SyncedPreferences = {
  theme?: 'light' | 'dark' | 'system';
  calendarTheme?: string;
  hideDone?: boolean;
  freeTime?: { dayStartTime: string; dayEndTime: string; minimumFreeMinutes: number };
};

export type SyncedCategory = {
  id: string;
  label: string;
  color: string;
  isBuiltin: boolean;
  updatedAt: string;
  deletedAt?: string | null;
};

export type DaymoBackup = {
  format: 'daymo-backup';
  version: 1;
  createdAt: string;
  databaseKey: string;
  userId?: string;
  data: LocalSyncSnapshot;
  categories: SyncedCategory[];
  preferences: SyncedPreferences;
  checksum?: string;
};

export type RemoteSyncBundle = {
  calendars: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  shiftTypes: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  taskRanges: Record<string, unknown>[];
  shiftAssignments: Record<string, unknown>[];
  preferences: Record<string, unknown> | null;
};

export type SyncStatus = 'disabled' | 'checking' | 'offline' | 'syncing' | 'synced' | 'error';
