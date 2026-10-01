-- Units per carton for bulk ordering/logistics. Defaulted to 1 so
-- existing rows stay valid without a manual backfill.
ALTER TABLE "products" ADD COLUMN     "quantityPerCarton" INTEGER NOT NULL DEFAULT 1;
