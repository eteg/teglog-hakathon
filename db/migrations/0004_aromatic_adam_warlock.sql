CREATE TABLE `rotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`origem` text NOT NULL,
	`destino` text NOT NULL,
	`tracado` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rotas_nome_unique` ON `rotas` (`nome`);--> statement-breakpoint
ALTER TABLE `casos` ADD `rota_id` integer REFERENCES rotas(id);--> statement-breakpoint
ALTER TABLE `casos` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `casos` ADD `longitude` real;