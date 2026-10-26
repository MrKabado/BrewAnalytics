ALTER TABLE "MarketingCampaign"
    ADD COLUMN "discountType" TEXT,
    ADD COLUMN "discountValue" DECIMAL(12,2),
    ADD COLUMN "status" TEXT,
    ADD CONSTRAINT "MarketingCampaign_discountValue_nonnegative_check"
        CHECK ("discountValue" IS NULL OR "discountValue" >= 0),
    ADD CONSTRAINT "MarketingCampaign_discountType_check"
        CHECK ("discountType" IS NULL OR "discountType" IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    ADD CONSTRAINT "MarketingCampaign_status_check"
        CHECK ("status" IS NULL OR "status" IN ('ACTIVE', 'INACTIVE', 'COMPLETED', 'CANCELLED'));
