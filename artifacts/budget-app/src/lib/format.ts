/**
 * Formats a number to Israeli New Shekel (ILS)
 */
export function formatILS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '₪0';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formats a date string to an Israeli date format (DD/MM/YYYY)
 */
export function formatILDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Formats a date string to month and year (e.g. מאי 2024)
 */
export function formatILMonthYear(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}
