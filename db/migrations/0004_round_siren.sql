CREATE TABLE `carriers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cnpj` text NOT NULL,
	`legal_name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carriers_cnpj_unique` ON `carriers` (`cnpj`);--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`centroid` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`incident_id` integer,
	`node` text NOT NULL,
	`rule` text NOT NULL,
	`input` text,
	`output` text,
	`reason` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `decisions_report` ON `decisions` (`report_id`);--> statement-breakpoint
CREATE INDEX `decisions_incident` ON `decisions` (`incident_id`);--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nfe_key` text,
	`invoice_number` text NOT NULL,
	`invoice_value` real NOT NULL,
	`volumes` integer NOT NULL,
	`route_id` integer NOT NULL,
	`carrier_id` integer NOT NULL,
	`driver_id` integer,
	`departed_at` text NOT NULL,
	`delivered_at` text,
	`freight_cost` real NOT NULL,
	`insurance_cost` real NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_nfe_key_unique` ON `deliveries` (`nfe_key`);--> statement-breakpoint
CREATE INDEX `deliveries_dimensions` ON `deliveries` (`route_id`,`carrier_id`,`driver_id`,`departed_at`);--> statement-breakpoint
CREATE INDEX `deliveries_invoice` ON `deliveries` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `driver_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`closed_at` text,
	`thread_id` text NOT NULL,
	CONSTRAINT "driver_reports_status_check" CHECK(status in ('open', 'closed', 'processing', 'waiting', 'done'))
);
--> statement-breakpoint
CREATE INDEX `driver_reports_phone_status` ON `driver_reports` (`phone`,`status`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`cpf_masked` text,
	`carrier_id` integer,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_phone_unique` ON `drivers` (`phone`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`media_key` text NOT NULL,
	`sha256` text NOT NULL,
	`kind` text NOT NULL,
	`received_at` text NOT NULL,
	`source_phone` text,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `graph_checkpoint_writes` (
	`thread_id` text NOT NULL,
	`checkpoint_ns` text DEFAULT '' NOT NULL,
	`checkpoint_id` text NOT NULL,
	`task_id` text NOT NULL,
	`idx` integer NOT NULL,
	`channel` text NOT NULL,
	`value_type` text NOT NULL,
	`value` text NOT NULL,
	`task_path` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`thread_id`, `checkpoint_ns`, `checkpoint_id`, `task_id`, `idx`)
);
--> statement-breakpoint
CREATE TABLE `graph_checkpoints` (
	`thread_id` text NOT NULL,
	`checkpoint_ns` text DEFAULT '' NOT NULL,
	`checkpoint_id` text NOT NULL,
	`parent_checkpoint_id` text,
	`checkpoint_type` text NOT NULL,
	`checkpoint` text NOT NULL,
	`metadata_type` text NOT NULL,
	`metadata` text NOT NULL,
	PRIMARY KEY(`thread_id`, `checkpoint_ns`, `checkpoint_id`)
);
--> statement-breakpoint
CREATE TABLE `incident_clusters` (
	`incident_id` integer NOT NULL,
	`cluster_id` integer NOT NULL,
	`similarity` real NOT NULL,
	PRIMARY KEY(`incident_id`, `cluster_id`),
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`report_id` text,
	`thread_id` text,
	`source` text DEFAULT 'seed' NOT NULL,
	`delivery_id` integer,
	`route_id` integer,
	`carrier_id` integer,
	`driver_id` integer,
	`type` text NOT NULL,
	`reason_text` text,
	`cost` real,
	`cost_estimated` integer DEFAULT false NOT NULL,
	`insurance_cost` real,
	`payer` text,
	`claim_deadline` text,
	`confidence` real,
	`status` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `driver_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "incidents_type_check" CHECK(type in ('damage', 'loss', 'refusal', 'redelivery', 'discrepancy', 'accident', 'delay')),
	CONSTRAINT "incidents_status_check" CHECK(status in ('awaiting_transcription', 'awaiting_evidence', 'pending_review', 'registered', 'billed', 'recovered', 'lost')),
	CONSTRAINT "incidents_payer_check" CHECK(payer is null or payer in ('insurer', 'carrier', 'shipper', 'absorbed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_number_unique` ON `incidents` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_thread_id_unique` ON `incidents` (`thread_id`);--> statement-breakpoint
CREATE INDEX `incidents_listing` ON `incidents` (`occurred_at`,`type`,`status`);--> statement-breakpoint
CREATE INDEX `incidents_dimensions` ON `incidents` (`route_id`,`carrier_id`,`driver_id`);--> statement-breakpoint
CREATE TABLE `insurance_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`carrier_id` integer NOT NULL,
	`policy_number` text NOT NULL,
	`deductible` real NOT NULL,
	`covers_loading_unloading` integer DEFAULT false NOT NULL,
	`ad_valorem_pct` real NOT NULL,
	`gris_pct` real NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`media_key` text,
	`media_sha256` text,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`external_id` text,
	`transcript` text,
	`transcript_status` text,
	`transcript_confidence` real,
	`transcribed_at` text,
	FOREIGN KEY (`report_id`) REFERENCES `driver_reports`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "messages_kind_check" CHECK(kind in ('text', 'audio', 'image'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_external_id_unique` ON `messages` (`external_id`);--> statement-breakpoint
CREATE INDEX `messages_report` ON `messages` (`report_id`);--> statement-breakpoint
CREATE TABLE `model_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text,
	`node` text NOT NULL,
	`model` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`schema_valid` integer,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real NOT NULL,
	`latency_ms` integer NOT NULL,
	`error` text,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_calls_report` ON `model_calls` (`report_id`);--> statement-breakpoint
CREATE TABLE `node_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`node` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`waiting` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `node_runs_report` ON `node_runs` (`report_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`action` text NOT NULL,
	`corrected_fields` text,
	`reviewer` text NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`origin_ibge` text NOT NULL,
	`destination_ibge` text NOT NULL,
	`name` text NOT NULL,
	`corridor` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routes_origin_destination` ON `routes` (`origin_ibge`,`destination_ibge`);