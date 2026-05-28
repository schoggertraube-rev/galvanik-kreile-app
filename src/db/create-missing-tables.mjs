import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in env");
}

console.log("Connecting directly to PostgreSQL...");
const sql = postgres(connectionString, { max: 1 });

async function main() {
  try {
    console.log("Dropping existing tables to avoid type conflicts...");
    await sql`DROP TABLE IF EXISTS complaints CASCADE;`;
    await sql`DROP TABLE IF EXISTS events CASCADE;`;
    await sql`DROP TABLE IF EXISTS items CASCADE;`;
    await sql`DROP TABLE IF EXISTS orders CASCADE;`;
    await sql`DROP TABLE IF EXISTS price_agreements CASCADE;`;
    await sql`DROP TABLE IF EXISTS customers CASCADE;`;
    await sql`DROP TABLE IF EXISTS users CASCADE;`;
    await sql`DROP TABLE IF EXISTS baths CASCADE;`;
    await sql`DROP TABLE IF EXISTS inventory_items CASCADE;`;
    await sql`DROP TABLE IF EXISTS bath_measurements CASCADE;`;
    await sql`DROP TABLE IF EXISTS stock_movements CASCADE;`;
    await sql`DROP TABLE IF EXISTS status_events CASCADE;`;

    console.log("Creating missing tables with IF NOT EXISTS...");

    // 1. Users
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        role varchar(50) NOT NULL DEFAULT 'workshop',
        active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 2. Customers
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id text PRIMARY KEY,
        customer_number varchar(50),
        name text NOT NULL,
        type varchar(50) NOT NULL,
        city text,
        address text,
        phone text,
        email text,
        pref_comm varchar(50),
        risk varchar(50) DEFAULT 'Niedrig',
        risk_note text,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 3. Price Agreements
    await sql`
      CREATE TABLE IF NOT EXISTS price_agreements (
        id text PRIMARY KEY,
        customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        scope text NOT NULL,
        rate text NOT NULL,
        date timestamp DEFAULT now() NOT NULL
      );
    `;

    // 4. Orders
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY,
        tenant_id varchar(50) DEFAULT 'galvanik-kreile',
        order_number text NOT NULL UNIQUE,
        customer_id text NOT NULL REFERENCES customers(id),
        title text NOT NULL,
        task text,
        station varchar(100) NOT NULL DEFAULT 'wareneingang',
        current_station_id varchar(100),
        status varchar(50) NOT NULL DEFAULT 'in_progress',
        risk varchar(50) DEFAULT 'green',
        priority_computed varchar(50) DEFAULT 'green',
        parts jsonb,
        status_text text,
        delay_reason text,
        recommended_action text,
        intake_date timestamp DEFAULT now(),
        due_date timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 4.5 Items
    await sql`
      CREATE TABLE IF NOT EXISTS items (
        id text PRIMARY KEY,
        tenant_id varchar(50) DEFAULT 'galvanik-kreile',
        order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        customer_id text NOT NULL REFERENCES customers(id),
        name text NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        current_station_id varchar(100) DEFAULT 'wareneingang',
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 5. Events
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id text PRIMARY KEY,
        tenant_id varchar(50) DEFAULT 'galvanik-kreile',
        order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        item_id text,
        event_type varchar(100) NOT NULL,
        description text,
        notes text,
        user_id uuid REFERENCES users(id),
        worker_id varchar(100),
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 6. Complaints
    await sql`
      CREATE TABLE IF NOT EXISTS complaints (
        id text PRIMARY KEY,
        order_id text NOT NULL REFERENCES orders(id),
        customer_id text NOT NULL REFERENCES customers(id),
        reason text NOT NULL,
        status varchar(50) DEFAULT 'open',
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // 7. Baths
    await sql`
      CREATE TABLE IF NOT EXISTS baths (
        id text PRIMARY KEY,
        name text NOT NULL,
        status varchar(50) DEFAULT 'stable',
        last_measured_at timestamp,
        temperature_max integer,
        temperature_min integer,
        ph_max integer,
        ph_min integer
      );
    `;

    // 8. Inventory Items
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id text PRIMARY KEY,
        name text NOT NULL,
        category varchar(100),
        current_stock integer DEFAULT 0,
        min_stock integer DEFAULT 0,
        unit varchar(20)
      );
    `;

    // Add task column to orders if not exists (already done, but let's double check)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS task text;`;

    console.log("✅ All missing tables and columns created successfully!");
  } catch (error) {
    console.error("❌ SQL execution failed:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
