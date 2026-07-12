CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`remember_token` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
