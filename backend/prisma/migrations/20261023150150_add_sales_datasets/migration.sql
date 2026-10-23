-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesRecord_datasetId_idx" ON "SalesRecord"("datasetId");

-- CreateIndex
CREATE INDEX "SalesRecord_saleDate_idx" ON "SalesRecord"("saleDate");

-- CreateIndex
CREATE INDEX "SalesRecord_productName_idx" ON "SalesRecord"("productName");

-- CreateIndex
CREATE INDEX "SalesRecord_category_idx" ON "SalesRecord"("category");

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
