UPDATE "blocklist"
SET "email" = lower(btrim("email", E' \t\r\n'))
WHERE "email" <> lower(btrim("email", E' \t\r\n'));
