-- Conservar UUID y relaciones existentes. No borrar usuarios ni cotizaciones.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "firebase_uid" VARCHAR(128);
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");
