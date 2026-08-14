CREATE TABLE `storage_types` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`behavior` text DEFAULT 'plain' NOT NULL,
	`builtin` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`type` text NOT NULL,
	`asset_id` text NOT NULL,
	`quantity` text NOT NULL,
	`unit_price` text,
	`price_currency` text,
	`fee_quantity` text,
	`fee_asset_id` text,
	`transfer_group_id` text,
	`occurred_at` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wallet_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `wallets` ADD `group_id` text REFERENCES wallet_groups(id);--> statement-breakpoint
ALTER TABLE `wallets` ADD `storage_type_id` text REFERENCES storage_types(id);--> statement-breakpoint
ALTER TABLE `wallets` ADD `sort_order` integer DEFAULT 0 NOT NULL;