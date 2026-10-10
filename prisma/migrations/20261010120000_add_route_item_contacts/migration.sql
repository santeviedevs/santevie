
-- CreateTable
CREATE TABLE "route_item_contacts" (
    "id" TEXT NOT NULL,
    "routeItemId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "RouteItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_item_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_item_contacts_contactId_idx" ON "route_item_contacts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "route_item_contacts_routeItemId_contactId_key" ON "route_item_contacts"("routeItemId", "contactId");

-- AddForeignKey
ALTER TABLE "route_item_contacts" ADD CONSTRAINT "route_item_contacts_routeItemId_fkey" FOREIGN KEY ("routeItemId") REFERENCES "route_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_item_contacts" ADD CONSTRAINT "route_item_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

