CREATE TYPE "public"."account_status" AS ENUM('active', 'reauth', 'error');--> statement-breakpoint
CREATE TYPE "public"."circle" AS ENUM('anchor', 'peer', 'rising', 'fan');--> statement-breakpoint
CREATE TYPE "public"."interaction_kind" AS ENUM('reply-to-me', 'my-reply', 'mention', 'dm', 'repost', 'collab', 'like');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'grower', 'studio');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('bluesky', 'x', 'threads', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('open', 'replied', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."follow_source" AS ENUM('replies', 'relationships', 'resurfaced', 'profile', 'unattributed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_attribution" (
	"account_id" text NOT NULL,
	"day" date NOT NULL,
	"source" "follow_source" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "follow_attribution_account_id_day_source_pk" PRIMARY KEY("account_id","day","source")
);
--> statement-breakpoint
CREATE TABLE "follower" (
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "follow_source",
	"source_ref" text,
	CONSTRAINT "follower_account_id_external_id_pk" PRIMARY KEY("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "follower_snapshot" (
	"account_id" text NOT NULL,
	"day" date NOT NULL,
	"followers" integer NOT NULL,
	CONSTRAINT "follower_snapshot_account_id_day_pk" PRIMARY KEY("account_id","day")
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"kind" "interaction_kind" NOT NULL,
	"inbound" boolean NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"external_ref" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "oauth_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"followers" integer DEFAULT 0 NOT NULL,
	"baseline_followers" integer DEFAULT 0 NOT NULL,
	"baseline_at" timestamp with time zone DEFAULT now() NOT NULL,
	"circle" "circle" NOT NULL,
	"pinned_circle" boolean DEFAULT false NOT NULL,
	"note" text,
	"last_greeted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"reply_ref" jsonb,
	"url" text NOT NULL,
	"text" text NOT NULL,
	"topic" text,
	"posted_at" timestamp with time zone NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"reposts" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"impressions" integer,
	"dated" boolean DEFAULT false NOT NULL,
	"resurfaced_at" timestamp with time zone,
	"resurface_external_id" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "reply" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"room_id" text,
	"text" text NOT NULL,
	"grade" text NOT NULL,
	"score" integer NOT NULL,
	"external_id" text,
	"url" text,
	"posted_via" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"reply_ref" jsonb,
	"url" text NOT NULL,
	"author_external_id" text NOT NULL,
	"author_handle" text NOT NULL,
	"author_name" text NOT NULL,
	"author_followers" integer,
	"text" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"velocity" double precision DEFAULT 0 NOT NULL,
	"audience_overlap" double precision DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"breakdown" jsonb,
	"manual" boolean DEFAULT false NOT NULL,
	"status" "room_status" DEFAULT 'open' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_completion" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"item_key" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_completion_user_id_day_item_key_pk" PRIMARY KEY("user_id","day","item_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "social_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"followers" integer DEFAULT 0 NOT NULL,
	"following" integer DEFAULT 0 NOT NULL,
	"pinned_post" jsonb,
	"credentials" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"product_id" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"error" text,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"user_id" text PRIMARY KEY NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_attribution" ADD CONSTRAINT "follow_attribution_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follower" ADD CONSTRAINT "follower_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follower_snapshot" ADD CONSTRAINT "follower_snapshot_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_completion" ADD CONSTRAINT "round_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account" ADD CONSTRAINT "social_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_account_id_social_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "follower_seen_idx" ON "follower" USING btree ("account_id","first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_unique" ON "interaction" USING btree ("person_id","kind","external_ref");--> statement-breakpoint
CREATE INDEX "interaction_time_idx" ON "interaction" USING btree ("person_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "person_unique" ON "person" USING btree ("account_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_unique" ON "post" USING btree ("account_id","external_id");--> statement-breakpoint
CREATE INDEX "post_time_idx" ON "post" USING btree ("account_id","posted_at");--> statement-breakpoint
CREATE INDEX "reply_account_idx" ON "reply" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "room_unique" ON "room" USING btree ("account_id","external_id");--> statement-breakpoint
CREATE INDEX "room_rank_idx" ON "room" USING btree ("account_id","status","score");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_account_unique" ON "social_account" USING btree ("user_id","platform","external_id");--> statement-breakpoint
CREATE INDEX "social_account_sync_idx" ON "social_account" USING btree ("status","last_synced_at");--> statement-breakpoint
CREATE INDEX "sync_run_account_idx" ON "sync_run" USING btree ("account_id","started_at");