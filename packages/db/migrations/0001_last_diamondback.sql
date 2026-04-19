CREATE TABLE "vault"."effective_charge_rows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"source_period_value" text NOT NULL,
	"effective_period_value" text NOT NULL,
	"category" text NOT NULL,
	"category_original" text NOT NULL,
	"category_group" text,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"quantity_value" double precision,
	"quantity_unit" text,
	"unit_price_minor" bigint,
	"confidence" double precision NOT NULL,
	"source_page" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault"."effective_charge_rows" ADD CONSTRAINT "effective_charge_rows_hash_records_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."records"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vault_effective_charge_rows_hash_idx" ON "vault"."effective_charge_rows" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "vault_effective_charge_rows_effective_period_idx" ON "vault"."effective_charge_rows" USING btree ("effective_period_value");--> statement-breakpoint
CREATE INDEX "vault_effective_charge_rows_category_period_idx" ON "vault"."effective_charge_rows" USING btree ("category","effective_period_value");--> statement-breakpoint
CREATE INDEX "vault_effective_charge_rows_source_period_idx" ON "vault"."effective_charge_rows" USING btree ("source_period_value");