CREATE TABLE `historical_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`price` text NOT NULL
);
