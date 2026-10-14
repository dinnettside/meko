// Numbers on screen: thousands separators from 10,000 up (so years like 1789 stay as they are), at most one decimal.
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Math.abs(rounded) >= 10_000 ? rounded.toLocaleString("en-US") : String(rounded);
}

// A number partway through counting up to `target`, with the same kind of decimals as the target.
export function countUp(target: number, progress: number): string {
  const current = target * progress;
  return formatNumber(Number.isInteger(target) ? Math.round(current) : current);
}

// Years before year 1 are shown as "BC". A span across year 1 says "AD" at its end: "206 BC–220 AD".
export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : String(year);
}

export function formatYears(first: number, last: number): string {
  if (first === last) return formatYear(first);
  return `${formatYear(first)}–${formatYear(last)}${first < 0 && last > 0 ? " AD" : ""}`;
}
