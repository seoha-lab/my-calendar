'use client';

import { AlertTriangle, ArrowRight, BriefcaseMedical, CalendarDays, CheckCircle2, Clock3, ListTodo, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import CategoryBadge from '@/components/CategoryBadge';
import TaskDetailsDrawer from '@/components/TaskDetailsDrawer';
import { DEFAULT_FREE_TIME_PREFERENCES, FREE_TIME_PREFERENCES_EVENT, getFreeTimePreferences, type FreeTimePreferences } from '@/lib/preferences/freeTime';
import { openQuickAdd } from '@/lib/quickAdd';
import { openShiftManager } from '@/lib/shifts/ui';
import { buildTodayDashboard, type TodayScheduleItem, type TodayTaskItem } from '@/lib/today';
import { useStore } from '@/store';
import type { Task } from '@/types';

function formatTime(date: Date) { return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatDuration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return [hours ? `${hours}시간` : '', rest ? `${rest}분` : ''].filter(Boolean).join(' ') || '0분'; }
function relativeDuration(milliseconds: number) { return formatDuration(Math.max(0, Math.ceil(milliseconds / 60_000))); }

export default function TodayDashboard() {
  const init = useStore((state) => state.init);
  const initialized = useStore((state) => state.initialized);
  const tasks = useStore((state) => state.tasks);
  const assignments = useStore((state) => state.shiftAssignments);
  const shiftTypes = useStore((state) => state.shiftTypes);
  const [now, setNow] = useState<Date | null>(null);
  const [preferences, setPreferences] = useState<FreeTimePreferences>(DEFAULT_FREE_TIME_PREFERENCES);
  const [drawerTask, setDrawerTask] = useState<string | null>(null);

  useEffect(() => { if (!initialized) void init(); }, [init, initialized]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const readNow = () => setNow(new Date());
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 60_050 - (Date.now() % 60_000));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') readNow(); };
    tick();
    window.addEventListener('focus', readNow);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); window.removeEventListener('focus', readNow); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => {
    setPreferences(getFreeTimePreferences());
    const update = (event: Event) => setPreferences((event as CustomEvent<FreeTimePreferences>).detail || getFreeTimePreferences());
    window.addEventListener(FREE_TIME_PREFERENCES_EVENT, update as EventListener);
    return () => window.removeEventListener(FREE_TIME_PREFERENCES_EVENT, update as EventListener);
  }, []);

  const data = useMemo(() => now ? buildTodayDashboard({ tasks: Object.values(tasks), assignments: Object.values(assignments), shiftTypes, preferences, now }) : null, [tasks, assignments, shiftTypes, preferences, now]);

  if (!initialized || !now || !data) return <div className="mx-auto max-w-6xl py-10" aria-live="polite"><div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" /><p className="mt-3 text-sm text-gray-500">오늘 일정을 불러오는 중입니다.</p></div>;

  const visibleFocusTasks = data.focusTasks.slice(0, 6);
  return <div className="mx-auto max-w-6xl py-6 sm:py-8">
    <header className="flex flex-col gap-4 border-b border-gray-100 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-blue-600">오늘</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</h1>
        <p className="mt-2 text-sm text-gray-500">{formatTime(now)} 기준 · 오늘의 행동을 한눈에 확인하세요.</p>
      </div>
      <button type="button" className="btn btn-primary min-h-11 justify-center sm:self-center" onClick={() => openQuickAdd('')} aria-label="일정 또는 할 일 추가"><Plus className="h-4 w-4" />일정 또는 할 일 추가</button>
    </header>

    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300" aria-label="오늘 요약">
      <span>{data.shift.type ? `근무 ${data.shift.type.code}` : '근무 미입력'}</span>
      <span>일정 {data.schedule.length}개</span>
      <span>중요 할 일 {data.focusTasks.length}개</span>
      <span className="font-medium text-slate-900 dark:text-white">남은 여유시간 {formatDuration(data.remainingFreeMinutes)}</span>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] lg:items-start">
      <div className="space-y-6">
        <ShiftSection data={data.shift} now={now} dateKey={data.dateKey} />
        <NextSchedule item={data.nextSchedule} state={data.nextScheduleState} now={now} onOpen={setDrawerTask} />
        <Section title="오늘 일정" icon={<CalendarDays className="h-4 w-4" />} count={data.schedule.length}>
          {data.schedule.length ? <div className="divide-y divide-gray-100 dark:divide-slate-800">{data.schedule.map((item) => <ScheduleRow key={item.id} item={item} onOpen={setDrawerTask} />)}</div> : <Empty text="오늘 일정이 없습니다." />}
        </Section>
        {data.currentFreeTime && data.doNowTasks.length > 0 && <Section title="지금 할 수 있는 일" icon={<Sparkles className="h-4 w-4" />}>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">현재 빈 시간 {formatTime(data.currentFreeTime.start)}–{formatTime(data.currentFreeTime.end)} · {formatDuration(data.currentFreeTime.durationMinutes)}</p>
          <div className="space-y-2">{data.doNowTasks.map((item) => <TaskLine key={item.task.id} item={item} onOpen={setDrawerTask} suffix={item.fitsCurrentFreeTime ? '완료 가능' : '일부 진행 가능'} />)}</div>
        </Section>}
      </div>

      <div className="space-y-6">
        <Section title="오늘 남은 빈 시간" icon={<Clock3 className="h-4 w-4" />} aside={`총 ${formatDuration(data.remainingFreeMinutes)}`}>
          {data.remainingFreeTime.length ? <div className="space-y-2">{data.remainingFreeTime.map((interval) => <div key={interval.start.toISOString()} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-slate-800"><span className="tabular-nums font-medium">{formatTime(interval.start)}–{formatTime(interval.end)}</span><span className="text-xs text-gray-500">{formatDuration(interval.durationMinutes)}</span></div>)}</div> : <Empty text="오늘 남은 빈 시간이 없습니다." />}
          <p className="mt-3 text-xs text-gray-500">오늘 전체 여유시간 {formatDuration(data.totalFreeMinutes)} · {preferences.dayStartTime}–{preferences.dayEndTime}</p>
        </Section>

        {data.shortageTasks.length > 0 && <Section title="부족 시간 경고" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
          <div className="space-y-2" role="status">{data.shortageTasks.map((item) => <button type="button" key={item.task.id} className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500" onClick={() => setDrawerTask(item.task.id)}><span className="block font-medium">{item.task.title}</span><span>마감 전 필요한 시간이 {formatDuration(item.shortageMinutes)} 부족합니다.</span></button>)}</div>
        </Section>}

        <Section title="마감 임박" icon={<ListTodo className="h-4 w-4" />} count={data.urgentTasks.length}>
          {data.urgentTasks.length ? <div className="space-y-2">{data.urgentTasks.slice(0, 5).map((item) => <TaskLine key={item.task.id} item={item} onOpen={setDrawerTask} />)}</div> : <Empty text="3일 이내 마감되는 할 일이 없습니다." />}
        </Section>

        <Section title="오늘 할 일" icon={<CheckCircle2 className="h-4 w-4" />} count={data.focusTasks.length}>
          {visibleFocusTasks.length ? <div className="space-y-2">{visibleFocusTasks.map((item) => <TaskLine key={item.task.id} item={item} onOpen={setDrawerTask} />)}</div> : <Empty text="오늘 확인할 미완료 할 일이 없습니다." />}
          {data.completedTodayCount > 0 && <details className="mt-3 text-sm text-gray-500"><summary className="min-h-10 cursor-pointer py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">오늘 완료 {data.completedTodayCount}개</summary><p className="pl-1 text-xs">완료한 할 일은 기본 목록에서 숨겼습니다.</p></details>}
        </Section>
      </div>
    </div>
    <TaskDetailsDrawer open={Boolean(drawerTask)} taskId={drawerTask} onClose={() => setDrawerTask(null)} />
  </div>;
}

function Section({ title, icon, count, aside, children }: { title: string; icon: ReactNode; count?: number; aside?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">{icon}{title}{count != null && <span className="text-xs font-normal text-gray-500">{count}</span>}</h2>{aside && <span className="text-sm font-medium">{aside}</span>}</div>
    {children}
  </section>;
}

function Empty({ text }: { text: string }) { return <p className="py-2 text-sm text-gray-500">{text}</p>; }

function ShiftSection({ data, now, dateKey }: { data: ReturnType<typeof buildTodayDashboard>['shift']; now: Date; dateKey: string }) {
  const type = data.type;
  const previousEndsToday = data.previousInterval && data.previousInterval.end > new Date(new Date(now).setHours(0, 0, 0, 0));
  let status = '근무 정보가 없습니다.';
  if (data.status === 'off') status = '오늘은 오프입니다.';
  else if (data.status === 'active' && data.interval) status = `근무 중 · ${formatTime(data.interval.end)}까지 ${relativeDuration(data.interval.end.getTime() - now.getTime())} 남음`;
  else if (data.status === 'upcoming' && data.interval) status = `${formatTime(data.interval.start)} 시작 예정`;
  else if (data.status === 'ended') status = '오늘 근무가 종료되었습니다.';
  else if (data.status === 'previous-active' && data.previousInterval) status = `전날 나이트 근무 중 · ${formatTime(data.previousInterval.end)} 종료`;
  const time = type?.isOff ? '근무시간 없음' : type ? `${type.startTime}–${type.crossesMidnight ? '익일 ' : ''}${type.endTime}` : undefined;
  return <Section title="오늘 근무" icon={<BriefcaseMedical className="h-4 w-4" />}>
    <button type="button" className="group flex min-h-14 w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => openShiftManager(dateKey)} aria-label="오늘 근무 입력 또는 변경">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{type ? <><span className="category-hospital"><span className="category-dot inline-block" aria-hidden="true" /></span><span className="text-lg font-semibold">{type.code} · {type.name}</span></> : <span className="text-lg font-semibold">근무 없음</span>}</div>{time && <p className="mt-1 text-sm tabular-nums text-gray-600 dark:text-gray-300">{time}</p>}<p className="mt-1 text-sm text-gray-500">{status}</p>{previousEndsToday && data.status !== 'previous-active' && data.previousType && <p className="mt-1 text-xs text-gray-500">전날 {data.previousType.code} · 오늘 {formatTime(data.previousInterval!.end)} 종료</p>}</div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5" />
    </button>
  </Section>;
}

function NextSchedule({ item, state, now, onOpen }: { item?: TodayScheduleItem; state?: 'upcoming' | 'active'; now: Date; onOpen: (taskId: string) => void }) {
  return <Section title={state === 'active' ? '진행 중' : '다음 일정'} icon={<Clock3 className="h-4 w-4" />}>
    {item ? <button type="button" className="group flex min-h-14 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => onOpen(item.taskId)}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xl font-semibold tabular-nums">{formatTime(item.start)}</span><span className="truncate font-medium">{item.title}</span></div><p className="mt-1 text-sm text-gray-500">{formatTime(item.start)}–{formatTime(item.end)} · {state === 'active' ? `${relativeDuration(item.end.getTime() - now.getTime())} 후 종료` : `${relativeDuration(item.start.getTime() - now.getTime())} 후`}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5" /></button> : <Empty text="남은 일정이 없습니다." />}
  </Section>;
}

function ScheduleRow({ item, onOpen }: { item: TodayScheduleItem; onOpen: (taskId: string) => void }) {
  return <button type="button" className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => onOpen(item.taskId)}>
    <span className="w-[5.5rem] shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-300">{item.allDay ? '종일' : `${formatTime(item.start)}–${formatTime(item.end)}`}</span>
    <span className="min-w-0 flex-1"><span className={`block truncate font-medium ${item.completed ? 'text-gray-400 line-through' : ''}`}>{item.title}</span><span className="mt-1 flex flex-wrap items-center gap-2"><CategoryBadge category={item.category} /><span className="text-xs text-gray-500">{item.kind === 'task' ? '할 일' : '일정'}{item.location ? ` · ${item.location}` : ''}</span></span></span>
  </button>;
}

function TaskLine({ item, onOpen, suffix }: { item: TodayTaskItem; onOpen: (taskId: string) => void; suffix?: string }) {
  return <button type="button" className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800" onClick={() => onOpen(item.task.id)}>
    <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.task.title}</span>{item.task.priority === 'high' && <span className="text-xs font-medium text-rose-600">높음</span>}</span>
    <span className="mt-1 block text-xs text-gray-500">{deadlineLabel(item)}{item.task.estimatedMinutes ? ` · 남은 작업 ${formatDuration(item.remainingMinutes)}` : ''}{suffix ? ` · ${suffix}` : ''}</span>
  </button>;
}

function deadlineLabel(item: TodayTaskItem): string {
  if (item.deadlineDayOffset == null) return item.hasTodayRange ? '오늘 배치됨' : '마감 미정';
  if (item.deadlineDayOffset < 0) return '기한 지남';
  if (item.deadlineDayOffset === 0) return '오늘까지';
  if (item.deadlineDayOffset === 1) return '내일까지';
  if (item.deadlineDayOffset <= 3) return `${item.deadlineDayOffset}일 이내`;
  return item.deadline ? item.deadline.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '마감 미정';
}
