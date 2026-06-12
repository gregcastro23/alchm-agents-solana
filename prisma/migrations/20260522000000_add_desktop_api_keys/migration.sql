CREATE TABLE IF NOT EXISTS "desktop_api_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "label" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "desktop_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "desktop_api_keys_token_key" ON "desktop_api_keys"("token");
CREATE INDEX IF NOT EXISTS "desktop_api_keys_user_id_idx" ON "desktop_api_keys"("user_id");
CREATE INDEX IF NOT EXISTS "desktop_api_keys_is_active_idx" ON "desktop_api_keys"("is_active");
