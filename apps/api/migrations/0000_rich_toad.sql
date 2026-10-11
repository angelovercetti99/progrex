CREATE TABLE `sync_rows` (
	`table_name` text NOT NULL,
	`id` text NOT NULL,
	`updated_at` text NOT NULL,
	`data` text NOT NULL,
	`server_seq` integer NOT NULL,
	PRIMARY KEY(`table_name`, `id`)
);
--> statement-breakpoint
CREATE INDEX `sync_rows_server_seq_idx` ON `sync_rows` (`server_seq`);