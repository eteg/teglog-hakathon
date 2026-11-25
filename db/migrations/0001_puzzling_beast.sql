CREATE TABLE `analysis_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`request_payload` text,
	`response_status` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`next_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`locked_at` text,
	`completed_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `whatsapp_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_jobs_message_endpoint_unique` ON `analysis_jobs` (`message_id`,`endpoint`);--> statement-breakpoint
CREATE INDEX `analysis_jobs_queue_index` ON `analysis_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_message_id` text NOT NULL,
	`from_phone` text NOT NULL,
	`type` text NOT NULL,
	`text_body` text,
	`media_id` text,
	`content_type` text,
	`storage_key` text,
	`media_status` text DEFAULT 'none' NOT NULL,
	`latitude` real,
	`longitude` real,
	`raw_payload` text NOT NULL,
	`received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_messages_whatsapp_message_id_unique` ON `whatsapp_messages` (`whatsapp_message_id`);--> statement-breakpoint
DROP TABLE `reports`;