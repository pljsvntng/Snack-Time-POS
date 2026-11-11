-- Additive and repeatable. Existing orders remain unspecified, never relabeled takeout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type varchar(10) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name varchar(100) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seating_reference varchar(40) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_notes varchar(500) DEFAULT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'orders'::regclass AND conname = 'orders_order_type_valid') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_type_valid CHECK (order_type IS NULL OR order_type IN ('dine_in', 'takeout'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'orders'::regclass AND conname = 'orders_seating_type_valid') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_seating_type_valid CHECK (seating_reference IS NULL OR order_type IS NOT DISTINCT FROM 'dine_in');
  END IF;
END $$;
