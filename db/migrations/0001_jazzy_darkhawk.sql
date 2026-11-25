CREATE TABLE `casos` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`status` text NOT NULL,
	`recebido_em` text NOT NULL,
	`dados` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `casos_id_unique` ON `casos` (`id`);