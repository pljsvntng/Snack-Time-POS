-- ============================================================
-- FOODTRIP HOUSE POS - SEED DATA
-- Run AFTER schema.sql
-- Passwords below are bcrypt hashes for: admin123 / cashier123
-- (see README for how to regenerate hashes)
-- ============================================================

USE foodtrip_house_pos;

-- ------------------------------------------------------------
-- ROLES & USERS
-- ------------------------------------------------------------
INSERT INTO roles (id, name) VALUES (1,'admin'), (2,'cashier');

-- password: admin123
INSERT INTO users (role_id, full_name, username, email, password_hash, active) VALUES
(1, 'Admin User', 'admin', 'admin@foodtriphouse.com', '$2b$10$WlZo0v0m0f1n7Kkq7Zt8UOqYVvJq3g4l1sTfj6d8q0T1H2wJmC0Fy', 1);

-- password: cashier123
INSERT INTO users (role_id, full_name, username, email, password_hash, active) VALUES
(2, 'Juan Dela Cruz', 'juan', 'juan@foodtriphouse.com', '$2b$10$m8nUeqzq0IuT2Q6dGxq6qO7fW1s0nP2xQe4d5J8yG7c1H0zN3aK9u', 1);

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
INSERT INTO categories (id, name, slug, icon, display_order) VALUES
(1, 'Burgers',      'burgers',      '🍔', 1),
(2, 'Fries',        'fries',        '🍟', 2),
(3, 'Combos',       'combos',       '🍱', 3),
(4, 'Drinks',       'drinks',       '🥤', 4),
(5, 'Siomai',       'siomai',       '🥟', 5),
(6, 'Shakes',       'shakes',       '🥤', 6),
(7, 'Milk Tea',     'milk-tea',     '🧋', 7),
(8, 'Desserts',     'desserts',     '🍨', 8),
(9, 'Fresh Shakes', 'fresh-shakes', '🥭', 9);

-- ------------------------------------------------------------
-- SETTINGS
-- ------------------------------------------------------------
INSERT INTO settings (setting_key, setting_value) VALUES
('business_name', 'FOODTRIP HOUSE'),
('address', 'Imus, Cavite, Philippines'),
('contact_number', '0900-000-0000'),
('receipt_footer', 'THANK YOU! COME AGAIN!'),
('currency_symbol', '₱'),
('printer_width', '58mm');

-- ------------------------------------------------------------
-- PRODUCTS: BURGERS
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(1, 1, 'Plain Burger', 'Soft bun, juicy patty, simple and satisfying.', 25.00, '/images/products/burgers/plain-burger.svg', 'BRG-001'),
(2, 1, 'Burger with Vegetable / Cheese', 'Choose vegetable or cheese topping.', 30.00, '/images/products/burgers/burger-veg-or-cheese.svg', 'BRG-002'),
(3, 1, 'Burger with Vegetable and Cheese', 'Loaded with fresh veggies and melted cheese.', 35.00, '/images/products/burgers/burger-veg-cheese.svg', 'BRG-003'),
(4, 1, 'Burger Buy 1 Take 1', 'Two classic burgers, one great price.', 45.00, '/images/products/burgers/burger-b1t1.svg', 'BRG-004'),
(5, 1, 'Cheesy Hotdog Buy 1 Take 1', 'Two cheesy hotdogs in soft buns.', 55.00, '/images/products/burgers/cheesy-hotdog-b1t1.svg', 'BRG-005');

INSERT INTO option_groups (id, product_id, name, selection_type, is_required, display_order) VALUES
(1, 2, 'Topping', 'single', 1, 1);
INSERT INTO options (option_group_id, name, price_modifier, display_order) VALUES
(1, 'Vegetable', 0, 1),
(1, 'Cheese', 0, 2);

-- ------------------------------------------------------------
-- PRODUCTS: FRIES
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(6, 2, 'Small Fries', 'Crispy golden fries, small serving.', 30.00, '/images/products/fries/fries-small.svg', 'FRY-001'),
(7, 2, 'Large Fries', 'Crispy golden fries, large serving.', 50.00, '/images/products/fries/fries-large.svg', 'FRY-002');

INSERT INTO option_groups (id, product_id, name, selection_type, is_required, display_order) VALUES
(2, 6, 'Flavor', 'single', 1, 1),
(3, 7, 'Flavor', 'single', 1, 1);
INSERT INTO options (option_group_id, name, price_modifier, display_order) VALUES
(2, 'Cheese', 0, 1), (2, 'BBQ', 0, 2), (2, 'Sour Cream', 0, 3),
(3, 'Cheese', 0, 1), (3, 'BBQ', 0, 2), (3, 'Sour Cream', 0, 3);

-- ------------------------------------------------------------
-- PRODUCTS: COMBOS
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(8, 3, 'Fries & Drinks', 'Fries paired with your choice of drink.', 35.00, '/images/products/combos/fries-drinks.svg', 'CMB-001'),
(9, 3, 'Siomai & Drinks', 'Siomai paired with your choice of drink.', 40.00, '/images/products/combos/siomai-drinks.svg', 'CMB-002'),
(10, 3, 'Chicken Rings & Drinks', 'Chicken rings paired with your choice of drink.', 35.00, '/images/products/combos/chicken-rings-drinks.svg', 'CMB-003');

