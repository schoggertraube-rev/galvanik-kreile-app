CREATE TABLE "bath_measurements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bath_id" varchar NOT NULL,
	"temperature" integer,
	"ph" real,
	"status_after_measurement" varchar
);
--> statement-breakpoint
CREATE TABLE "baths" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bath_number" varchar NOT NULL,
	"name" text NOT NULL,
	"process_type" varchar NOT NULL,
	"station_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_number" varchar,
	"name" text NOT NULL,
	"type" varchar NOT NULL,
	"city" text,
	"email" varchar,
	"phone" varchar
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"sku" varchar NOT NULL,
	"name" text NOT NULL,
	"category" varchar,
	"unit" varchar,
	"current_stock" integer NOT NULL,
	"min_stock" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"item_number" varchar,
	"order_id" varchar NOT NULL,
	"customer_id" varchar,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"current_station_id" varchar
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_number" varchar NOT NULL,
	"customer_id" varchar,
	"title" text NOT NULL,
	"current_station_id" varchar,
	"status" varchar NOT NULL,
	"priority_computed" varchar
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"movement_type" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"unit" varchar,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"auth_user_id" varchar,
	"tenant_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"full_name" varchar NOT NULL,
	"role" varchar NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bath_measurements" ADD CONSTRAINT "bath_measurements_bath_id_baths_id_fk" FOREIGN KEY ("bath_id") REFERENCES "public"."baths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;