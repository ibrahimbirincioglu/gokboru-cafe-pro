export const ORDER_STATUS_SEQUENCE = [
  "BEKLIYOR",
  "ONAYLANDI",
  "HAZIRLANIYOR",
  "HAZIR",
  "TAMAMLANDI",
] as const;

export type ManagedOrderStatus = (typeof ORDER_STATUS_SEQUENCE)[number];

export function nextOrderStatus(status: string): ManagedOrderStatus | null {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status as ManagedOrderStatus);
  if (index < 0 || index === ORDER_STATUS_SEQUENCE.length - 1) return null;
  return ORDER_STATUS_SEQUENCE[index + 1] ?? null;
}

export function isValidOrderTransition(from: string, to: string) {
  return nextOrderStatus(from) === to;
}

export function orderItemStatusFor(orderStatus: ManagedOrderStatus) {
  switch (orderStatus) {
    case "BEKLIYOR":
      return "BEKLIYOR" as const;
    case "ONAYLANDI":
      return "ONAYLANDI" as const;
    case "HAZIRLANIYOR":
      return "HAZIRLANIYOR" as const;
    case "HAZIR":
      return "HAZIR" as const;
    case "TAMAMLANDI":
      return "SERVIS_EDILDI" as const;
  }
}

export function orderStatusTimestamp(status: ManagedOrderStatus, now: Date) {
  switch (status) {
    case "ONAYLANDI":
      return { acceptedAt: now };
    case "HAZIRLANIYOR":
      return { preparingAt: now };
    case "HAZIR":
      return { readyAt: now };
    case "TAMAMLANDI":
      return { completedAt: now };
    default:
      return {};
  }
}