INSERT INTO option_groups (id, product_id, name, selection_type, is_required, display_order) VALUES
(4, 8, 'Drink Flavor', 'single', 1, 1),
(5, 9, 'Drink Flavor', 'single', 1, 1),
(6, 10, 'Drink Flavor', 'single', 1, 1);
INSERT INTO options (option_group_id, name, price_modifier, display_order) VALUES
(4,'Blue Lemonade',0,1),(4,'Pineapple',0,2),(4,'Chocolate',0,3),
(5,'Blue Lemonade',0,1),(5,'Pineapple',0,2),(5,'Chocolate',0,3),
(6,'Blue Lemonade',0,1),(6,'Pineapple',0,2),(6,'Chocolate',0,3);

-- ------------------------------------------------------------
-- PRODUCTS: DRINKS (standalone)
-- NOTE: no standalone price was specified in the source brief (drinks
-- were only priced as part of combos). A default price of ₱20 is used
-- here as a placeholder -- change it in Admin > Products before going live.
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(11, 4, 'Blue Lemonade', 'Refreshing blue lemonade, served cold.', 20.00, '/images/products/drinks/blue-lemonade.svg', 'DRK-001'),
(12, 4, 'Pineapple', 'Refreshing pineapple drink, served cold.', 20.00, '/images/products/drinks/pineapple.svg', 'DRK-002'),
(13, 4, 'Chocolate', 'Cold chocolate drink.', 20.00, '/images/products/drinks/chocolate.svg', 'DRK-003');

-- ------------------------------------------------------------
-- PRODUCTS: SIOMAI (sold per piece, quantity selectable)
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(14, 5, 'Siomai', 'Steamed siomai, ₱10 per piece.', 10.00, '/images/products/siomai/siomai.svg', 'SIO-001');

-- ------------------------------------------------------------
-- PRODUCTS: SHAKES (size changes price, flavor does not)
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(15, 6, 'Shake', 'Cold, thick, and creamy. Pick your size and flavor.', 25.00, '/images/products/shakes/shake-base.svg', 'SHK-001');

INSERT INTO option_groups (id, product_id, name, selection_type, is_required, display_order) VALUES
(7, 15, 'Size', 'single', 1, 1),
(8, 15, 'Flavor', 'single', 1, 2);
INSERT INTO options (option_group_id, name, price_modifier, display_order) VALUES
(7,'Small',0,1),(7,'Medium',5,2),(7,'Large',10,3),
(8,'Choco Kisses',0,1),(8,'Choco Hot Fudge',0,2),(8,'Buko Pandan',0,3),
(8,'Melon',0,4),(8,'Cookies and Cream',0,5),(8,'Avocado',0,6);

-- ------------------------------------------------------------
-- PRODUCTS: MILK TEA (size changes price, add-on Pearl +10)
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(16, 7, 'Milk Tea', 'Pick a size, flavor, and optional pearl add-on.', 29.00, '/images/products/milk-tea/milk-tea-base.svg', 'MLT-001');

INSERT INTO option_groups (id, product_id, name, selection_type, is_required, display_order) VALUES
(9, 16, 'Size', 'single', 1, 1),
(10, 16, 'Flavor', 'single', 1, 2),
(11, 16, 'Add-on', 'multi', 0, 3);
INSERT INTO options (id, option_group_id, name, price_modifier, display_order) VALUES
(100, 9, '16oz', 0, 1), (101, 9, '22oz', 10, 2),
(102, 10, 'Red Velvet', 0, 1), (103, 10, 'Cookie & Cream', 0, 2),
(104, 10, 'Wintermelon', 0, 3), (105, 10, 'Okinawa', 0, 4), (106, 10, 'Chocolate', 0, 5),
(107, 11, 'Pearl', 10, 1);

-- ------------------------------------------------------------
-- PRODUCTS: DESSERTS
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(17, 8, 'Special Halo-Halo', 'Colorful Filipino halo-halo in a glass.', 50.00, '/images/products/desserts/special-halo-halo.svg', 'DST-001'),
(18, 8, 'Special Mais Conyelo', 'Creamy corn and milk dessert.', 40.00, '/images/products/desserts/special-mais-conyelo.svg', 'DST-002'),
(19, 8, 'Special Saging Conyelo', 'Creamy banana-based Filipino dessert.', 40.00, '/images/products/desserts/special-saging-conyelo.svg', 'DST-003');

-- ------------------------------------------------------------
-- PRODUCTS: FRESH SHAKES
-- ------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, price, image, sku) VALUES
(20, 9, 'Fresh Avocado Shake', 'Made with real fresh avocado.', 60.00, '/images/products/fresh-shakes/fresh-avocado-shake.svg', 'FSH-001'),
(21, 9, 'Fresh Mango Shake', 'Made with real fresh mango.', 60.00, '/images/products/fresh-shakes/fresh-mango-shake.svg', 'FSH-002'),
(22, 9, 'Fresh Dragon Fruit Shake', 'Made with real fresh dragon fruit.', 60.00, '/images/products/fresh-shakes/fresh-dragon-fruit-shake.svg', 'FSH-003');

