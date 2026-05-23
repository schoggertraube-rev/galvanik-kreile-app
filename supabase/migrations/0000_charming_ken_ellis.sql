CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"customer_id" text,
	"order_id" text,
	"item_id" text,
	"scan_id" text,
	"type" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_name" text,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"captured_by" text,
	"ocr_text" text
);
--> statement-breakpoint
CREATE TABLE "bath_additions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"bath_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bath_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"bath_id" text NOT NULL,
	"measured_at" timestamp DEFAULT now() NOT NULL,
	"measured_by" text,
	"temperature" real,
	"ph" real,
	"concentration" real,
	"conductivity" real,
	"visual_state" text,
	"status_after_measurement" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "baths" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"bath_number" text NOT NULL,
	"name" text NOT NULL,
	"process_type" text NOT NULL,
	"status" text DEFAULT 'stable' NOT NULL,
	"station_id" text NOT NULL,
	"target_values" jsonb,
	"last_measurement_at" timestamp,
	"next_measurement_due_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"subject" text,
	"body" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumable_uses" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_id" text NOT NULL,
	"item_id" text,
	"station_id" text,
	"inventory_item_id" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"booking_method" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"customer_number" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'normal',
	"address" text,
	"city" text,
	"email" text,
	"phone" text,
	"contact_person" text,
	"communication_preference" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" real DEFAULT 0 NOT NULL,
	"min_stock" real,
	"reorder_point" real,
	"storage_location_id" text,
	"supplier_id" text,
	"is_consumable" boolean DEFAULT true NOT NULL,
	"is_hazardous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"item_number" text NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"material" text,
	"surface_requested" text,
	"condition_in" text,
	"condition_out" text,
	"current_station_id" text,
	"status" text DEFAULT 'received' NOT NULL,
	"is_missing" boolean DEFAULT false NOT NULL,
	"is_damaged" boolean DEFAULT false NOT NULL,
	"needs_rework" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_scans" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"image_url" text NOT NULL,
	"status" text NOT NULL,
	"raw_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"promised_date" timestamp,
	"current_station_id" text,
	"status" text DEFAULT 'new' NOT NULL,
	"priority_manual" text,
	"priority_computed" text DEFAULT 'in_plan' NOT NULL,
	"blocker_reason" text,
	"next_action" text,
	"internal_notes" text,
	"customer_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"surface" text,
	"price" real NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"weight_kg" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_id" text,
	"item_id" text,
	"customer_id" text,
	"station_id" text,
	"event_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"note" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"inventory_item_id" text NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"order_id" text,
	"item_id" text,
	"station_id" text,
	"reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_time_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'hotel-kreile' NOT NULL,
	"order_id" text NOT NULL,
	"item_id" text,
	"station_id" text NOT NULL,
	"user_id" text,
	"activity_type" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"pause_minutes" integer DEFAULT 0 NOT NULL,
	"net_minutes" integer,
	"booking_method" text NOT NULL,
	"note" text
);
