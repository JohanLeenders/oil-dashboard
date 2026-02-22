-- Wave 12 pre-req: Add 'zadel' and 'verlies' to product_category enum.
-- Required before wave12_zadel_parent_pool migration can insert these products.
-- 'zadel' = parent pool (whole leg quarter, not directly sellable)
-- 'verlies' = explicit loss/waste products (bone, cartilage from cutting)

ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'zadel';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'verlies';
