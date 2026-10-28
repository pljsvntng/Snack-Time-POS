-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: foodtrip_house_pos
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `icon` varchar(10) DEFAULT '',
  `display_order` int(11) DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Burgers','burgers','🍔',1,1),(2,'Fries','fries','🍟',2,1),(3,'Combos','combos','🍱',3,1),(4,'Drinks','drinks','🥤',4,1),(5,'Siomai','siomai','🥟',5,1),(6,'Shakes','shakes','🥤',6,1),(7,'Milk Tea','milk-tea','🧋',7,1),(8,'Desserts','desserts','🍨',8,1),(9,'Fresh Shakes','fresh-shakes','🥭',9,1);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `discounts`
--

DROP TABLE IF EXISTS `discounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `discounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `type` enum('percent','fixed') NOT NULL DEFAULT 'fixed',
  `value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discounts`
--

LOCK TABLES `discounts` WRITE;
/*!40000 ALTER TABLE `discounts` DISABLE KEYS */;
INSERT INTO `discounts` VALUES (1,'Senior Citizen / PWD (20%)','percent',20.00,1),(2,'₱10 Off Promo','fixed',10.00,1);
/*!40000 ALTER TABLE `discounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ingredients`
--

DROP TABLE IF EXISTS `ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ingredients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `unit` varchar(20) NOT NULL DEFAULT 'pcs',
  `current_stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cost_per_unit` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ingredients`
--

LOCK TABLES `ingredients` WRITE;
/*!40000 ALTER TABLE `ingredients` DISABLE KEYS */;
INSERT INTO `ingredients` VALUES (1,'Burger Bun','pcs',191.00,30.00,3.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(2,'Burger Patty','pcs',191.00,30.00,8.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(3,'Cheese Slice','pcs',147.00,20.00,2.50,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(4,'Fresh Vegetables (mix)','servings',148.00,20.00,1.50,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(5,'Hotdog Bun','pcs',98.00,20.00,3.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(6,'Hotdog Sausage','pcs',98.00,20.00,7.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(7,'Fries Potato Serving','servings',146.00,20.00,10.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(8,'Siomai Piece','pcs',487.00,50.00,4.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(9,'Chicken Ring Serving','servings',98.00,15.00,12.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(10,'Drink Base (generic flavor)','servings',294.00,40.00,3.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(11,'Milk Tea Base','servings',297.00,40.00,10.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(12,'Pearl','servings',297.00,40.00,3.00,'2026-09-26 03:30:07','2026-09-26 04:01:47'),(13,'Shake Base','servings',196.00,30.00,8.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(14,'Halo-Halo Mix','servings',99.00,15.00,15.00,'2026-09-26 03:30:07','2026-09-26 03:32:29'),(15,'Corn & Milk Mix','servings',98.00,15.00,12.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(16,'Banana Mix','servings',120.00,15.00,12.00,'2026-09-26 03:30:07','2026-10-02 02:03:10'),(17,'Fresh Avocado','servings',78.00,10.00,18.00,'2026-09-26 03:30:07','2026-10-02 02:04:50'),(18,'Fresh Mango','servings',79.00,10.00,18.00,'2026-09-26 03:30:07','2026-09-26 03:32:29'),(19,'Fresh Dragon Fruit','servings',79.00,10.00,18.00,'2026-09-26 03:30:07','2026-09-26 04:01:47');
/*!40000 ALTER TABLE `ingredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ingredient_id` int(11) NOT NULL,
  `type` enum('add','deduct','adjust') NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `resulting_stock` decimal(12,2) NOT NULL,
  `reason` varchar(255) DEFAULT '',
  `reference_order_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_inv_tx_ingredient` (`ingredient_id`),
  KEY `idx_inv_tx_created` (`created_at`),
  CONSTRAINT `inventory_transactions_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`),
  CONSTRAINT `inventory_transactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
INSERT INTO `inventory_transactions` VALUES (1,1,'deduct',2.00,198.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(2,2,'deduct',2.00,198.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(3,8,'deduct',4.00,496.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(4,14,'deduct',1.00,99.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(5,11,'deduct',2.00,298.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(6,12,'deduct',2.00,298.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(7,17,'deduct',1.00,79.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(8,18,'deduct',1.00,79.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(9,9,'deduct',1.00,99.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(10,10,'deduct',2.00,298.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(11,7,'deduct',1.00,149.00,'Sold on order FH-20260926-001',1,2,'2026-09-26 03:32:29'),(12,1,'deduct',5.00,193.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(13,2,'deduct',5.00,193.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(14,4,'deduct',2.00,148.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(15,3,'deduct',3.00,147.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(16,5,'deduct',2.00,98.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(17,6,'deduct',2.00,98.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(18,7,'deduct',2.00,147.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(19,10,'deduct',4.00,294.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(20,9,'deduct',1.00,98.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(21,8,'deduct',9.00,487.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(22,13,'deduct',2.00,198.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(23,11,'deduct',1.00,297.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(24,12,'deduct',1.00,297.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(25,15,'deduct',1.00,99.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(26,16,'deduct',1.00,99.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(27,19,'deduct',1.00,79.00,'Sold on order FH-20260926-002',2,2,'2026-09-26 04:01:47'),(28,16,'add',21.00,120.00,'',NULL,1,'2026-10-02 02:03:10'),(29,1,'deduct',2.00,191.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50'),(30,2,'deduct',2.00,191.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50'),(31,7,'deduct',1.00,146.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50'),(32,15,'deduct',1.00,98.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50'),(33,17,'deduct',1.00,78.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50'),(34,13,'deduct',2.00,196.00,'Sold on order FH-20261002-001',3,2,'2026-10-02 02:04:50');
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `option_groups`
--

DROP TABLE IF EXISTS `option_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `option_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `name` varchar(60) NOT NULL,
  `selection_type` enum('single','multi') NOT NULL DEFAULT 'single',
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `option_groups_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `option_groups`
--

LOCK TABLES `option_groups` WRITE;
/*!40000 ALTER TABLE `option_groups` DISABLE KEYS */;
INSERT INTO `option_groups` VALUES (1,2,'Topping','single',1,1),(2,6,'Flavor','single',1,1),(3,7,'Flavor','single',1,1),(4,8,'Drink Flavor','single',1,2),(5,9,'Drink Flavor','single',1,1),(6,10,'Drink Flavor','single',1,1),(7,15,'Size','single',1,1),(8,15,'Flavor','single',1,2),(9,16,'Size','single',1,1),(10,16,'Flavor','single',1,2),(11,16,'Add-on','multi',0,3),(12,8,'Fries Flavor','single',1,1);
/*!40000 ALTER TABLE `option_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `option_ingredients`
--

DROP TABLE IF EXISTS `option_ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `option_ingredients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `option_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `quantity_required` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_option_ingredient` (`option_id`,`ingredient_id`),
  KEY `ingredient_id` (`ingredient_id`),
  CONSTRAINT `option_ingredients_ibfk_1` FOREIGN KEY (`option_id`) REFERENCES `options` (`id`) ON DELETE CASCADE,
  CONSTRAINT `option_ingredients_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `option_ingredients`
--

LOCK TABLES `option_ingredients` WRITE;
/*!40000 ALTER TABLE `option_ingredients` DISABLE KEYS */;
INSERT INTO `option_ingredients` VALUES (1,107,12,1.00),(2,1,4,1.00),(3,2,3,1.00);
/*!40000 ALTER TABLE `option_ingredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `options`
--

DROP TABLE IF EXISTS `options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `option_group_id` int(11) NOT NULL,
  `name` varchar(60) NOT NULL,
  `price_modifier` decimal(10,2) NOT NULL DEFAULT 0.00,
  `display_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `option_group_id` (`option_group_id`),
  CONSTRAINT `options_ibfk_1` FOREIGN KEY (`option_group_id`) REFERENCES `option_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `options`
--

LOCK TABLES `options` WRITE;
/*!40000 ALTER TABLE `options` DISABLE KEYS */;
INSERT INTO `options` VALUES (1,1,'Vegetable',0.00,1),(2,1,'Cheese',0.00,2),(3,2,'Cheese',0.00,1),(4,2,'BBQ',0.00,2),(5,2,'Sour Cream',0.00,3),(6,3,'Cheese',0.00,1),(7,3,'BBQ',0.00,2),(8,3,'Sour Cream',0.00,3),(9,4,'Blue Lemonade',0.00,1),(10,4,'Pineapple',0.00,2),(11,4,'Chocolate',0.00,3),(12,5,'Blue Lemonade',0.00,1),(13,5,'Pineapple',0.00,2),(14,5,'Chocolate',0.00,3),(15,6,'Blue Lemonade',0.00,1),(16,6,'Pineapple',0.00,2),(17,6,'Chocolate',0.00,3),(18,7,'Small',0.00,1),(19,7,'Medium',5.00,2),(20,7,'Large',10.00,3),(21,8,'Choco Kisses',0.00,1),(22,8,'Choco Hot Fudge',0.00,2),(23,8,'Buko Pandan',0.00,3),(24,8,'Melon',0.00,4),(25,8,'Cookies and Cream',0.00,5),(26,8,'Avocado',0.00,6),(100,9,'16oz',0.00,1),(101,9,'22oz',10.00,2),(102,10,'Red Velvet',0.00,1),(103,10,'Cookie & Cream',0.00,2),(104,10,'Wintermelon',0.00,3),(105,10,'Okinawa',0.00,4),(106,10,'Chocolate',0.00,5),(107,11,'Pearl',10.00,1),(108,12,'Cheese',0.00,1),(109,12,'BBQ',0.00,2),(110,12,'Sour Cream',0.00,3);
/*!40000 ALTER TABLE `options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_item_options`
--

DROP TABLE IF EXISTS `order_item_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_item_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_item_id` int(11) NOT NULL,
  `option_group_name` varchar(60) NOT NULL,
  `option_name` varchar(60) NOT NULL,
  `price_modifier` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `order_item_id` (`order_item_id`),
  CONSTRAINT `order_item_options_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_item_options`
--

LOCK TABLES `order_item_options` WRITE;
/*!40000 ALTER TABLE `order_item_options` DISABLE KEYS */;
INSERT INTO `order_item_options` VALUES (1,4,'Size','16oz',0.00),(2,4,'Flavor','Red Velvet',0.00),(3,4,'Add-on','Pearl',10.00),(4,7,'Drink Flavor','Blue Lemonade',0.00),(5,8,'Drink Flavor','Blue Lemonade',0.00),(6,10,'Topping','Vegetable',0.00),(7,14,'Flavor','Cheese',0.00),(8,15,'Drink Flavor','Blue Lemonade',0.00),(9,16,'Drink Flavor','Pineapple',0.00),(10,17,'Drink Flavor','Chocolate',0.00),(11,20,'Size','Small',0.00),(12,20,'Flavor','Buko Pandan',0.00),(13,21,'Size','22oz',10.00),(14,21,'Flavor','Wintermelon',0.00),(15,21,'Add-on','Pearl',10.00),(16,26,'Flavor','Cheese',0.00),(17,29,'Size','Medium',5.00),(18,29,'Flavor','Melon',0.00),(19,30,'Size','Medium',5.00),(20,30,'Flavor','Avocado',0.00);
/*!40000 ALTER TABLE `order_item_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(120) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,1,4,'Burger Buy 1 Take 1',45.00,1,45.00),(2,1,14,'Siomai',10.00,4,40.00),(3,1,17,'Special Halo-Halo',50.00,1,50.00),(4,1,16,'Milk Tea',39.00,2,78.00),(5,1,20,'Fresh Avocado Shake',60.00,1,60.00),(6,1,21,'Fresh Mango Shake',60.00,1,60.00),(7,1,10,'Chicken Rings & Drinks',35.00,1,35.00),(8,1,8,'Fries & Drinks',35.00,1,35.00),(9,2,4,'Burger Buy 1 Take 1',45.00,1,45.00),(10,2,2,'Burger with Vegetable / Cheese',30.00,1,30.00),(11,2,3,'Burger with Vegetable and Cheese',35.00,1,35.00),(12,2,1,'Plain Burger',25.00,1,25.00),(13,2,5,'Cheesy Hotdog Buy 1 Take 1',55.00,1,55.00),(14,2,6,'Small Fries',30.00,1,30.00),(15,2,8,'Fries & Drinks',35.00,1,35.00),(16,2,10,'Chicken Rings & Drinks',35.00,1,35.00),(17,2,9,'Siomai & Drinks',40.00,1,40.00),(18,2,13,'Chocolate',20.00,1,20.00),(19,2,14,'Siomai',10.00,5,50.00),(20,2,15,'Shake',25.00,2,50.00),(21,2,16,'Milk Tea',49.00,1,49.00),(22,2,18,'Special Mais Conyelo',40.00,1,40.00),(23,2,19,'Special Saging Conyelo',40.00,1,40.00),(24,2,22,'Fresh Dragon Fruit Shake',60.00,1,60.00),(25,3,4,'Burger Buy 1 Take 1',45.00,1,45.00),(26,3,6,'Small Fries',30.00,1,30.00),(27,3,18,'Special Mais Conyelo',40.00,1,40.00),(28,3,20,'Fresh Avocado Shake',60.00,1,60.00),(29,3,15,'Shake',30.00,1,30.00),(30,3,15,'Shake',30.00,1,30.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(30) NOT NULL,
  `user_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','gcash','other') NOT NULL,
  `cash_received` decimal(10,2) DEFAULT NULL,
  `change_amount` decimal(10,2) DEFAULT NULL,
  `status` enum('completed','voided') NOT NULL DEFAULT 'completed',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `discount_id` (`discount_id`),
  KEY `idx_orders_created` (`created_at`),
  KEY `idx_orders_user` (`user_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'FH-20260926-001',2,403.00,1,80.60,322.40,'cash',350.00,27.60,'completed','2026-09-26 03:32:29'),(2,'FH-20260926-002',2,639.00,1,127.80,511.20,'cash',1000.00,488.80,'completed','2026-09-26 04:01:47'),(3,'FH-20261002-001',2,235.00,1,47.00,188.00,'cash',500.00,312.00,'completed','2026-10-02 02:04:50');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_ingredients`
--

DROP TABLE IF EXISTS `product_ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_ingredients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `quantity_required` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_ingredient` (`product_id`,`ingredient_id`),
  KEY `ingredient_id` (`ingredient_id`),
  CONSTRAINT `product_ingredients_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_ingredients_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_ingredients`
--

LOCK TABLES `product_ingredients` WRITE;
/*!40000 ALTER TABLE `product_ingredients` DISABLE KEYS */;
INSERT INTO `product_ingredients` VALUES (1,1,1,1.00),(2,1,2,1.00),(3,2,1,1.00),(4,2,2,1.00),(5,3,1,1.00),(6,3,2,1.00),(7,3,3,1.00),(8,3,4,1.00),(9,4,1,2.00),(10,4,2,2.00),(11,5,5,2.00),(12,5,6,2.00),(13,5,3,2.00),(14,6,7,1.00),(15,7,7,2.00),(16,8,7,1.00),(17,8,10,1.00),(18,9,8,4.00),(19,9,10,1.00),(20,10,9,1.00),(21,10,10,1.00),(22,11,10,1.00),(23,12,10,1.00),(24,13,10,1.00),(25,14,8,1.00),(26,15,13,1.00),(27,16,11,1.00),(28,17,14,1.00),(29,18,15,1.00),(30,19,16,1.00),(31,20,17,1.00),(32,21,18,1.00),(33,22,19,1.00);
/*!40000 ALTER TABLE `product_ingredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT '',
  `price` decimal(10,2) NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `available` tinyint(1) NOT NULL DEFAULT 1,
  `track_stock` tinyint(1) NOT NULL DEFAULT 0,
  `stock` int(11) DEFAULT NULL,
  `low_stock_threshold` int(11) DEFAULT 10,
  `sku` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_available` (`available`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,'Plain Burger','Soft bun, juicy patty, simple and satisfying.',25.00,'/images/products/burgers/gemini-generated-image-dgms0adgms0adgms-1790421108769.jfif',1,0,NULL,10,'BRG-001','2026-09-26 03:30:07','2026-09-26 11:11:48',NULL),(2,1,'Burger with Vegetable / Cheese','Choose vegetable or cheese topping.',30.00,'/images/products/burgers/gemini-generated-image-v02pxbv02pxbv02p-1790419876694.jfif',1,0,NULL,10,'BRG-002','2026-09-26 03:30:07','2026-09-26 10:51:16',NULL),(3,1,'Burger with Vegetable and Cheese','Loaded with fresh veggies and melted cheese.',35.00,'/images/products/burgers/gemini-generated-image-d4o4uid4o4uid4o4-1790419914127.jfif',1,0,NULL,10,'BRG-003','2026-09-26 03:30:07','2026-09-26 10:51:54',NULL),(4,1,'Burger Buy 1 Take 1','Two classic burgers, one great price.',45.00,'/images/products/burgers/gemini-generated-image-zhppt2zhppt2zhpp-1790420121881.jfif',1,0,NULL,10,'BRG-004','2026-09-26 03:30:07','2026-09-26 10:55:21',NULL),(5,1,'Cheesy Hotdog Buy 1 Take 1','Two cheesy hotdogs in soft buns.',55.00,'/images/products/burgers/cheesy-hotdog-b1t1.svg',1,0,NULL,10,'BRG-005','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(6,2,'Small Fries','Crispy golden fries, small serving.',30.00,'/images/products/fries/fries-small.svg',1,0,NULL,10,'FRY-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(7,2,'Large Fries','Crispy golden fries, large serving.',100.00,'/images/products/fries/fries-large.svg',1,0,NULL,10,'FRY-002','2026-09-26 03:30:07','2026-10-02 02:02:38',NULL),(8,3,'Fries & Drinks','Fries paired with your choice of drink.',35.00,'/images/products/combos/3352c892-3493-4ec5-95d4-c6bc34ef56d5-1790420870777.png',1,0,NULL,10,'CMB-001','2026-09-26 03:30:07','2026-09-26 11:07:50',NULL),(9,3,'Siomai & Drinks','Siomai paired with your choice of drink.',40.00,'/images/products/combos/siomai-drinks.svg',1,0,NULL,10,'CMB-002','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(10,3,'Chicken Rings & Drinks','Chicken rings paired with your choice of drink.',35.00,'/images/products/combos/chicken-rings-drinks.svg',1,0,NULL,10,'CMB-003','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(11,4,'Blue Lemonade','Refreshing blue lemonade, served cold.',20.00,'/images/products/drinks/blue-lemonade.svg',1,0,NULL,10,'DRK-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(12,4,'Pineapple','Refreshing pineapple drink, served cold.',20.00,'/images/products/drinks/pineapple.svg',1,0,NULL,10,'DRK-002','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(13,4,'Chocolate','Cold chocolate drink.',20.00,'/images/products/drinks/chocolate.svg',1,0,NULL,10,'DRK-003','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(14,5,'Big Siomai','Steamed siomai, ₱10 per piece.',10.00,'/images/products/siomai/gemini-generated-image-pgwbzopgwbzopgwb-1790419712450.jpeg',1,0,NULL,10,'SIO-001','2026-09-26 03:30:07','2026-09-26 10:48:32',NULL),(15,6,'Shake','Cold, thick, and creamy. Pick your size and flavor.',25.00,'/images/products/shakes/shake-base.svg',1,0,NULL,10,'SHK-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(16,7,'Milk Tea','Pick a size, flavor, and optional pearl add-on.',29.00,'/images/products/milk-tea/milk-tea-base.svg',1,0,NULL,10,'MLT-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(17,8,'Special Halo-Halo','Colorful Filipino halo-halo in a glass.',50.00,'/images/products/desserts/special-halo-halo.svg',1,0,NULL,10,'DST-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(18,8,'Special Mais Conyelo','Creamy corn and milk dessert.',40.00,'/images/products/desserts/special-mais-conyelo.svg',1,0,NULL,10,'DST-002','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(19,8,'Special Saging Conyelo','Creamy banana-based Filipino dessert.',40.00,'/images/products/desserts/special-saging-conyelo.svg',1,0,NULL,10,'DST-003','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(20,9,'Fresh Avocado Shake','Made with real fresh avocado.',60.00,'/images/products/fresh-shakes/fresh-avocado-shake.svg',1,0,NULL,10,'FSH-001','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(21,9,'Fresh Mango Shake','Made with real fresh mango.',60.00,'/images/products/fresh-shakes/fresh-mango-shake.svg',1,0,NULL,10,'FSH-002','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL),(22,9,'Fresh Dragon Fruit Shake','Made with real fresh dragon fruit.',60.00,'/images/products/fresh-shakes/fresh-dragon-fruit-shake.svg',1,0,NULL,10,'FSH-003','2026-09-26 03:30:07','2026-09-26 03:30:07',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(2,'cashier');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `setting_key` varchar(60) NOT NULL,
  `setting_value` varchar(500) NOT NULL DEFAULT '',
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('address','Imus, Cavite, Philippines'),('business_name','FOODTRIP HOUSE'),('contact_number','0900-000-0000'),('currency_symbol','₱'),('printer_width','58mm'),('receipt_footer','THANK YOU! COME AGAIN!');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'Admin User','admin','admin@foodtriphouse.com','$2b$12$QILenDPpYNkRlTQf4AV0huzEpzrVyE1uVNzWBaXt3MVtXnI6hBaem',1,'2026-09-26 03:30:07','2026-09-26 03:30:16'),(2,2,'Juan Dela Cruz','juan','juan@foodtriphouse.com','$2b$12$itL.r46.TCXHHQXwOjBYKuX2UvLQuZ52Wp8bMzM02R5nnQOjzJc96',1,'2026-09-26 03:30:07','2026-09-26 03:30:16');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-17 21:48:32