-- ------------------------------------------------------------
-- INGREDIENTS (starter set -- extend freely in Admin > Inventory)
-- ------------------------------------------------------------
INSERT INTO ingredients (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES
(1,'Burger Bun','pcs',200,30,3.00),
(2,'Burger Patty','pcs',200,30,8.00),
(3,'Cheese Slice','pcs',150,20,2.50),
(4,'Fresh Vegetables (mix)','servings',150,20,1.50),
(5,'Hotdog Bun','pcs',100,20,3.00),
(6,'Hotdog Sausage','pcs',100,20,7.00),
(7,'Fries Potato Serving','servings',150,20,10.00),
(8,'Siomai Piece','pcs',500,50,4.00),
(9,'Chicken Ring Serving','servings',100,15,12.00),
(10,'Drink Base (generic flavor)','servings',300,40,3.00),
(11,'Milk Tea Base','servings',300,40,10.00),
(12,'Pearl','servings',300,40,3.00),
(13,'Shake Base','servings',200,30,8.00),
(14,'Halo-Halo Mix','servings',100,15,15.00),
(15,'Corn & Milk Mix','servings',100,15,12.00),
(16,'Banana Mix','servings',100,15,12.00),
(17,'Fresh Avocado','servings',80,10,18.00),
(18,'Fresh Mango','servings',80,10,18.00),
(19,'Fresh Dragon Fruit','servings',80,10,18.00);

-- ------------------------------------------------------------
-- PRODUCT RECIPES (Bill of Materials) -- base ingredients consumed per unit sold
-- ------------------------------------------------------------
INSERT INTO product_ingredients (product_id, ingredient_id, quantity_required) VALUES
(1, 1, 1), (1, 2, 1),                                   -- Plain Burger: 1 bun, 1 patty
(2, 1, 1), (2, 2, 1),                                   -- Burger w/ Veg/Cheese: 1 bun, 1 patty (+topping below)
(3, 1, 1), (3, 2, 1), (3, 3, 1), (3, 4, 1),              -- Burger w/ Veg & Cheese
(4, 1, 2), (4, 2, 2),                                    -- Burger B1T1: 2 buns, 2 patties
(5, 5, 2), (5, 6, 2), (5, 3, 2),                         -- Cheesy Hotdog B1T1: 2 buns, 2 sausages, 2 cheese
(6, 7, 1),                                               -- Small Fries
(7, 7, 2),                                               -- Large Fries (bigger serving)
(8, 7, 1), (8, 10, 1),                                   -- Fries & Drinks
(9, 8, 4), (9, 10, 1),                                   -- Siomai & Drinks (4 pcs siomai + drink)
(10, 9, 1), (10, 10, 1),                                 -- Chicken Rings & Drinks
(11, 10, 1), (12, 10, 1), (13, 10, 1),                   -- standalone drinks
(14, 8, 1),                                              -- Siomai: 1 piece per unit (quantity multiplies at order time)
(15, 13, 1),                                             -- Shake base
(16, 11, 1),                                             -- Milk Tea base
(17, 14, 1),                                             -- Halo-Halo
(18, 15, 1),                                             -- Mais Conyelo
(19, 16, 1),                                             -- Saging Conyelo
(20, 17, 1),                                             -- Fresh Avocado Shake
(21, 18, 1),                                             -- Fresh Mango Shake
(22, 19, 1);                                             -- Fresh Dragon Fruit Shake

-- Extra ingredients consumed by specific options (e.g. Pearl add-on, cheese/vegetable topping choice)
INSERT INTO option_ingredients (option_id, ingredient_id, quantity_required) VALUES
(107, 12, 1);   -- Milk Tea "Pearl" add-on consumes 1 serving of Pearl

-- Topping options for product 2 (Burger with Vegetable / Cheese) also consume the chosen topping
-- (option ids were auto-generated; look them up dynamically instead of hardcoding when adapting this seed)
INSERT INTO option_ingredients (option_id, ingredient_id, quantity_required)
SELECT o.id, 4, 1 FROM options o JOIN option_groups og ON o.option_group_id = og.id
  WHERE og.product_id = 2 AND o.name = 'Vegetable';
INSERT INTO option_ingredients (option_id, ingredient_id, quantity_required)
SELECT o.id, 3, 1 FROM options o JOIN option_groups og ON o.option_group_id = og.id
  WHERE og.product_id = 2 AND o.name = 'Cheese';

-- ------------------------------------------------------------
-- DISCOUNTS
-- ------------------------------------------------------------
INSERT INTO discounts (id, name, type, value, active) VALUES
(1, 'Senior Citizen / PWD (20%)', 'percent', 20, 1),
(2, '₱10 Off Promo', 'fixed', 10, 1);
