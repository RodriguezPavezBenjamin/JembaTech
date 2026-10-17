ALTER TABLE "source_runs" ADD COLUMN "source_request_url" VARCHAR(300),
    ADD COLUMN "retrieval_ms" DOUBLE PRECISION,
    ADD COLUMN "duration_ms" INTEGER;

-- Evita dos consultas al proveedor en paralelo, incluso con varios procesos NestJS.
CREATE UNIQUE INDEX "source_runs_one_active_manual_api"
ON "source_runs" ("source") WHERE "mode" = 'manual-api' AND "status" = 'RUNNING';
