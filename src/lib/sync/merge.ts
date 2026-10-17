export type VersionedValue = { updatedAt: string; deletedAt?: string | null };

export function compareVersions(local: VersionedValue | undefined, remote: VersionedValue | undefined): 'local' | 'remote' | 'equal' {
  if (!local && remote) return 'remote';
  if (local && !remote) return 'local';
  if (!local || !remote) return 'equal';
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  if (localTime > remoteTime) return 'local';
  if (remoteTime > localTime) return 'remote';
  if (!!remote.deletedAt !== !!local.deletedAt) return remote.deletedAt ? 'remote' : 'local';
  return 'equal';
}

export function shouldApplyRemote(remoteUpdatedAt: string, localUpdatedAt?: string, pendingChangedAt?: string): boolean {
  const remote = Date.parse(remoteUpdatedAt) || 0;
  const local = Date.parse(localUpdatedAt || '') || 0;
  const pending = Date.parse(pendingChangedAt || '') || 0;
  // The cloud copy is the deterministic tie breaker for identical timestamps.
  // This makes two replicas converge even when clocks produce the same millisecond.
  return remote >= Math.max(local, pending);
}

export type ReplicaRecord<T = unknown> = VersionedValue & { id: string; value?: T };

/** Pure model of the client merge policy, used by protocol tests and recovery previews. */
export function reconcileReplicas<T>(local: ReplicaRecord<T>[], remote: ReplicaRecord<T>[]): ReplicaRecord<T>[] {
  const result = new Map<string, ReplicaRecord<T>>();
  for (const record of [...local, ...remote]) {
    const current = result.get(record.id);
    if (!current) { result.set(record.id, record); continue; }
    const winner = compareVersions(current, record);
    if (winner === 'remote') result.set(record.id, record);
  }
  return [...result.values()].sort((a,b) => a.id.localeCompare(b.id));
}
