/** "qui., 9 de out." / "Thu, Oct 9" — short, in the app's language. */
export function formatShortDate(isoDate: string, language: string): string {
  // `YYYY-MM-DD` is a local calendar date: build it at local midnight, not UTC.
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

/** "sábado, 10 de outubro" / "Saturday 10 October": today, for screen headers. */
export function formatToday(language: string): string {
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}
