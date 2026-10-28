-- ============================================================
-- MIGRATION: Add "Fries Flavor" selection to the Fries & Drinks combo
-- (product_id = 8), so the cashier must choose both a fries flavor
-- AND a drink flavor, matching the updated UI/UX spec.
--
-- Safe to run once on an existing, already-seeded database.
-- Does NOT touch any other table, order, or existing data.
-- ============================================================

USE foodtrip_house_pos;

-- Only insert if it hasn't been added already (safe to re-run)
INSERT INTO option_groups (product_id, name, selection_type, is_required, display_order)
SELECT 8, 'Fries Flavor', 'single', 1, 1
WHERE NOT EXISTS (
  SELECT 1 FROM option_groups WHERE product_id = 8 AND name = 'Fries Flavor'
);

SET @fries_flavor_group_id = (
  SELECT id FROM option_groups WHERE product_id = 8 AND name = 'Fries Flavor' LIMIT 1
);

INSERT INTO options (option_group_id, name, price_modifier, display_order)
SELECT * FROM (
  SELECT @fries_flavor_group_id AS gid, 'Cheese' AS n, 0 AS pm, 1 AS ord
  UNION ALL SELECT @fries_flavor_group_id, 'BBQ', 0, 2
  UNION ALL SELECT @fries_flavor_group_id, 'Sour Cream', 0, 3
) AS new_options
WHERE NOT EXISTS (
  SELECT 1 FROM options WHERE option_group_id = @fries_flavor_group_id AND name = new_options.n
);

-- Make sure Fries Flavor is asked before Drink Flavor in the customization modal
UPDATE option_groups SET display_order = 1 WHERE product_id = 8 AND name = 'Fries Flavor';
UPDATE option_groups SET display_order = 2 WHERE product_id = 8 AND name = 'Drink Flavor';
