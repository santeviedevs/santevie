-- S2-06: indexes matching the filter combinations the admin list screens
-- actually issue (users, clients, territories, products), so those queries
-- stay index-backed instead of a sequential scan as each table grows.

-- CreateIndex
CREATE INDEX "users_territoryId_status_idx" ON "users"("territoryId", "status");

-- CreateIndex
CREATE INDEX "users_roleId_status_idx" ON "users"("roleId", "status");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- CreateIndex
CREATE INDEX "clients_territoryId_status_idx" ON "clients"("territoryId", "status");

-- CreateIndex
CREATE INDEX "clients_typeId_status_idx" ON "clients"("typeId", "status");

-- CreateIndex
CREATE INDEX "products_categoryId_status_idx" ON "products"("categoryId", "status");

-- CreateIndex
CREATE INDEX "territories_provinceId_status_idx" ON "territories"("provinceId", "status");

-- CreateIndex
CREATE INDEX "territories_villeId_idx" ON "territories"("villeId");

-- CreateIndex
CREATE INDEX "territories_communeId_idx" ON "territories"("communeId");
