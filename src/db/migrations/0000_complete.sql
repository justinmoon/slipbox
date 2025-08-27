CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`file_key` text NOT NULL,
	`uploaded_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`note_id` text,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `files_note_id_idx` ON `files` (`note_id`);
--> statement-breakpoint
CREATE INDEX `files_uploaded_at_idx` ON `files` (`uploaded_at`);
--> statement-breakpoint
CREATE TABLE `note_search_index` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`char_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_updated_at_idx` ON `notes` (`updated_at`);
--> statement-breakpoint
CREATE INDEX `notes_created_at_idx` ON `notes` (`created_at`);
--> statement-breakpoint
CREATE TABLE `epub_reading_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`cfi` text NOT NULL,
	`percentage` integer DEFAULT 0 NOT NULL,
	`font_size` integer DEFAULT 100 NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `epub_reading_positions_file_id_idx` ON `epub_reading_positions` (`file_id`);
--> statement-breakpoint
CREATE INDEX `epub_reading_positions_updated_at_idx` ON `epub_reading_positions` (`updated_at`);