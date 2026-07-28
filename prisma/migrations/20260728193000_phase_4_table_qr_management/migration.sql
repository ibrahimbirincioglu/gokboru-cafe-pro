-- Existing tables are preserved. Their QR values are populated by the idempotent seed
-- or by the first explicit QR renewal in the admin panel.
ALTER TABLE "Table"
  ADD COLUMN "qrTokenHash" TEXT,
  ADD COLUMN "qrTokenEncrypted" TEXT,
  ADD COLUMN "qrTokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "qrRotatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Table_qrTokenHash_key" ON "Table"("qrTokenHash");
