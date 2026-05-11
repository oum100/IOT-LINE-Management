CREATE TYPE "PaymentMethod" AS ENUM ('INTERNAL_QR', 'PROVIDER_QR', 'CASH_DEVICE');

ALTER TABLE "Payment"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'INTERNAL_QR',
  ADD COLUMN "deviceEventRef" TEXT;

CREATE INDEX "Payment_deviceEventRef_idx" ON "Payment"("deviceEventRef");
