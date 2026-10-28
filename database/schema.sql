-- ============================================================
-- FOODTRIP HOUSE POS - DATABASE SCHEMA
-- Database: foodtrip_house_pos
-- ============================================================

CREATE DATABASE IF NOT EXISTS foodtrip_house_pos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE foodtrip_house_pos;

-- ------------------------------------------------------------
-- ROLES & USERS
-- ------------------------------------------------------------
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE   -- 'admin' | 'cashier'
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CATEGORIES & PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(60) NOT NULL UNIQUE,
  icon VARCHAR(10) DEFAULT '',
  display_order INT DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  image VARCHAR(255) DEFAULT NULL,
  available TINYINT(1) NOT NULL DEFAULT 1,
  track_stock TINYINT(1) NOT NULL DEFAULT 0,   -- 1 if product has its own direct stock count (e.g. siomai piece)
  stock INT DEFAULT NULL,
  low_stock_threshold INT DEFAULT 10,
  sku VARCHAR(40) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,        -- soft delete
  FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_products_category (category_id),
  INDEX idx_products_available (available)
) ENGINE=InnoDB;

-- Option groups: e.g. "Flavor" (single-select, required), "Size", "Add-ons" (multi-select)
CREATE TABLE option_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,              -- 'Flavor', 'Size', 'Add-ons'
  selection_type ENUM('single','multi') NOT NULL DEFAULT 'single',
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  option_group_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,              -- 'Cheese', '22oz', 'Okinawa', 'Pearl'
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  display_order INT DEFAULT 0,
  FOREIGN KEY (option_group_id) REFERENCES option_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INGREDIENTS / INVENTORY / RECIPES (BOM)
-- ------------------------------------------------------------
CREATE TABLE ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',   -- pcs, g, ml, etc.
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Base recipe: ingredients consumed by the base product itself
CREATE TABLE product_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity_required DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  UNIQUE KEY uniq_product_ingredient (product_id, ingredient_id)
) ENGINE=InnoDB;

-- Extra ingredients consumed when a specific option is chosen (e.g. Pearl add-on)
CREATE TABLE option_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  option_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity_required DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  UNIQUE KEY uniq_option_ingredient (option_id, ingredient_id)
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  type ENUM('add','deduct','adjust') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,     -- always positive; direction implied by `type`
  resulting_stock DECIMAL(12,2) NOT NULL,
  reason VARCHAR(255) DEFAULT '',
  reference_order_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_inv_tx_ingredient (ingredient_id),
  INDEX idx_inv_tx_created (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
CREATE TABLE discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  type ENUM('percent','fixed') NOT NULL DEFAULT 'fixed',
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,   -- FH-YYYYMMDD-###
  user_id INT NOT NULL,                       -- cashier who processed it
  subtotal DECIMAL(10,2) NOT NULL,
  discount_id INT DEFAULT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','gcash','other') NOT NULL,
  cash_received DECIMAL(10,2) DEFAULT NULL,
  change_amount DECIMAL(10,2) DEFAULT NULL,
  status ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (discount_id) REFERENCES discounts(id),
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(120) NOT NULL,   -- snapshot at time of sale
  unit_price DECIMAL(10,2) NOT NULL,    -- base price + option modifiers, snapshot
  quantity INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE order_item_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  option_group_name VARCHAR(60) NOT NULL,   -- snapshot, e.g. 'Flavor'
  option_name VARCHAR(60) NOT NULL,         -- snapshot, e.g. 'Okinawa'
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SETTINGS
-- ------------------------------------------------------------
CREATE TABLE settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL DEFAULT ''
) ENGINE=InnoDB;
