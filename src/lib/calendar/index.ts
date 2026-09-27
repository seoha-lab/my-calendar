import { localCalendarProvider } from './LocalCalendarProvider';
import type { CalendarService } from './CalendarProvider';
export const calendarService: CalendarService = localCalendarProvider;
