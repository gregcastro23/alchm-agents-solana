-- Change economy table user_id columns from UUID to TEXT so CUID user IDs are accepted.
-- PostgreSQL: casting uuid → text is always safe and lossless.
ALTER TABLE "token_balances" ALTER COLUMN "user_id" TYPE TEXT;
ALTER TABLE "token_transactions" ALTER COLUMN "user_id" TYPE TEXT;
ALTER TABLE "token_transactions" ALTER COLUMN "transaction_group_id" TYPE TEXT;
ALTER TABLE "user_subscriptions" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "user_subscriptions" ALTER COLUMN "user_id" TYPE TEXT;
