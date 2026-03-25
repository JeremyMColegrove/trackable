ALTER TABLE "users"
ADD COLUMN "has_admin_controls" boolean DEFAULT false NOT NULL;

WITH first_user AS (
  SELECT "id"
  FROM "users"
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1
)
UPDATE "users"
SET "has_admin_controls" = true
WHERE "id" IN (SELECT "id" FROM first_user)
  AND NOT EXISTS (
    SELECT 1
    FROM "users"
    WHERE "has_admin_controls" = true
  );
