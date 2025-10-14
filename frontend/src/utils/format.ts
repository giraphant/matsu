/**
 * Formatting utility functions
 */

/**
 * Format a value with unit and decimal places
 */
export function formatValue(
  value: number | null,
  unit: string | null,
  decimalPlaces?: number
): string {
  if (value === null) return 'N/A';

  // Use ?? to properly handle 0 decimal places (|| would treat 0 as falsy)
  const places = decimalPlaces ?? 2;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: places,
    maximumFractionDigits: places
  });

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format timestamp to "time ago" string
 */
export function formatTimeSince(timestamp: string): string {
  const now = new Date();
  // Database stores UTC time without 'Z' suffix, so we need to append it
  const timestampUTC = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  const then = new Date(timestampUTC);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
