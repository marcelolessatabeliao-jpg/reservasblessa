import { format, parseISO } from 'date-fns';
import { toDate, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const TIMEZONE = 'America/Porto_Velho';

/**
 * Parses a date string (YYYY-MM-DD or ISO) and treats it as being in the Porto Velho timezone.
 * Useful for extracting the day of the week correctly.
 */
export const parseToRODate = (date: Date | string | null | undefined): Date => {
  if (!date) return new Date();
  
  let dateStr = "";
  if (date instanceof Date) {
    // Extrai ano, mês e dia da data local escolhida pelo usuário
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  } else {
    dateStr = date.split('T')[0];
  }
  
  // Always create a new Date at midnight in the target timezone
  return toDate(`${dateStr} 00:00:00`, { timeZone: TIMEZONE });
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
