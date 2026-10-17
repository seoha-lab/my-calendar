'use client';

import { create } from 'zustand';
import type { SyncStatus } from './types';

type CloudSyncState = {
  status: SyncStatus;
  userId?: string;
  email?: string;
  lastSyncedAt?: string;
  pending: number;
  error?: string;
  setState: (patch: Partial<Omit<CloudSyncState, 'setState'>>) => void;
};

export const useCloudSync = create<CloudSyncState>((set) => ({
  status: 'checking', pending: 0, setState: (patch) => set(patch),
}));
