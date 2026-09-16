import { useEffect, useState } from 'react';
import { deviceZone, todayIn } from '../../shared/clock';

/** How often the date is re-checked. Cheap enough to leave running. */
const TICK_MS = 60_000;

/**
 * Today's date in a zone, kept current while the page stays open.
 *
 * A board left up on a table overnight should roll its counters over by
 * itself rather than waiting for somebody to reload. Polling the minute is
 * simpler and more obviously right than working out when the zone's midnight
 * falls, and React drops the re-render on every tick that returns the same
 * string, which is all but one a day.
 */
export function useToday(zone?: string): string {
  const [today, setToday] = useState(() => todayIn(zone));

  useEffect(() => {
    setToday(todayIn(zone));
    const timer = setInterval(() => setToday(todayIn(zone)), TICK_MS);
    return () => clearInterval(timer);
  }, [zone]);

  return today;
}

/**
 * Every zone this browser knows, with the board's own kept in the list.
 *
 * A board carrying a zone an older browser has never heard of would otherwise
 * drop out of its own picker, and picking anything else would silently move
 * the whole table's clock.
 */
export function zoneOptions(current?: string): string[] {
  const keep = (list: string[]) => {
    const zone = current || deviceZone();
    return list.includes(zone) ? list : [zone, ...list];
  };
  const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (typeof all === 'function') {
    try {
      return keep(all('timeZone'));
    } catch {
      // Falls through to the short list.
    }
  }
  return keep([deviceZone(), 'UTC']);
}
