CREATE TABLE `admin_user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_user_email_unique` ON `admin_user` (`email`);--> statement-breakpoint
CREATE TABLE `contact_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`session_type` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_image_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `galleries_slug_unique` ON `galleries` (`slug`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text,
	`filename` text NOT NULL,
	`s3_key` text NOT NULL,
	`cdn_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`alt_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`site_title` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`about_text` text DEFAULT '' NOT NULL,
	`about_image_url` text,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_form_enabled` integer DEFAULT 1 NOT NULL,
	`social_links` text DEFAULT '[]' NOT NULL
);
