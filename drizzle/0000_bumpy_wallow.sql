CREATE TYPE "public"."episode_status" AS ENUM('published', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('funding', 'shutdown', 'launch', 'acquisition', 'other');--> statement-breakpoint
CREATE TYPE "public"."innovation_type" AS ENUM('model', 'product', 'research', 'open_source', 'patent', 'dataset');--> statement-breakpoint
CREATE TYPE "public"."investor_type" AS ENUM('vc', 'angel', 'cvc', 'accelerator', 'family_office', 'sovereign', 'other');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('pending', 'approved', 'rejected', 'auto_published');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'series_f_plus', 'bridge', 'debt', 'grant', 'undisclosed');--> statement-breakpoint
CREATE TYPE "public"."shutdown_cause" AS ENUM('capital_crunch', 'regulatory', 'governance', 'no_pmf', 'acquihire', 'competition', 'cofounder_conflict', 'pivot_failed', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."startup_status" AS ENUM('active', 'acquired', 'shutdown', 'dormant');--> statement-breakpoint
CREATE TABLE "founders" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"linkedin" text,
	"twitter" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"startup_id" integer NOT NULL,
	"round_type" "round_type" DEFAULT 'undisclosed' NOT NULL,
	"amount_usd" bigint,
	"amount_inr" bigint,
	"announced_date" date NOT NULL,
	"source_url" text,
	"source_name" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"auto_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "innovations" (
	"id" serial PRIMARY KEY NOT NULL,
	"startup_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"launch_date" date,
	"type" "innovation_type" DEFAULT 'product' NOT NULL,
	"arxiv_url" text,
	"github_url" text,
	"huggingface_url" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" "investor_type" DEFAULT 'vc' NOT NULL,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"source_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"excerpt" text,
	"status" "news_status" DEFAULT 'pending' NOT NULL,
	"event_type" "event_type",
	"extracted" text,
	"confidence" real,
	"resolved_startup_id" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"episode_number" integer,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"youtube_id" text,
	"spotify_url" text,
	"apple_url" text,
	"duration_seconds" integer,
	"transcript" text,
	"startup_id" integer,
	"founder_id" integer,
	"status" "episode_status" DEFAULT 'coming_soon' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_investors" (
	"round_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	CONSTRAINT "round_investors_round_id_investor_id_pk" PRIMARY KEY("round_id","investor_id")
);
--> statement-breakpoint
CREATE TABLE "shutdowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"startup_id" integer NOT NULL,
	"shutdown_date" date,
	"cause_tags" "shutdown_cause"[] NOT NULL,
	"story" text,
	"lessons" text,
	"total_raised_usd" bigint,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_founders" (
	"startup_id" integer NOT NULL,
	"founder_id" integer NOT NULL,
	"role" text,
	CONSTRAINT "startup_founders_startup_id_founder_id_pk" PRIMARY KEY("startup_id","founder_id")
);
--> statement-breakpoint
CREATE TABLE "startup_tags" (
	"startup_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "startup_tags_startup_id_tag_id_pk" PRIMARY KEY("startup_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "startups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"tagline" text,
	"description" text,
	"website" text,
	"logo_url" text,
	"hq_city" text,
	"hq_state" text,
	"founded_year" integer,
	"status" "startup_status" DEFAULT 'active' NOT NULL,
	"employee_range" text,
	"verified" boolean DEFAULT false NOT NULL,
	"source_urls" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"color_slot" integer
);
--> statement-breakpoint
ALTER TABLE "funding_rounds" ADD CONSTRAINT "funding_rounds_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innovations" ADD CONSTRAINT "innovations_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_resolved_startup_id_startups_id_fk" FOREIGN KEY ("resolved_startup_id") REFERENCES "public"."startups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_investors" ADD CONSTRAINT "round_investors_round_id_funding_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."funding_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_investors" ADD CONSTRAINT "round_investors_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shutdowns" ADD CONSTRAINT "shutdowns_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_founders" ADD CONSTRAINT "startup_founders_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_founders" ADD CONSTRAINT "startup_founders_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_tags" ADD CONSTRAINT "startup_tags_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_tags" ADD CONSTRAINT "startup_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "founders_slug_idx" ON "founders" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "funding_rounds_startup_idx" ON "funding_rounds" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "funding_rounds_date_idx" ON "funding_rounds" USING btree ("announced_date");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_rounds_dedupe_idx" ON "funding_rounds" USING btree ("startup_id","round_type","announced_date");--> statement-breakpoint
CREATE INDEX "innovations_startup_idx" ON "innovations" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "innovations_date_idx" ON "innovations" USING btree ("launch_date");--> statement-breakpoint
CREATE UNIQUE INDEX "investors_slug_idx" ON "investors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "investors_normalized_name_idx" ON "investors" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_url_idx" ON "news_items" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_items_status_idx" ON "news_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "podcast_episodes_slug_idx" ON "podcast_episodes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "podcast_episodes_status_idx" ON "podcast_episodes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shutdowns_startup_idx" ON "shutdowns" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "shutdowns_date_idx" ON "shutdowns" USING btree ("shutdown_date");--> statement-breakpoint
CREATE UNIQUE INDEX "startups_slug_idx" ON "startups" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "startups_normalized_name_idx" ON "startups" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "startups_status_idx" ON "startups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "startups_search_idx" ON "startups" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");