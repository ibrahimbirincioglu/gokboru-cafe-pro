-- Additive Phase 7 fields. Existing sessions and payments are preserved.
ALTER TABLE "TableSession"
ADD COLUMN "discountByUserId" TEXT,
ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "discountReason" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "subtotal" DECIMAL(12,2);

UPDATE "Payment" SET "subtotal" = "amount" WHERE "subtotal" IS NULL;

ALTER TABLE "Payment"
ALTER COLUMN "subtotal" SET NOT NULL,
ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "TableSession"
ADD CONSTRAINT "TableSession_discountByUserId_fkey"
FOREIGN KEY ("discountByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TableSession_discountByUserId_idx"
ON "TableSession"("discountByUserId");

-- Different idempotency keys racing to close the same table cannot both win.
CREATE UNIQUE INDEX "Payment_one_completed_per_session_key"
ON "Payment"("tableSessionId")
WHERE "status" = 'COMPLETED';
