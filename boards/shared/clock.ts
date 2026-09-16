/**
 * What day it is, for the whiteboard.
 *
 * All of it works in plain calendar days - 'YYYY-MM-DD' - rather than in
 * instants. A day counter is asking a calendar question, not a clock one:
 * "how many days since" should not come out one short because the anchor was
 * recorded at 11pm, and it must not shift by an hour twice a year. Turning
 * the current instant into a day once, in the board's zone, and then doing
 * whole-day arithmetic from there avoids both.
 */

import type { BoardLine } from './types';

const DAY_MS = 86_400_000;
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day. Rejects the 31st of February and the like. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_SHAPE.test(value)) return false;
  // Parsing alone is not enough: an impossible day rolls over into the next
  // month rather than being refused, so 2026-02-31 comes back as 3 March and
  // a counter anchored to it would quietly be two days out. Only a round trip
  // catches it.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** True for a zone name this runtime actually knows. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The zone of whatever device is asking. */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Today's date in a given zone. An unknown or missing zone falls back to the
 * device rather than throwing: a board carrying a zone name this browser has
 * never heard of should still show a date.
 */
export function todayIn(zone?: string, now: Date = new Date()): string {
  const parts = (tz: string | undefined) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

  let fields;
  try {
    fields = parts(zone);
  } catch {
    fields = parts(undefined);
  }
  const pick = (type: string) => fields.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Whole days from one calendar day to another. Negative means `to` is first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** A calendar day written out, e.g. "Fri, 11 Sep 2026". */
export function formatCalendarDate(date: string, locale?: string): string {
  if (!isCalendarDate(date)) return '';
  // Pinned to UTC because the instant above was built at UTC midnight; any
  // other zone here would drag the display back a day for half the world.
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * What a line reads as today.
 *
 * A count says "12 days" looking back and "in 12 days" looking forward, so
 * one kind of line serves both "days since" and "days until" and the label
 * beside it is free to say which.
 */
export function lineValue(line: BoardLine, today: string, locale?: string): string {
  if (line.kind === 'date') return formatCalendarDate(today, locale);
  if (!isCalendarDate(line.date)) return 'set a date';
  const gap = daysBetween(line.date, today);
  if (gap === 0) return 'today';
  if (gap > 0) return gap === 1 ? '1 day' : `${gap} days`;
  const ahead = -gap;
  return ahead === 1 ? 'in 1 day' : `in ${ahead} days`;
}
