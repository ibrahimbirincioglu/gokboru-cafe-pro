const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function istanbulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function assertDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error("Geçersiz tarih.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Geçersiz tarih.");
  }
  return value;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${assertDate(date)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function reportRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  now = new Date(),
) {
  const today = istanbulDate(now);
  if (preset === "week") {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
    return { preset: "week", from: addDays(today, 1 - weekday), to: today };
  }
  if (preset === "month") {
    return { preset: "month", from: `${today.slice(0, 7)}-01`, to: today };
  }
  if (preset === "custom") {
    const safeFrom = assertDate(from ?? "");
    const safeTo = assertDate(to ?? "");
    if (safeFrom > safeTo || addDays(safeFrom, 366) < safeTo) {
      throw new Error("Tarih aralığı 366 günü aşamaz.");
    }
    return { preset: "custom", from: safeFrom, to: safeTo };
  }
  return { preset: "day", from: today, to: today };
}

export function istanbulUtcRange(from: string, to: string) {
  assertDate(from);
  assertDate(to);
  return {
    gte: new Date(`${from}T00:00:00+03:00`),
    lt: new Date(`${addDays(to, 1)}T00:00:00+03:00`),
  };
}
