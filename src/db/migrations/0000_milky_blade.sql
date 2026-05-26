CREATE TABLE "baths" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" varchar(50) DEFAULT 'stable',
	"last_measured_at" timestamp,
	"temperature_max" integer,
	"temperature_min" integer,
	"ph_max" integer,
	"ph_min" integer
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(50) DEFAULT 'open',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_number" varchar(50),
	"name" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"city" text,
	"address" text,
	"phone" text,
	"email" text,
	"pref_comm" varchar(50),
	"risk" varchar(50) DEFAULT 'Niedrig',
	"risk_note" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'hotel-kreile',
	"order_id" text NOT NULL,
	"item_id" text,
	"event_type" varchar(100) NOT NULL,
	"description" text,
	"notes" text,
	"user_id" uuid,
	"worker_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" varchar(100),
	"current_stock" integer DEFAULT 0,
	"min_stock" integer DEFAULT 0,
	"unit" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'hotel-kreile',
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"current_station_id" varchar(100) DEFAULT 'wareneingang',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'hotel-kreile',
	"order_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"task" text,
	"station" varchar(100) DEFAULT 'wareneingang' NOT NULL,
	"current_station_id" varchar(100),
	"status" varchar(50) DEFAULT 'in_progress' NOT NULL,
	"risk" varchar(50) DEFAULT 'green',
	"priority_computed" varchar(50) DEFAULT 'green',
	"parts" jsonb,
	"status_text" text,
	"delay_reason" text,
	"recommended_action" text,
	"intake_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "price_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"scope" text NOT NULL,
	"rate" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) DEFAULT 'workshop' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_agreements" ADD CONSTRAINT "price_agreements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;