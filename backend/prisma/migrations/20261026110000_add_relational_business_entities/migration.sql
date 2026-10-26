-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- AlterTable
ALTER TABLE "SalesRecord"
    ADD COLUMN "campaignId" TEXT,
    ADD COLUMN "customerId" TEXT,
    ADD COLUMN "productId" TEXT,
    ADD COLUMN "saleDateTime" TIMESTAMP(3),
    ADD COLUMN "unitCost" DECIMAL(12,2),
    ADD CONSTRAINT "SalesRecord_unitCost_nonnegative_check"
        CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

-- CreateTable
CREATE TABLE "Product" (
    "datasetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("datasetId", "productId"),
    CONSTRAINT "Product_unitPrice_nonnegative_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "Product_unitCost_nonnegative_check" CHECK ("unitCost" IS NULL OR "unitCost" >= 0)
);

-- CreateTable
CREATE TABLE "Customer" (
    "datasetId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "gender" TEXT,
    "registrationDate" DATE NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("datasetId", "customerId")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "datasetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "promotionType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "marketingCost" DECIMAL(12,2) NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "campaignChannel" TEXT NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("datasetId", "campaignId"),
    CONSTRAINT "MarketingCampaign_date_range_check" CHECK ("endDate" >= "startDate"),
    CONSTRAINT "MarketingCampaign_marketingCost_nonnegative_check" CHECK ("marketingCost" >= 0),
    CONSTRAINT "MarketingCampaign_discountPercentage_range_check" CHECK ("discountPercentage" >= 0 AND "discountPercentage" <= 100)
);

-- CreateIndex
CREATE INDEX "Product_datasetId_category_idx" ON "Product"("datasetId", "category");
CREATE INDEX "Product_datasetId_productName_idx" ON "Product"("datasetId", "productName");
CREATE INDEX "Customer_datasetId_customerType_idx" ON "Customer"("datasetId", "customerType");
CREATE INDEX "MarketingCampaign_datasetId_startDate_endDate_idx" ON "MarketingCampaign"("datasetId", "startDate", "endDate");
CREATE INDEX "SalesRecord_datasetId_productId_idx" ON "SalesRecord"("datasetId", "productId");
CREATE INDEX "SalesRecord_datasetId_customerId_idx" ON "SalesRecord"("datasetId", "customerId");
CREATE INDEX "SalesRecord_datasetId_campaignId_idx" ON "SalesRecord"("datasetId", "campaignId");

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_datasetId_productId_fkey"
    FOREIGN KEY ("datasetId", "productId") REFERENCES "Product"("datasetId", "productId")
    ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_datasetId_customerId_fkey"
    FOREIGN KEY ("datasetId", "customerId") REFERENCES "Customer"("datasetId", "customerId")
    ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_datasetId_campaignId_fkey"
    FOREIGN KEY ("datasetId", "campaignId") REFERENCES "MarketingCampaign"("datasetId", "campaignId")
    ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
