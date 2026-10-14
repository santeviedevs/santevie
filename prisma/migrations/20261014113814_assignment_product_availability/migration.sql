/*
  La Garde's execution-time product availability — distinct from
  ActivityProduct.availability (the shared, planned fact set at creation).
  La Garde is typically a different delegate each night, so this can
  genuinely differ visit to visit.
*/

-- AlterTable
ALTER TABLE "assignment_product_results" ADD COLUMN     "availability" TEXT;
