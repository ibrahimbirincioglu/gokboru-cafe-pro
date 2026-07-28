-- All new columns on existing orders are nullable to preserve production data.
ALTER TABLE "Order"
  ADD COLUMN "guestSessionId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "publicTokenHash" TEXT,
  ADD COLUMN "publicTokenEncrypted" TEXT;

CREATE TABLE "GuestSession" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "qrTokenVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItemOption" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "optionId" TEXT,
  "optionNameSnapshot" TEXT NOT NULL,
  "priceDeltaSnapshot" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE INDEX "GuestSession_tableId_expiresAt_idx" ON "GuestSession"("tableId", "expiresAt");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE UNIQUE INDEX "Order_publicTokenHash_key" ON "Order"("publicTokenHash");
CREATE INDEX "Order_guestSessionId_createdAt_idx" ON "Order"("guestSessionId", "createdAt");
CREATE INDEX "OrderItemOption_orderItemId_idx" ON "OrderItemOption"("orderItemId");
CREATE INDEX "OrderItemOption_optionId_idx" ON "OrderItemOption"("optionId");

ALTER TABLE "GuestSession"
  ADD CONSTRAINT "GuestSession_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_guestSessionId_fkey"
  FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItemOption"
  ADD CONSTRAINT "OrderItemOption_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItemOption"
  ADD CONSTRAINT "OrderItemOption_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
