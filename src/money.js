const SCALE = 1_000_000;

export function formatUsd(units) {
  const value = Number(units);
  if (!Number.isFinite(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / SCALE);
  const frac = String(Math.floor(abs % SCALE)).padStart(6, "0").replace(/0+$/, "");
  return frac ? `${sign}$${whole}.${frac}` : `${sign}$${whole}`;
}

export function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}
