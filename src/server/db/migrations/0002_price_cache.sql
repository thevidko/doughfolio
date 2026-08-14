CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`market_cap_rank` integer,
	`refreshed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spot_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`currency` text NOT NULL,
	`price` text NOT NULL,
	`fetched_at` text NOT NULL
);
