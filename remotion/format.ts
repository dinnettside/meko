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
