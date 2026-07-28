export class EventDeduplicator {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly limit = 200) {}

  accept(eventId: string) {
    if (!eventId || this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.limit) {
      this.seen.delete(this.order.shift()!);
    }
    return true;
  }
}

export function reconnectDelay(attempt: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
}
