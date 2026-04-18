CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "auth";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "vault";
--> statement-breakpoint
CREATE TABLE "app"."review_flag" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_ref" text NOT NULL,
	"flag" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"resolved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"cursor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Europe/Warsaw' NOT NULL,
	"period_view" text,
	"dashboard_month" text,
	"preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."anomalies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"severity" text NOT NULL,
	"subject_hash" text,
	"payload_signature" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."document_sources" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_ref" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	"original_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."documents" (
	"hash" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"page_count" integer,
	"has_text_layer" boolean DEFAULT false NOT NULL,
	"needs_ocr" boolean DEFAULT false NOT NULL,
	"ocr_status" text DEFAULT 'not_needed' NOT NULL,
	"document_date" date,
	"asset_tag" text,
	"local_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."email_attachments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"gmail_id" text NOT NULL,
	"attachment_index" integer NOT NULL,
	"attachment_id" text,
	"filename" text,
	"declared_mime" text,
	"sniffed_mime" text,
	"size_bytes" bigint,
	"hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."emails" (
	"gmail_id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"history_id" text,
	"internal_date" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"sender" text,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_path" text NOT NULL,
	"raw_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."financial_rows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"row_type" text NOT NULL,
	"category" text NOT NULL,
	"category_original" text NOT NULL,
	"category_group" text,
	"period_kind" text NOT NULL,
	"period_value" text,
	"period_start" date,
	"period_end" date,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"quantity_value" double precision,
	"quantity_unit" text,
	"unit_price_minor" bigint,
	"confidence" double precision NOT NULL,
	"source_page" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "vault"."important_dates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"date" date NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."record_search" (
	"record_hash" text PRIMARY KEY NOT NULL,
	"title" text,
	"summary_plain" text,
	"key_facts" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."records" (
	"hash" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"extractor_version" text NOT NULL,
	"extracted_at" timestamp with time zone NOT NULL,
	"extracted_by" text NOT NULL,
	"status" text NOT NULL,
	"confidence" double precision NOT NULL,
	"document_type" text NOT NULL,
	"document_date" date,
	"period_kind" text NOT NULL,
	"period_value" text,
	"period_start" date,
	"period_end" date,
	"title" text NOT NULL,
	"summary_plain" text NOT NULL,
	"record_path" text NOT NULL,
	"note_path" text,
	"record_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault"."resolutions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"number" text NOT NULL,
	"subject" text NOT NULL,
	"outcome" text NOT NULL,
	"voting_method" text,
	"money_limit_amount_minor" bigint,
	"money_limit_currency" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "vault"."sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."review_flag" ADD CONSTRAINT "review_flag_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."review_flag" ADD CONSTRAINT "review_flag_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."document_sources" ADD CONSTRAINT "document_sources_hash_documents_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."documents"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."email_attachments" ADD CONSTRAINT "email_attachments_gmail_id_emails_gmail_id_fk" FOREIGN KEY ("gmail_id") REFERENCES "vault"."emails"("gmail_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."email_attachments" ADD CONSTRAINT "email_attachments_hash_documents_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."documents"("hash") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."financial_rows" ADD CONSTRAINT "financial_rows_hash_records_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."records"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."important_dates" ADD CONSTRAINT "important_dates_hash_records_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."records"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."record_search" ADD CONSTRAINT "record_search_record_hash_records_hash_fk" FOREIGN KEY ("record_hash") REFERENCES "vault"."records"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."records" ADD CONSTRAINT "records_hash_documents_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."documents"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault"."resolutions" ADD CONSTRAINT "resolutions_hash_records_hash_fk" FOREIGN KEY ("hash") REFERENCES "vault"."records"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_review_flag_subject_unique" ON "app"."review_flag" USING btree ("subject_kind","subject_ref","flag");--> statement-breakpoint
CREATE INDEX "app_review_flag_status_idx" ON "app"."review_flag" USING btree ("status");--> statement-breakpoint
CREATE INDEX "app_sync_state_status_idx" ON "app"."sync_state" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_account_provider_account_unique" ON "auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_invitation_token_hash_unique" ON "auth"."invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_invitation_email_idx" ON "auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_invitation_expires_at_idx" ON "auth"."invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_session_token_unique" ON "auth"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_expires_at_idx" ON "auth"."session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_user_email_unique" ON "auth"."user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_verification_expires_at_idx" ON "auth"."verification" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_anomalies_unique" ON "vault"."anomalies" USING btree ("rule_id","subject_hash","payload_signature");--> statement-breakpoint
CREATE INDEX "vault_anomalies_status_idx" ON "vault"."anomalies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vault_document_sources_hash_idx" ON "vault"."document_sources" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_document_sources_unique" ON "vault"."document_sources" USING btree ("hash","source_kind","source_ref");--> statement-breakpoint
CREATE INDEX "vault_documents_asset_tag_idx" ON "vault"."documents" USING btree ("asset_tag");--> statement-breakpoint
CREATE INDEX "vault_documents_document_date_idx" ON "vault"."documents" USING btree ("document_date");--> statement-breakpoint
CREATE INDEX "vault_email_attachments_gmail_id_idx" ON "vault"."email_attachments" USING btree ("gmail_id");--> statement-breakpoint
CREATE INDEX "vault_email_attachments_hash_idx" ON "vault"."email_attachments" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_email_attachments_unique" ON "vault"."email_attachments" USING btree ("gmail_id","attachment_index");--> statement-breakpoint
CREATE INDEX "vault_emails_thread_id_idx" ON "vault"."emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "vault_emails_received_at_idx" ON "vault"."emails" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "vault_financial_rows_hash_idx" ON "vault"."financial_rows" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "vault_financial_rows_category_period_idx" ON "vault"."financial_rows" USING btree ("category","period_kind","period_value","period_start","period_end");--> statement-breakpoint
CREATE INDEX "vault_important_dates_date_idx" ON "vault"."important_dates" USING btree ("date");--> statement-breakpoint
CREATE INDEX "vault_record_search_updated_at_idx" ON "vault"."record_search" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "vault_records_document_type_idx" ON "vault"."records" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "vault_records_period_idx" ON "vault"."records" USING btree ("period_kind","period_value","period_start","period_end");--> statement-breakpoint
CREATE INDEX "vault_resolutions_outcome_idx" ON "vault"."resolutions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "vault_sync_runs_kind_status_idx" ON "vault"."sync_runs" USING btree ("kind","status");
