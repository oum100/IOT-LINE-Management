ALTER TABLE "DeviceCommand"
  ADD COLUMN "commandRef" TEXT,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DeviceCommand_commandRef_key" ON "DeviceCommand"("commandRef");
CREATE INDEX "DeviceCommand_status_queuedAt_idx" ON "DeviceCommand"("status", "queuedAt");
CREATE INDEX "DeviceCommand_status_nextRetryAt_idx" ON "DeviceCommand"("status", "nextRetryAt");

ALTER TABLE "DeviceCommand"
  ADD CONSTRAINT "DeviceCommand_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
