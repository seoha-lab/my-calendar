'use client';

import { useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
import { useStore } from '@/store';
import { openShiftManager } from '@/lib/shifts/ui';

function timeLabel(type: { isOff: boolean; startTime: string | null; endTime: string | null; crossesMidnight: boolean }) {
  if (type.isOff) return '근무시간 없음';
  return `${type.startTime}–${type.crossesMidnight ? '익일 ' : ''}${type.endTime}`;
}

export default function ShiftSettings() {
  const shiftTypes = useStore((state) => state.shiftTypes);
  const refreshShifts = useStore((state) => state.refreshShifts);

  useEffect(() => { void refreshShifts(); }, [refreshShifts]);

  return (
    <section className="card p-4 space-y-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium flex items-center gap-2"><CalendarClock className="w-4 h-4 text-gray-500" /> 교대근무</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">근무 유형을 확인하고 날짜별 근무 또는 반복 패턴을 입력합니다.</p>
        </div>
        <button className="btn btn-primary min-h-11" onClick={() => openShiftManager(undefined, 'single')}>근무 일정 입력</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {shiftTypes.map((type) => (
          <div key={type.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold category-hospital" style={{ color: 'var(--category-accent)' }}>{type.code}</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{type.name}</span>
            </div>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{timeLabel(type)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">기본 유형은 읽기 전용입니다. 데이터 구조는 이후 사용자 정의 근무 유형을 추가할 수 있도록 분리되어 있습니다.</p>
    </section>
  );
}
