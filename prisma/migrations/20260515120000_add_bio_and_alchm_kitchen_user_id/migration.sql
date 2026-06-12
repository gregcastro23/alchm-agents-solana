-- Add bio column to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN "bio" TEXT;

-- Add alchmKitchenUserId to users (alchm.kitchen's UUID, returned by sync-debit)
ALTER TABLE "users" ADD COLUMN "alchmKitchenUserId" TEXT;
CREATE UNIQUE INDEX "users_alchmKitchenUserId_key" ON "users"("alchmKitchenUserId");
