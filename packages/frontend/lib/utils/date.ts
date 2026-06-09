/**
 * Standard date formatting options using Intl.DateTimeFormat
 */
export const DATE_FORMATS = {
  SHORT: { month: 'short', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions,
  LONG: { month: 'long', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions,
  DATETIME: { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  } as Intl.DateTimeFormatOptions,
};

/**
 * Formats a date string or Date object into a standard format
 */
export function formatDate(
  date: string | Date | null | undefined, 
  options: Intl.DateTimeFormatOptions = DATE_FORMATS.SHORT
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Formats a date for form inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  return d.toISOString().split('T')[0];
}

/**
 * Formats a date with time
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, DATE_FORMATS.DATETIME);
}
