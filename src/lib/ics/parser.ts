import ICAL from 'ical.js';
import type { IcsParseOptions, IcsParseResult, ParsedIcsEvent } from './types';

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

type IcalComponent = InstanceType<typeof ICAL.Component>;
type IcalEvent = InstanceType<typeof ICAL.Event>;
type IcalTime = InstanceType<typeof ICAL.Time>;

function sourceId(name: string): string {
  let hash = 2166136261;
  for (const char of name) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `ics-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizedColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  return match ? `#${match[1].toUpperCase()}` : undefined;
}

function componentText(component: IcalComponent, name: string): string | undefined {
  const value = component.getFirstPropertyValue(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function propertyTimeZone(component: IcalComponent, propertyName: string): string | undefined {
  const property = component.getFirstProperty(propertyName);
  const value = property?.getParameter('tzid');
  return typeof value === 'string' && value ? value : undefined;
}

function partsAt(epochMs: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const entries = Object.fromEntries(formatter.formatToParts(new Date(epochMs)).map((part) => [part.type, part.value]));
  return {
    year: Number(entries.year), month: Number(entries.month), day: Number(entries.day),
    hour: Number(entries.hour), minute: Number(entries.minute), second: Number(entries.second),
  };
}

function wallTimeToUtc(time: IcalTime, timeZone: string): number {
  const desired = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(guess, timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desired - actualAsUtc;
  }
  return guess;
}

function timeToIso(time: IcalTime, propertyTzid: string | undefined, defaultTimeZone: string): string {
  if (time.isDate) {
    const epoch = Date.UTC(time.year, time.month - 1, time.day) - SEOUL_OFFSET_MS;
    return new Date(epoch).toISOString();
  }
  const zoneId = time.zone?.tzid;
  if (zoneId && zoneId !== 'floating' && zoneId !== 'local') {
    return new Date(time.toUnixTime() * 1000).toISOString();
  }
  const requestedZone = propertyTzid || defaultTimeZone;
  try {
    return new Date(wallTimeToUtc(time, requestedZone)).toISOString();
  } catch {
    return new Date(wallTimeToUtc(time, SEOUL_TIME_ZONE)).toISOString();
  }
}

function recurrenceMetadata(component: IcalComponent): string | undefined {
  const lines = ['rrule', 'rdate', 'exdate']
    .flatMap((name) => component.getAllProperties(name))
    .map((property) => property.toICALString());
  return lines.length ? lines.join('\n') : undefined;
}

function statusOf(event: IcalEvent): string {
  return String(event.component.getFirstPropertyValue('status') || '').toUpperCase();
}

function buildParsedEvent(
  item: IcalEvent,
  occurrence: IcalTime | null,
  start: IcalTime,
  end: IcalTime,
  uid: string,
  recurrenceRule: string | undefined,
  sourceCalendar: string,
  defaultTimeZone: string,
): ParsedIcsEvent {
  const warnings: string[] = [];
  const startTzid = propertyTimeZone(item.component, 'dtstart');
  const endTzid = propertyTimeZone(item.component, 'dtend') || startTzid;
  const recurrenceTzid = propertyTimeZone(item.component, 'recurrence-id') || startTzid;
  const startIso = timeToIso(start, startTzid, defaultTimeZone);
  const endIso = timeToIso(end, endTzid, defaultTimeZone);
  // A standalone VEVENT is identified by UID alone. Recurring instances add
  // their original occurrence id so a moved exception remains the same item.
  const recurrenceId = occurrence ? timeToIso(occurrence, recurrenceTzid, defaultTimeZone) : '';
  if (!startTzid && start.zone?.tzid === 'floating' && !start.isDate) {
    warnings.push(`${defaultTimeZone} 현지 시각으로 해석했습니다.`);
  }
  if (Date.parse(endIso) <= Date.parse(startIso)) warnings.push('종료 시각이 시작 시각보다 늦지 않아 가져올 수 없습니다.');
  const title = item.summary?.trim() || '(제목 없음)';
  return {
    key: `${uid}\u001f${recurrenceId}`,
    uid,
    recurrenceId,
    title,
    description: item.description?.trim() || undefined,
    location: item.location?.trim() || undefined,
    start: startIso,
    end: endIso,
    allDay: !!start.isDate,
    recurrenceRule,
    sourceCalendar,
    warnings,
    importable: Date.parse(endIso) > Date.parse(startIso),
  };
}

function registerEmbeddedTimeZones(calendar: IcalComponent): void {
  for (const component of calendar.getAllSubcomponents('vtimezone')) {
    const timezone = new ICAL.Timezone({ component });
    if (timezone.tzid) ICAL.TimezoneService.register(timezone, timezone.tzid);
  }
}

export function parseAppleIcs(text: string, options: IcsParseOptions): IcsParseResult {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('올바른 iCalendar 파일이 아닙니다.');
  const root = new ICAL.Component(ICAL.parse(text));
  registerEmbeddedTimeZones(root);
  const defaultTimeZone = options.defaultTimeZone || SEOUL_TIME_ZONE;
  const calendarName = componentText(root, 'x-wr-calname') || 'Apple Calendar';
  const calendarColor = normalizedColor(componentText(root, 'x-apple-calendar-color'));
  const calendar = { id: sourceId(calendarName), name: calendarName, color: calendarColor };
  const components = root.getAllSubcomponents('vevent');
  const masters = components.filter((component) => !component.hasProperty('recurrence-id'));
  const exceptions = components.filter((component) => component.hasProperty('recurrence-id'));
  const handledExceptions = new Set<IcalComponent>();
  const events: ParsedIcsEvent[] = [];
  const warnings: string[] = [];
  const from = Date.parse(`${options.recurringFrom}T00:00:00+09:00`);
  const to = Date.parse(`${options.recurringTo}T23:59:59.999+09:00`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error('반복 일정 가져오기 기간이 올바르지 않습니다.');
  const maxOccurrences = options.maxOccurrences ?? 10_000;

  for (const masterComponent of masters) {
    const uid = String(masterComponent.getFirstPropertyValue('uid') || '').trim();
    if (!uid) { warnings.push('UID가 없는 일정 1개를 건너뛰었습니다.'); continue; }
    const related = exceptions.filter((component) => String(component.getFirstPropertyValue('uid') || '').trim() === uid);
    related.forEach((component) => handledExceptions.add(component));
    const master = new ICAL.Event(masterComponent, { strictExceptions: true, exceptions: related });
    if (statusOf(master) === 'CANCELLED') continue;
    const rule = recurrenceMetadata(masterComponent);
    if (!master.isRecurring()) {
      events.push(buildParsedEvent(master, null, master.startDate, master.endDate, uid, rule, calendar.name, defaultTimeZone));
      continue;
    }
    const iterator = master.iterator();
    let occurrence: IcalTime | null;
    let count = 0;
    while ((occurrence = iterator.next())) {
      const occurrenceTzid = propertyTimeZone(masterComponent, 'dtstart');
      const occurrenceMs = Date.parse(timeToIso(occurrence, occurrenceTzid, defaultTimeZone));
      if (occurrenceMs > to) break;
      if (occurrenceMs < from) continue;
      count += 1;
      if (count > maxOccurrences) {
        warnings.push(`${master.summary || uid}: 반복 일정이 ${maxOccurrences.toLocaleString()}개를 넘어 나머지를 생략했습니다.`);
        break;
      }
      const details = master.getOccurrenceDetails(occurrence);
      if (statusOf(details.item) === 'CANCELLED') continue;
      events.push(buildParsedEvent(details.item, details.recurrenceId, details.startDate, details.endDate, uid, rule, calendar.name, defaultTimeZone));
    }
  }

  for (const component of exceptions) {
    if (handledExceptions.has(component)) continue;
    const event = new ICAL.Event(component);
    if (statusOf(event) === 'CANCELLED') continue;
    const uid = String(event.uid || '').trim();
    if (!uid) continue;
    warnings.push(`${event.summary || uid}: 원본 반복 일정이 없어 예외 일정을 단일 일정으로 처리했습니다.`);
    events.push(buildParsedEvent(event, event.recurrenceId || event.startDate, event.startDate, event.endDate, uid, undefined, calendar.name, defaultTimeZone));
  }

  events.sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
  return { calendar, events, warnings };
}
