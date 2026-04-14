import { format, parseISO } from 'date-fns';
import { toDate, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const TIMEZONE = 'America/Porto_Velho';

/**
 * Parses a date string (YYYY-MM-DD or ISO) and treats it as being in the Porto Velho timezone.
 * Useful for extracting the day of the week correctly.
 */
export const parseToRODate = (date: Date | string | null | undefined): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  
  // If it's just a YYYY-MM-DD string, append the start of day in the correct timezone
  if (typeof date === 'string' && date.length === 10 && date.includes('-')) {
    return toDate(`${date} 00:00:00`, { timeZone: TIMEZONE });
  }
  
  return toDate(date, { timeZone: TIMEZONE });
};

/**
 * Returns the current date/time adjusted to Porto Velho.
 */
export const getRONow = (): Date => {
  return toDate(new Date(), { timeZone: TIMEZONE });
};

/**
 * Formats a date using Porto Velho timezone.
 */
export const formatRO = (date: Date | string, formatStr: string): string => {
  const d = typeof date === 'string' ? parseToRODate(date) : date;
  return formatInTimeZone(d, TIMEZONE, formatStr);
};

/**
 * Gets the current date string (YYYY-MM-DD) in Porto Velho.
 */
export const getROTodayStr = (): string => {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
};
