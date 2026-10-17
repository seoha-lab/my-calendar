'use client';

import { db } from '@/lib/db';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { createLocalBackup } from './backup';
import { applyRemoteBundle, enqueueEntireSnapshot, entityRows, mapLocalRowToRemote } from './local';
import { applySyncedCategories, applySyncedPreferences, readSyncedCategories, readSyncedPreferences } from './preferences';
import type { RemoteSyncBundle, SyncEntityType, SyncOutboxEntry } from './types';

const TABLE_BY_ENTITY: Record<Exclude<SyncEntityType, 'category'|'preferences'>, string> = {
  calendar: 'calendars', shift_type: 'shift_types', task: 'tasks',
  task_range: 'task_ranges', shift_assignment: 'shift_assignments',
};
const UPSERT_ORDER: Exclude<SyncEntityType, 'category'|'preferences'>[] = ['calendar','shift_type','task','task_range','shift_assignment'];
const SYNC_TABLES = ['calendars','categories','shift_types','tasks','task_ranges','shift_assignments','user_preferences'] as const;

async function rows(client: any, table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await client.from(table).select('*');
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

export async function pullRemoteBundle(client: any): Promise<RemoteSyncBundle> {
  const [calendars,categories,shiftTypes,tasks,taskRanges,shiftAssignments,preferences] = await Promise.all([
    rows(client,'calendars'), rows(client,'categories'), rows(client,'shift_types'), rows(client,'tasks'),
    rows(client,'task_ranges'), rows(client,'shift_assignments'), rows(client,'user_preferences'),
  ]);
  return { calendars,categories,shiftTypes,tasks,taskRanges,shiftAssignments,preferences: preferences[0] || null };
}

async function pushOutbox(client: any, userId: string, entries: SyncOutboxEntry[]): Promise<void> {
  const snapshot = await db.exportSyncSnapshot();
  const ordered = [...entries].sort((a,b) => {
    const ai = UPSERT_ORDER.indexOf(a.entityType as any);
    const bi = UPSERT_ORDER.indexOf(b.entityType as any);
    if (a.action !== b.action) return a.action === 'upsert' ? -1 : 1;
    return a.action === 'upsert' ? ai - bi : bi - ai;
  });
  const completed: SyncOutboxEntry[] = [];
  try {
    for (const entry of ordered) {
      if (entry.entityType === 'category' || entry.entityType === 'preferences') continue;
      const type = entry.entityType;
      const table = TABLE_BY_ENTITY[type];
      if (entry.action === 'delete') {
        const { error } = await client.from(table).update({ deleted_at: entry.changedAt, updated_at: entry.changedAt }).eq('id', entry.entityId).eq('user_id', userId);
        if (error) throw error;
      } else {
        const local = entityRows(snapshot, type).get(entry.entityId);
        const operation = local
          ? client.from(table).upsert(mapLocalRowToRemote(type, local, userId, entry.changedAt), { onConflict: 'user_id,id' })
          : client.from(table).update({ deleted_at: entry.changedAt, updated_at: entry.changedAt }).eq('id', entry.entityId).eq('user_id', userId);
        const { error } = await operation;
        if (error) throw error;
      }
      completed.push(entry);
    }
    await db.removeSyncOutbox(completed);
  } catch (error) {
    await db.removeSyncOutbox(completed);
    const remaining = ordered.filter((entry) => !completed.includes(entry));
    await db.markSyncOutboxFailed(remaining, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function syncCategoriesAndPreferences(client: any, userId: string, remote: RemoteSyncBundle): Promise<void> {
  const localCategories = readSyncedCategories();
  const remoteCategories = new Map(remote.categories.map((row) => [String(row.id), row]));
  const categoryUpserts: Record<string, unknown>[] = [];
  const categoriesToApply: ReturnType<typeof readSyncedCategories> = [];
  for (const local of localCategories) {
    const cloud = remoteCategories.get(local.id);
    const cloudTime = Date.parse(String(cloud?.updated_at || '')) || 0;
    const localTime = Date.parse(local.updatedAt) || 0;
    if (!cloud || localTime > cloudTime) categoryUpserts.push({ user_id:userId,id:local.id,label:local.label,color:local.color,is_builtin:local.isBuiltin,updated_at:local.updatedAt,deleted_at:null });
  }
  for (const cloud of remote.categories) {
    const local = localCategories.find((item) => item.id === cloud.id);
    if (!local || (Date.parse(String(cloud.updated_at)) || 0) >= (Date.parse(local.updatedAt) || 0)) {
      categoriesToApply.push({ id:String(cloud.id),label:String(cloud.label),color:String(cloud.color),isBuiltin:!!cloud.is_builtin,updatedAt:String(cloud.updated_at),deletedAt:cloud.deleted_at as string|null });
    }
  }
  if (categoryUpserts.length) {
    const { error } = await client.from('categories').upsert(categoryUpserts, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  if (categoriesToApply.length) applySyncedCategories([...localCategories.filter((item) => !categoriesToApply.some((remoteItem) => remoteItem.id === item.id)), ...categoriesToApply]);

  const localPreferences = readSyncedPreferences();
  let localUpdatedAt = localStorage.getItem('daymo:preferences-updated-at');
  if (!localUpdatedAt) { localUpdatedAt = new Date().toISOString(); localStorage.setItem('daymo:preferences-updated-at', localUpdatedAt); }
  const remoteUpdatedAt = String(remote.preferences?.updated_at || '');
  if (!remote.preferences || (Date.parse(localUpdatedAt) || 0) > (Date.parse(remoteUpdatedAt) || 0)) {
    const { error } = await client.from('user_preferences').upsert({ user_id:userId,preferences:localPreferences,updated_at:localUpdatedAt }, { onConflict: 'user_id' });
    if (error) throw error;
  } else {
    applySyncedPreferences((remote.preferences.preferences || {}) as any);
    localStorage.setItem('daymo:preferences-updated-at', remoteUpdatedAt);
  }
}

let activeSync: Promise<void> | null = null;
let activeSyncUserId: string | null = null;
export async function syncNow(user: { id: string }): Promise<void> {
  if (activeSync) {
    if (activeSyncUserId === user.id) return activeSync;
    await activeSync;
    return syncNow(user);
  }
  activeSyncUserId = user.id;
  activeSync = (async () => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase 설정이 없습니다.');
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user || auth.user.id !== user.id) throw new Error('로그인 확인에 실패했습니다.');
    const firstKey = `cloud-migrated:${user.id}`;
    const first = !(await db.getSyncState(firstKey));
    if (first) await createLocalBackup('before-first-cloud-sync', user.id);
    let snapshot = await db.exportSyncSnapshot();
    if (first) await enqueueEntireSnapshot(snapshot);
    let outbox = await db.listSyncOutbox();
    let remote = await pullRemoteBundle(client);
    await applyRemoteBundle(remote, snapshot, outbox);
    outbox = await db.listSyncOutbox();
    await pushOutbox(client, user.id, outbox);
    remote = await pullRemoteBundle(client);
    snapshot = await db.exportSyncSnapshot();
    await applyRemoteBundle(remote, snapshot, await db.listSyncOutbox());
    await syncCategoriesAndPreferences(client, user.id, remote);
    await db.setSyncState(firstKey, new Date().toISOString());
    await db.setSyncState('last-sync-at', new Date().toISOString());
  })().finally(() => { activeSync = null; activeSyncUserId = null; });
  return activeSync;
}

export function subscribeToCloudChanges(user: { id: string }, onChange: () => void): () => void {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const channel = client.channel(`daymo-sync-${user.id}`);
  for (const table of SYNC_TABLES) {
    channel.on('postgres_changes' as any, { event:'*', schema:'public', table, filter:`user_id=eq.${user.id}` }, () => {
      clearTimeout(timer); timer = setTimeout(onChange, 500);
    });
  }
  channel.subscribe();
  return () => { clearTimeout(timer); void client.removeChannel(channel); };
}
