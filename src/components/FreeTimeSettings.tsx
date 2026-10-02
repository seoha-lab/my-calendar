'use client';

import { Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_FREE_TIME_PREFERENCES, getFreeTimePreferences, setFreeTimePreferences, validateFreeTimePreferences, type FreeTimePreferences } from '@/lib/preferences/freeTime';
import { toast } from '@/lib/toast';

export default function FreeTimeSettings() {
  const [value, setValue] = useState<FreeTimePreferences>(DEFAULT_FREE_TIME_PREFERENCES);
  useEffect(() => setValue(getFreeTimePreferences()), []);
  const error = validateFreeTimePreferences(value);
  const save = () => {
    if (error) return;
    try { setFreeTimePreferences(value); toast('활동 가능 시간 설정을 저장했습니다.'); }
    catch (caught) { toast((caught as Error).message); }
  };
  return <section className="card p-4 space-y-3">
    <div><h2 className="font-medium flex items-center gap-2"><Clock3 className="h-4 w-4 text-gray-500" />활동 가능 시간</h2><p className="text-sm text-gray-600 dark:text-gray-300">빈 시간 계산에 사용할 하루 범위입니다.</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm"><span>활동 시작 시간</span><input className="input" type="time" value={value.dayStartTime} onChange={(event) => setValue({ ...value, dayStartTime: event.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>활동 종료 시간</span><input className="input" type="time" value={value.dayEndTime} onChange={(event) => setValue({ ...value, dayEndTime: event.target.value })} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>최소 빈 시간</span><select className="input" value={value.minimumFreeMinutes} onChange={(event) => setValue({ ...value, minimumFreeMinutes: Number(event.target.value) })}><option value={15}>15분</option><option value={30}>30분</option><option value={45}>45분</option><option value={60}>60분</option></select></label>
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end"><button className="btn btn-primary" disabled={!!error} onClick={save}>설정 저장</button></div>
  </section>;
}
