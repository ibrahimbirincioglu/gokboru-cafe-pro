-- Additive reporting indexes. No rows or historical revenue records are changed.
CREATE INDEX "Order_tableSessionId_createdAt_idx"
ON "Order"("tableSessionId", "createdAt");

CREATE INDEX "Order_createdAt_status_tableId_createdByUserId_idx"
ON "Order"("createdAt", "status", "tableId", "createdByUserId");

CREATE INDEX "OrderItem_productId_orderId_idx"
ON "OrderItem"("productId", "orderId");

CREATE INDEX "Payment_businessDate_status_paymentType_idx"
ON "Payment"("businessDate", "status", "paymentType");
