export function localDateTimeToISO(date: string, time: string, addDay = false): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) throw new Error('날짜와 시간을 확인해 주세요.');
  if (Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) throw new Error('시간이 올바르지 않습니다.');
  const value = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]) + (addDay ? 1 : 0), Number(timeMatch[1]), Number(timeMatch[2]));
  if (!addDay && (value.getFullYear() !== Number(dateMatch[1]) || value.getMonth() !== Number(dateMatch[2]) - 1 || value.getDate() !== Number(dateMatch[3]))) throw new Error('날짜가 올바르지 않습니다.');
  return value.toISOString();
}

export function isEndOnNextDay(startTime: string, endTime: string): boolean { return endTime <= startTime; }
