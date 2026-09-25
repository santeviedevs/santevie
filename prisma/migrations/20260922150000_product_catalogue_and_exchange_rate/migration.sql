-- Add the new price columns as nullable first, so the pre-existing
-- "Sample Product" row (single price, no gross/net split yet) can be
-- backfilled before the columns become required.
ALTER TABLE "products" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "grossPrice" DECIMAL(12,2),
ADD COLUMN     "netPrice" DECIMAL(12,2);

-- Backfill: no discount data exists for rows created under the old single-
-- price shape, so gross and net both take the old price as-is.
UPDATE "products" SET "grossPrice" = "price", "netPrice" = "price" WHERE "grossPrice" IS NULL;

-- Now safe to enforce NOT NULL and drop the old columns.
ALTER TABLE "products" ALTER COLUMN "grossPrice" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "netPrice" SET NOT NULL;
ALTER TABLE "products" DROP COLUMN "category";
ALTER TABLE "products" DROP COLUMN "currency";
ALTER TABLE "products" DROP COLUMN "price";

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "grossPrice" DECIMAL(12,2) NOT NULL,
    "netPrice" DECIMAL(12,2) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_code_key" ON "product_categories"("code");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
