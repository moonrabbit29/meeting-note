CREATE TABLE `form_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fields_json` text NOT NULL,
	`files_json` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
