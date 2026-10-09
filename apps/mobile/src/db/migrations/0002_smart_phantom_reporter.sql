CREATE TABLE `mesocycles` (
	`id` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`status` text NOT NULL,
	`plan` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`dirty` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `slot_id` text;--> statement-breakpoint
ALTER TABLE `workouts` ADD `mesocycle_id` text REFERENCES mesocycles(id);--> statement-breakpoint
ALTER TABLE `workouts` ADD `plan_week` integer;--> statement-breakpoint
ALTER TABLE `workouts` ADD `plan_session` integer;