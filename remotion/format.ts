// Numbers on screen: thousands separators from 10,000 up (so years like 1789 stay as they are), and exactly the
// given number of decimals. A number that rounds to zero shows as 0, so a negative one counting up from zero does
// not start at "-0" or "-0.0".
export function formatNumber(value: number, decimals = 0): string {
  const shown = Math.abs(value) < 0.5 / 10 ** decimals ? 0 : value;
  return shown.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: Math.abs(shown) >= 10_000,
  });
}

// A number partway through counting up to `target`, with as many decimals as the target has, so the last frame
// shows exactly the number that was checked: 0.04 stays 0.04 and 99.97 stays 99.97.
export function countUp(target: number, progress: number): string {
  const decimals = Math.min(4, (String(target).split(".")[1] ?? "").length);
  return formatNumber(target * progress, decimals);
}

// Years before year 1 are shown as "BC". A span across year 1 says "AD" at its end: "206 BC–220 AD".
export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : String(year);
}

export function formatYears(first: number, last: number): string {
  if (first === last) return formatYear(first);
  return `${formatYear(first)}–${formatYear(last)}${first < 0 && last > 0 ? " AD" : ""}`;
}
