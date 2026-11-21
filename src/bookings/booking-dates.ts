const EL_SALVADOR_TIME_ZONE = 'America/El_Salvador';

export function getTodayInElSalvador(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EL_SALVADOR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

