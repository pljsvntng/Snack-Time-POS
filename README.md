> **Android offline POS:** see [OFFLINE.md](OFFLINE.md) for encrypted SQLite, authentication, cash checkout and restart testing. See [DEPLOYMENT.md](DEPLOYMENT.md) for Render Free / Neon Free preparation and the pending synchronization phase.
>
> **Phone and tablet layouts:** see [RESPONSIVE.md](RESPONSIVE.md) for breakpoints, touch behavior, screenshots and responsive test commands.

> **Current database: PostgreSQL.** The application has been migrated and verified. See [MIGRATION.md](MIGRATION.md) for current startup, credentials, validation results and recovery instructions. The MariaDB setup instructions below describe the original version and must not be rerun against the migrated application.

# 🍔 FOODTRIP HOUSE — Point of Sale System

A complete, working small-business POS: React frontend, Node/Express backend, MySQL database.
Photo-based ordering, product customization, cart & checkout, cash/GCash/other payments, receipts,
inventory + recipe (BOM) deduction, role-based access (Admin/Cashier), transaction history,
sales reports, and an admin dashboard.

## ⚠️ Before you start — two honest notes

1. **Product photos are illustrated SVG placeholders**, not real commercial food photography. Nobody
   can generate genuine studio food photos for you automatically — you'll want to replace the files in
   `frontend/public/images/products/<category>/` with real photos (phone photos are fine, or hire a
   photographer for the polished catalog look described in the original brief). The Admin → Products
   page already has a working "Photo" upload button wired to the backend — just click it per product
   once you have real photos, no code changes needed.
2. **Standalone Drinks pricing (Blue Lemonade / Pineapple / Chocolate sold on their own, not as part of
   a combo) was not specified** in the original menu brief — only their combo pricing was. They're
   seeded at a placeholder ₱20 each. Change this in Admin → Products before going live.

Everything else — the database schema, every API endpoint, the cart/checkout/payment/receipt flow,
inventory deduction, and every admin screen — is real, working code, not a mockup.

---

## 1. What's included

```
foodtrip-house-pos/
├── frontend/        React 18 + Vite + React Router + Recharts
├── backend/         Node.js + Express + MySQL (mysql2) REST API
├── database/        schema.sql (tables) + seed.sql (full menu, users, ingredients, recipes)
├── scripts/         one-off script used to generate the placeholder product images
└── .env.example     copy to backend/.env
```

**Demo login accounts** (seeded, password hashes already in `seed.sql`):

| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | `admin`  | `admin123`  |
| Cashier | `juan`   | `cashier123`|

---

## 2. Setup — step by step (beginner friendly)

### Step 1 — Install Node.js
Download and install Node.js 18+ from https://nodejs.org (LTS version). Verify with:
```bash
node -v
npm -v
```

