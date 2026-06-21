ALTER TABLE scan_uploads 
  ADD CONSTRAINT fk_scan_uploads_order 
  FOREIGN KEY (linked_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE scan_uploads
  ADD CONSTRAINT fk_scan_uploads_customer
  FOREIGN KEY (linked_customer_id) REFERENCES customers(id) ON DELETE SET NULL;
