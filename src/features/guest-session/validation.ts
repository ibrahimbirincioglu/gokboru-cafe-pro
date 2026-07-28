export function isGuestSessionValid(
  session: {
    tableId: string;
    qrTokenVersion: number;
    expiresAt: Date;
  },
  table: { id: string; qrTokenVersion: number },
  now: Date,
) {
  return (
    session.expiresAt > now &&
    session.tableId === table.id &&
    session.qrTokenVersion === table.qrTokenVersion
  );
}
