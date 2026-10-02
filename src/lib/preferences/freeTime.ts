export type FreeTimePreferences = { dayStartTime: string; dayEndTime: string; minimumFreeMinutes: number };

export const DEFAULT_FREE_TIME_PREFERENCES: FreeTimePreferences = { dayStartTime: '07:00', dayEndTime: '23:00', minimumFreeMinutes: 30 };
export const FREE_TIME_PREFERENCES_KEY = 'clarity:free-time-preferences';
export const FREE_TIME_PREFERENCES_EVENT = 'clarity-free-time-preferences-changed';

export function validateFreeTimePreferences(value: FreeTimePreferences): string | undefined {
  if (!/^\d{2}:\d{2}$/.test(value.dayStartTime) || !/^\d{2}:\d{2}$/.test(value.dayEndTime)) return '활동 가능 시간을 확인해 주세요.';
  if (value.dayStartTime >= value.dayEndTime) return '이번 단계에서는 같은 날짜 안에서 시작 시간이 종료 시간보다 빨라야 합니다.';
  if (!Number.isInteger(value.minimumFreeMinutes) || value.minimumFreeMinutes < 1) return '최소 빈 시간은 1분 이상이어야 합니다.';
  return undefined;
}

export function getFreeTimePreferences(): FreeTimePreferences {
  if (typeof window === 'undefined') return DEFAULT_FREE_TIME_PREFERENCES;
  try {
    const parsed = JSON.parse(localStorage.getItem(FREE_TIME_PREFERENCES_KEY) || '{}');
    const value = { ...DEFAULT_FREE_TIME_PREFERENCES, ...parsed } as FreeTimePreferences;
    return validateFreeTimePreferences(value) ? DEFAULT_FREE_TIME_PREFERENCES : value;
  } catch { return DEFAULT_FREE_TIME_PREFERENCES; }
}

export function setFreeTimePreferences(value: FreeTimePreferences): void {
  const error = validateFreeTimePreferences(value);
  if (error) throw new Error(error);
  localStorage.setItem(FREE_TIME_PREFERENCES_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(FREE_TIME_PREFERENCES_EVENT, { detail: value }));
}
