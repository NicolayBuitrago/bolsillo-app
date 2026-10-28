CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"starts_on" date NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_amount_positive_check" CHECK ("budgets"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid,
	"category_id" uuid,
	"amount_minor" bigint,
	"currency" char(3) NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"anchor_on" date NOT NULL,
	"next_due_on" date NOT NULL,
	"remind_days_before" integer DEFAULT 2 NOT NULL,
	"auto_create" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_payments_user_id_id_key" UNIQUE("user_id","id"),
	CONSTRAINT "recurring_payments_amount_check" CHECK ("recurring_payments"."amount_minor" > 0),
	CONSTRAINT "recurring_payments_auto_create_check" CHECK (not "recurring_payments"."auto_create" or "recurring_payments"."amount_minor" is not null),
	CONSTRAINT "recurring_payments_remind_check" CHECK ("recurring_payments"."remind_days_before" between 0 and 30)
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budgets_user_id_index" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_user_category_active_key" ON "budgets" USING btree ("user_id","category_id") WHERE "budgets"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "recurring_payments_user_id_index" ON "recurring_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_payments_due_idx" ON "recurring_payments" USING btree ("next_due_on") WHERE "recurring_payments"."active" and "recurring_payments"."auto_create";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_payment_fk" FOREIGN KEY ("user_id","recurring_payment_id") REFERENCES "public"."recurring_payments"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurring_occurrence_key" ON "transactions" USING btree ("recurring_payment_id","occurred_at") WHERE "transactions"."recurring_payment_id" is not null and "transactions"."deleted_at" is null;