CREATE TABLE `mensagens_whatsapp` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_mensagem_whatsapp` text NOT NULL,
	`telefone` text NOT NULL,
	`tipo` text NOT NULL,
	`texto` text,
	`id_midia` text,
	`tipo_conteudo` text,
	`chave_armazenamento` text,
	`status_midia` text DEFAULT 'nenhuma' NOT NULL,
	`latitude` real,
	`longitude` real,
	`payload_bruto` text NOT NULL,
	`recebido_em` text NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mensagens_whatsapp_id_mensagem_whatsapp_unique` ON `mensagens_whatsapp` (`id_mensagem_whatsapp`);--> statement-breakpoint
CREATE TABLE `tarefas_analise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mensagem_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`payload_envio` text,
	`status_resposta` integer,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`max_tentativas` integer DEFAULT 5 NOT NULL,
	`proxima_tentativa_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`travado_em` text,
	`concluido_em` text,
	`ultimo_erro` text,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`mensagem_id`) REFERENCES `mensagens_whatsapp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tarefas_analise_mensagem_endpoint_unico` ON `tarefas_analise` (`mensagem_id`,`endpoint`);--> statement-breakpoint
CREATE INDEX `tarefas_analise_fila_idx` ON `tarefas_analise` (`status`,`proxima_tentativa_em`);--> statement-breakpoint
DROP TABLE `reports`;