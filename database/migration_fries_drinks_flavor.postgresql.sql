-- PostgreSQL translation of the existing Fries & Drinks catalog migration.
-- Additive and repeatable; historical order and catalog snapshots are untouched.
INSERT INTO option_groups(product_id,name,selection_type,is_required,display_order)
SELECT 8,'Fries Flavor','single',1,1
WHERE EXISTS(SELECT 1 FROM products WHERE id=8)
  AND NOT EXISTS(SELECT 1 FROM option_groups WHERE product_id=8 AND name='Fries Flavor');

INSERT INTO options(option_group_id,name,price_modifier,display_order)
SELECT g.id,v.name,0,v.display_order
FROM option_groups g
CROSS JOIN (VALUES ('Cheese',1),('BBQ',2),('Sour Cream',3)) AS v(name,display_order)
WHERE g.product_id=8 AND g.name='Fries Flavor'
  AND NOT EXISTS(SELECT 1 FROM options o WHERE o.option_group_id=g.id AND o.name=v.name);

UPDATE option_groups SET display_order=1 WHERE product_id=8 AND name='Fries Flavor';
UPDATE option_groups SET display_order=2 WHERE product_id=8 AND name='Drink Flavor';
