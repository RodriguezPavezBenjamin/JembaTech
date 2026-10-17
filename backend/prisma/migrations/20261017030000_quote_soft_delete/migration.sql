-- Borrado lógico: conservar armados y datos de coordinación existentes.
ALTER TABLE "quotes" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN "request_deleted_at" TIMESTAMP(3);
