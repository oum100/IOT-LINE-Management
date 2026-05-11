-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RUNNING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'SLIP_UPLOADED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SLIP_UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'REFUNDED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "EnvironmentMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "IotDeviceStatus" AS ENUM ('SPARE', 'IN_USE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MachineUnitStatus" AS ENUM ('SPARE', 'IN_USE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProductPricingType" AS ENUM ('STANDARD', 'PROMOTION', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('TIME', 'QUANTITY', 'UNIT');

-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('MINUTE', 'SECOND', 'LITER', 'GRAM', 'PIECE', 'BOX', 'SLOT');

-- CreateEnum
CREATE TYPE "DeviceBindingStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AppUserRole" AS ENUM ('ADMIN', 'USER', 'OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "UserScopeType" AS ENUM ('MERCHANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "DeviceKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DeviceRegistrationStatus" AS ENUM ('READY', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProviderServiceType" AS ENUM ('PAYMENT_GATEWAY', 'SLIP_VERIFY', 'BANK_API');

-- CreateEnum
CREATE TYPE "BillerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('PLATFORM_QR', 'PROVIDER_QR');

-- CreateEnum
CREATE TYPE "ExpenseTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "assetId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'AVAILABLE',
    "locationLabel" TEXT NOT NULL,
    "topic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remainingMinutes" INTEGER,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachinePrice" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MachinePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "paymentIntentPublicId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "lineUserId" TEXT,
    "note" TEXT,
    "selfCancelTokenHash" TEXT,
    "selfCancelTokenIssuedAt" TIMESTAMP(3),
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "machineId" TEXT,
    "assetId" TEXT NOT NULL,
    "productId" TEXT,
    "priceId" TEXT NOT NULL,
    "priceLabel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "serviceModeSnapshot" "ServiceMode",
    "unitSnapshot" "ServiceUnit",
    "quantitySnapshot" DECIMAL(12,3),
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "billerProfileId" TEXT,
    "providerCode" TEXT,
    "providerPaymentIntentId" TEXT,
    "providerReference" TEXT,
    "amount" INTEGER NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "rejectedNote" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biller_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "integrationMode" "IntegrationMode" NOT NULL DEFAULT 'PLATFORM_QR',
    "status" "BillerStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "providerConnectionId" TEXT,
    "billerId" TEXT,
    "shopId" TEXT,
    "accountName" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "promptPayTarget" TEXT,
    "slipVerifyConnectionId" TEXT,
    "credentials" JSONB,
    "config" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "providerServiceId" TEXT,
    "providerCode" TEXT NOT NULL,
    "status" "BillerStatus" NOT NULL DEFAULT 'ACTIVE',
    "baseUrl" TEXT,
    "appKey" TEXT,
    "appSecret" TEXT,
    "webhookSecret" TEXT,
    "supportsQrIssue" BOOLEAN NOT NULL DEFAULT false,
    "supportsCallback" BOOLEAN NOT NULL DEFAULT false,
    "supportsSlipVerify" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "serviceType" "ProviderServiceType" NOT NULL,
    "status" "BillerStatus" NOT NULL DEFAULT 'ACTIVE',
    "supportsQrGeneration" BOOLEAN NOT NULL DEFAULT false,
    "supportsConfirmCallback" BOOLEAN NOT NULL DEFAULT false,
    "supportsSingleTxnVerify" BOOLEAN NOT NULL DEFAULT false,
    "supportsSingleSlipVerify" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slip_verify_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "status" "BillerStatus" NOT NULL DEFAULT 'ACTIVE',
    "baseUrl" TEXT,
    "appKey" TEXT,
    "appSecret" TEXT,
    "webhookSecret" TEXT,
    "credentials" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slip_verify_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_biller_bindings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billerProfileId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_biller_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_biller_bindings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantAccountId" TEXT NOT NULL,
    "billerProfileId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_biller_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_biller_bindings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billerProfileId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_biller_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_kinds" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_kinds_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MerchantStatus" NOT NULL DEFAULT 'ACTIVE',
    "environment" "EnvironmentMode" NOT NULL DEFAULT 'TEST',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantAccountId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExpenseTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "expenseTypeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assetUuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "status" "MachineUnitStatus" NOT NULL DEFAULT 'SPARE',
    "brand" TEXT,
    "model" TEXT,
    "warrantyStartAt" TIMESTAMP(3),
    "warrantyEndAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "deviceUid" TEXT,
    "name" TEXT,
    "model" TEXT,
    "status" "IotDeviceStatus" NOT NULL DEFAULT 'SPARE',
    "fwVersion" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_bindings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "machineId" TEXT,
    "iotDeviceId" TEXT,
    "status" "DeviceBindingStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER,
    "durationMinutes" INTEGER,
    "serviceMode" "ServiceMode" NOT NULL DEFAULT 'TIME',
    "serviceUnit" "ServiceUnit" NOT NULL DEFAULT 'MINUTE',
    "quantity" DECIMAL(12,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_product_prices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "serviceMode" "ServiceMode" NOT NULL DEFAULT 'TIME',
    "serviceUnit" "ServiceUnit" NOT NULL DEFAULT 'MINUTE',
    "quantity" DECIMAL(12,3),
    "slotNo" INTEGER,
    "stockQty" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_product_offers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "pricingType" "ProductPricingType" NOT NULL DEFAULT 'STANDARD',
    "amount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "serviceMode" "ServiceMode" NOT NULL DEFAULT 'TIME',
    "serviceUnit" "ServiceUnit" NOT NULL DEFAULT 'MINUTE',
    "quantity" DECIMAL(12,3),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_product_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "tenantId" TEXT,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "providerRefundRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_items" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_audit_logs" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "fromStatus" "RefundStatus",
    "toStatus" "RefundStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "providerRefundRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantAccountId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "AppUserRole" NOT NULL DEFAULT 'USER',
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scope_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeType" "UserScopeType" NOT NULL,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_scope_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "device_api_keys" (
    "id" TEXT NOT NULL,
    "iotDeviceId" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "label" TEXT,
    "status" "DeviceKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_registration_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantAccountId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "status" "DeviceRegistrationStatus" NOT NULL DEFAULT 'READY',
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedByIotDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_registration_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "platform_bootstrap_audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bootstrap_mode" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_bootstrap_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE INDEX "Machine_tenantId_branchId_idx" ON "Machine"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "Machine_merchantAccountId_idx" ON "Machine"("merchantAccountId");

-- CreateIndex
CREATE INDEX "Machine_assetId_idx" ON "Machine"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_tenantId_branchId_createdAt_idx" ON "Order"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_merchantAccountId_createdAt_idx" ON "Order"("merchantAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentIntentPublicId_idx" ON "Order"("paymentIntentPublicId");

-- CreateIndex
CREATE INDEX "OrderItem_assetId_idx" ON "OrderItem"("assetId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_branchId_status_idx" ON "Payment"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Payment_merchantAccountId_status_idx" ON "Payment"("merchantAccountId", "status");

-- CreateIndex
CREATE INDEX "Payment_billerProfileId_status_idx" ON "Payment"("billerProfileId", "status");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentIntentId_idx" ON "Payment"("providerPaymentIntentId");

-- CreateIndex
CREATE INDEX "biller_profiles_tenantId_providerCode_integrationMode_statu_idx" ON "biller_profiles"("tenantId", "providerCode", "integrationMode", "status", "priority");

-- CreateIndex
CREATE INDEX "biller_profiles_providerConnectionId_idx" ON "biller_profiles"("providerConnectionId");

-- CreateIndex
CREATE INDEX "biller_profiles_slipVerifyConnectionId_idx" ON "biller_profiles"("slipVerifyConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "biller_profiles_tenantId_code_key" ON "biller_profiles"("tenantId", "code");

-- CreateIndex
CREATE INDEX "provider_connections_tenantId_providerCode_status_idx" ON "provider_connections"("tenantId", "providerCode", "status");

-- CreateIndex
CREATE INDEX "provider_connections_providerServiceId_idx" ON "provider_connections"("providerServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_tenantId_code_key" ON "provider_connections"("tenantId", "code");

-- CreateIndex
CREATE INDEX "provider_services_serviceType_status_idx" ON "provider_services"("serviceType", "status");

-- CreateIndex
CREATE INDEX "provider_services_tenantId_serviceType_status_idx" ON "provider_services"("tenantId", "serviceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_services_tenantId_code_key" ON "provider_services"("tenantId", "code");

-- CreateIndex
CREATE INDEX "slip_verify_connections_tenantId_providerCode_status_idx" ON "slip_verify_connections"("tenantId", "providerCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "slip_verify_connections_tenantId_code_key" ON "slip_verify_connections"("tenantId", "code");

-- CreateIndex
CREATE INDEX "tenant_biller_bindings_tenantId_active_isDefault_priority_idx" ON "tenant_biller_bindings"("tenantId", "active", "isDefault", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_biller_bindings_tenantId_billerProfileId_key" ON "tenant_biller_bindings"("tenantId", "billerProfileId");

-- CreateIndex
CREATE INDEX "merchant_biller_bindings_tenantId_merchantAccountId_active__idx" ON "merchant_biller_bindings"("tenantId", "merchantAccountId", "active", "isDefault", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_biller_bindings_merchantAccountId_billerProfileId_key" ON "merchant_biller_bindings"("merchantAccountId", "billerProfileId");

-- CreateIndex
CREATE INDEX "branch_biller_bindings_tenantId_branchId_active_isDefault_p_idx" ON "branch_biller_bindings"("tenantId", "branchId", "active", "isDefault", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "branch_biller_bindings_branchId_billerProfileId_key" ON "branch_biller_bindings"("branchId", "billerProfileId");

-- CreateIndex
CREATE INDEX "machine_kinds_active_sortOrder_idx" ON "machine_kinds"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "merchant_accounts_tenantId_status_idx" ON "merchant_accounts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_accounts_tenantId_code_key" ON "merchant_accounts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "branches_tenantId_status_idx" ON "branches"("tenantId", "status");

-- CreateIndex
CREATE INDEX "branches_merchantAccountId_idx" ON "branches"("merchantAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenantId_code_key" ON "branches"("tenantId", "code");

-- CreateIndex
CREATE INDEX "expense_types_tenantId_status_sortOrder_idx" ON "expense_types"("tenantId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "expense_types_tenantId_code_key" ON "expense_types"("tenantId", "code");

-- CreateIndex
CREATE INDEX "expenses_tenantId_occurredAt_idx" ON "expenses"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "expenses_merchantAccountId_occurredAt_idx" ON "expenses"("merchantAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "expenses_branchId_occurredAt_idx" ON "expenses"("branchId", "occurredAt");

-- CreateIndex
CREATE INDEX "expenses_expenseTypeId_occurredAt_idx" ON "expenses"("expenseTypeId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetUuid_key" ON "assets"("assetUuid");

-- CreateIndex
CREATE INDEX "assets_tenantId_branchId_status_idx" ON "assets"("tenantId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_branchId_code_key" ON "assets"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "machine_units_serialNo_key" ON "machine_units"("serialNo");

-- CreateIndex
CREATE INDEX "machine_units_tenantId_idx" ON "machine_units"("tenantId");

-- CreateIndex
CREATE INDEX "machine_units_tenantId_status_idx" ON "machine_units"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_macAddress_key" ON "iot_devices"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_deviceUid_key" ON "iot_devices"("deviceUid");

-- CreateIndex
CREATE INDEX "iot_devices_tenantId_idx" ON "iot_devices"("tenantId");

-- CreateIndex
CREATE INDEX "iot_devices_tenantId_status_idx" ON "iot_devices"("tenantId", "status");

-- CreateIndex
CREATE INDEX "asset_bindings_tenantId_assetId_status_idx" ON "asset_bindings"("tenantId", "assetId", "status");

-- CreateIndex
CREATE INDEX "asset_bindings_machineId_idx" ON "asset_bindings"("machineId");

-- CreateIndex
CREATE INDEX "asset_bindings_iotDeviceId_idx" ON "asset_bindings"("iotDeviceId");

-- CreateIndex
CREATE INDEX "products_tenantId_kind_active_idx" ON "products"("tenantId", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_code_key" ON "products"("tenantId", "code");

-- CreateIndex
CREATE INDEX "asset_product_prices_tenantId_assetId_active_idx" ON "asset_product_prices"("tenantId", "assetId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "asset_product_prices_assetId_productId_key" ON "asset_product_prices"("assetId", "productId");

-- CreateIndex
CREATE INDEX "asset_product_offers_tenantId_assetId_active_effectiveFrom__idx" ON "asset_product_offers"("tenantId", "assetId", "active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "asset_product_offers_tenantId_productId_active_pricingType_idx" ON "asset_product_offers"("tenantId", "productId", "active", "pricingType");

-- CreateIndex
CREATE INDEX "asset_product_offers_assetId_productId_pricingType_active_idx" ON "asset_product_offers"("assetId", "productId", "pricingType", "active");

-- CreateIndex
CREATE INDEX "refunds_orderId_status_createdAt_idx" ON "refunds"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "refunds_paymentId_status_idx" ON "refunds"("paymentId", "status");

-- CreateIndex
CREATE INDEX "refunds_tenantId_status_idx" ON "refunds"("tenantId", "status");

-- CreateIndex
CREATE INDEX "refund_items_orderItemId_idx" ON "refund_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "refund_items_refundId_orderItemId_key" ON "refund_items"("refundId", "orderItemId");

-- CreateIndex
CREATE INDEX "refund_audit_logs_refundId_createdAt_idx" ON "refund_audit_logs"("refundId", "createdAt");

-- CreateIndex
CREATE INDEX "refund_audit_logs_toStatus_createdAt_idx" ON "refund_audit_logs"("toStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_role_isActive_idx" ON "users"("tenantId", "role", "isActive");

-- CreateIndex
CREATE INDEX "users_merchantAccountId_idx" ON "users"("merchantAccountId");

-- CreateIndex
CREATE INDEX "user_scope_assignments_userId_active_idx" ON "user_scope_assignments"("userId", "active");

-- CreateIndex
CREATE INDEX "user_scope_assignments_tenantId_scopeType_active_idx" ON "user_scope_assignments"("tenantId", "scopeType", "active");

-- CreateIndex
CREATE INDEX "user_scope_assignments_merchantAccountId_active_idx" ON "user_scope_assignments"("merchantAccountId", "active");

-- CreateIndex
CREATE INDEX "user_scope_assignments_branchId_active_idx" ON "user_scope_assignments"("branchId", "active");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "device_api_keys_keyPrefix_key" ON "device_api_keys"("keyPrefix");

-- CreateIndex
CREATE INDEX "device_api_keys_iotDeviceId_status_idx" ON "device_api_keys"("iotDeviceId", "status");

-- CreateIndex
CREATE INDEX "device_api_keys_expiresAt_idx" ON "device_api_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_registration_codes_code_key" ON "device_registration_codes"("code");

-- CreateIndex
CREATE INDEX "device_registration_codes_tenantId_status_expiresAt_idx" ON "device_registration_codes"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "device_registration_codes_merchantAccountId_branchId_idx" ON "device_registration_codes"("merchantAccountId", "branchId");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_kind_fkey" FOREIGN KEY ("kind") REFERENCES "machine_kinds"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachinePrice" ADD CONSTRAINT "MachinePrice_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "MachinePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billerProfileId_fkey" FOREIGN KEY ("billerProfileId") REFERENCES "biller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biller_profiles" ADD CONSTRAINT "biller_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biller_profiles" ADD CONSTRAINT "biller_profiles_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biller_profiles" ADD CONSTRAINT "biller_profiles_slipVerifyConnectionId_fkey" FOREIGN KEY ("slipVerifyConnectionId") REFERENCES "slip_verify_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_verify_connections" ADD CONSTRAINT "slip_verify_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_biller_bindings" ADD CONSTRAINT "tenant_biller_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_biller_bindings" ADD CONSTRAINT "tenant_biller_bindings_billerProfileId_fkey" FOREIGN KEY ("billerProfileId") REFERENCES "biller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_biller_bindings" ADD CONSTRAINT "merchant_biller_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_biller_bindings" ADD CONSTRAINT "merchant_biller_bindings_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_biller_bindings" ADD CONSTRAINT "merchant_biller_bindings_billerProfileId_fkey" FOREIGN KEY ("billerProfileId") REFERENCES "biller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_biller_bindings" ADD CONSTRAINT "branch_biller_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_biller_bindings" ADD CONSTRAINT "branch_biller_bindings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_biller_bindings" ADD CONSTRAINT "branch_biller_bindings_billerProfileId_fkey" FOREIGN KEY ("billerProfileId") REFERENCES "biller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_accounts" ADD CONSTRAINT "merchant_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "expense_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_kind_fkey" FOREIGN KEY ("kind") REFERENCES "machine_kinds"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_units" ADD CONSTRAINT "machine_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_bindings" ADD CONSTRAINT "asset_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_bindings" ADD CONSTRAINT "asset_bindings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_bindings" ADD CONSTRAINT "asset_bindings_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machine_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_bindings" ADD CONSTRAINT "asset_bindings_iotDeviceId_fkey" FOREIGN KEY ("iotDeviceId") REFERENCES "iot_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_kind_fkey" FOREIGN KEY ("kind") REFERENCES "machine_kinds"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_prices" ADD CONSTRAINT "asset_product_prices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_prices" ADD CONSTRAINT "asset_product_prices_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_prices" ADD CONSTRAINT "asset_product_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_offers" ADD CONSTRAINT "asset_product_offers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_offers" ADD CONSTRAINT "asset_product_offers_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_product_offers" ADD CONSTRAINT "asset_product_offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_audit_logs" ADD CONSTRAINT "refund_audit_logs_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope_assignments" ADD CONSTRAINT "user_scope_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope_assignments" ADD CONSTRAINT "user_scope_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope_assignments" ADD CONSTRAINT "user_scope_assignments_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope_assignments" ADD CONSTRAINT "user_scope_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_api_keys" ADD CONSTRAINT "device_api_keys_iotDeviceId_fkey" FOREIGN KEY ("iotDeviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration_codes" ADD CONSTRAINT "device_registration_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration_codes" ADD CONSTRAINT "device_registration_codes_merchantAccountId_fkey" FOREIGN KEY ("merchantAccountId") REFERENCES "merchant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration_codes" ADD CONSTRAINT "device_registration_codes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration_codes" ADD CONSTRAINT "device_registration_codes_usedByIotDeviceId_fkey" FOREIGN KEY ("usedByIotDeviceId") REFERENCES "iot_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