### Step 2 — Install MySQL
Install MySQL Community Server (https://dev.mysql.com/downloads/mysql/) or use a tool like
XAMPP/MAMP that bundles MySQL. Make sure the MySQL server is running and you know your root
password (or create a dedicated `foodtrip` user).

### Step 3 — Create the database
Open a MySQL client (MySQL Workbench, phpMyAdmin, or the `mysql` CLI) and run:
```sql
CREATE DATABASE foodtrip_house_pos CHARACTER SET utf8mb4;
```
(The `database/schema.sql` script also contains this line, so you can skip this if you run
schema.sql directly against your server.)

### Step 4 — Import the schema and seed data
From a terminal, **in the project root folder**:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p foodtrip_house_pos < database/seed.sql
```
(Enter your MySQL password when prompted. On Windows, use the MySQL Command Line Client or run the
same two files through MySQL Workbench's "Run SQL Script" feature.)

### Step 5 — Configure environment variables
Copy the example env file into the backend folder:
```bash
cp .env.example backend/.env
```
Then open `backend/.env` and fill in your real MySQL username/password:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=foodtrip_house_pos
PORT=4000
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
CLIENT_ORIGIN=http://localhost:5173
```

### Step 6 — Install backend dependencies
**In Terminal 1**, from the project root:
```bash
cd backend
npm install
```

### Step 7 — Install frontend dependencies
**In Terminal 2** (a separate terminal window), from the project root:
```bash
cd frontend
npm install
```

### Step 8 — Start the backend (Terminal 1)
```bash
cd backend
npm run dev
```
You should see: `Foodtrip House POS API running on http://localhost:4000`

### Step 9 — Start the frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Vite will print a local URL, normally `http://localhost:5173`. Open that in your browser.

### Step 10 — Log in
Use one of the demo accounts above. Cashiers land on the POS screen; admins land on the Dashboard.

---

## 3. Regenerating password hashes (optional)

The seeded password hashes correspond to `admin123` and `cashier123`. If you want to set your own
password for a new user via SQL directly (instead of the Admin → Users screen, which does this for
you automatically), generate a bcrypt hash with:
```bash
cd backend
node utils/generateHash.js yourNewPassword
```
Paste the printed hash into the `password_hash` column.

---

## 4. How the core workflow works

1. **Cashier logs in** → lands on the POS screen.
2. **Browses by category or searches**, taps a photo card.
3. If the product needs customization (flavor, size, add-on), a **modal** opens; required choices
   are enforced before "Add to Order" is enabled.
4. Item lands in the **cart** on the right, with live subtotal/discount/total.
5. **Complete Order** opens the payment modal — Cash (with change calculated, blocked if
   insufficient), GCash, or Other (paid in full, no change).
6. On confirm, the backend:
   - Re-validates every item's price/options/stock,
   - Checks and **deducts ingredient stock** according to each product's recipe (and any chosen
     add-on's extra ingredients, e.g. Milk Tea + Pearl),
   - Deducts direct piece-stock for items like Siomai,
   - Saves the order, order items, and chosen options,
   - Generates a unique order number (`FH-YYYYMMDD-###`),
   - Logs every stock change to `inventory_transactions` for a full audit trail.
7. A **receipt** renders immediately and can be printed (`window.print()`, styled for a narrow
   thermal-printer width) or reprinted later from Transaction History.
8. **Dashboard and Reports** read straight from the same `orders`/`order_items` tables, so numbers
   are always live — nothing is cached or hand-maintained.

## 5. Recipes / inventory deduction — how to extend it

`database/seed.sql` includes a starter set of ingredients and recipes (e.g. 1 Plain Burger = 1 bun +
1 patty; Milk Tea + Pearl add-on additionally consumes 1 serving of Pearl). This is deliberately a
**starting point**, not exhaustive for every flavor variant — extend it any time via:
- `PUT /api/products/:productId/recipe` (base ingredients per product), or
- `option_ingredients` table for ingredients tied to a specific add-on/flavor choice.

There's no dedicated recipe-editing screen in the UI yet (this was out of scope for the first pass);
it's a straightforward addition to the Products admin page if you want a visual editor — the API is
already there and working.

## 6. Roles

- **Admin**: Dashboard, POS, Products (+ image upload/deactivate), Inventory, Users, Transactions
  (all cashiers'), Reports, Settings.
- **Cashier**: POS, and their own Transaction History only. Cashiers cannot change prices, delete
  products, manage users, or edit past transactions — these routes are blocked server-side
  (`requireRole('admin')`), not just hidden in the UI.

## 7. Security notes

- Passwords are hashed with bcrypt, never stored in plain text.
- All API routes (except login) require a valid JWT; role-protected routes check the role
  server-side.
- All SQL queries use parameterized statements (no string-concatenated SQL).
- Raw database errors are never sent to the client — `middleware/errorHandler.js` maps them to
  friendly messages and logs the real error server-side.
- `.env` (with real credentials) is git-ignored; only `.env.example` is committed.

## 8. Known simplifications (so you know where to extend)

- Standalone drink pricing is a placeholder (see note at the top).
- Payments are recorded directly on the `orders` row rather than a separate `payments` table —
  fine for single-tender transactions; split payments would need a small schema addition.
- There's no built-in receipt-printer driver integration; "Print Receipt" uses the browser's print
  dialog with print-specific CSS sized for narrow thermal rolls — most POS thermal printers accept
  this via a standard printer driver.
- Product images are illustrated placeholders (see note at the top).
