CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`attempted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip`,`attempted_at`);