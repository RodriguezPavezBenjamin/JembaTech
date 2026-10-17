-- Migración aditiva: no altera ni elimina cotizaciones existentes.
CREATE TABLE "source_runs" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "mode" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "created_by_id" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "metrics" JSONB,
    "issues" JSONB,
    "stored_count" INTEGER NOT NULL DEFAULT 0,
    "stale_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(80),
    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "source_runs_status_check" CHECK ("status" IN ('RUNNING', 'SUCCEEDED', 'FAILED'))
);

CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "external_id" VARCHAR(40) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(80) NOT NULL,
    "part_number" VARCHAR(120),
    "specs" JSONB NOT NULL,
    "source_url" VARCHAR(300) NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "source_updated_at" TIMESTAMP(3),
    "content_hash" VARCHAR(64) NOT NULL,
    "access_status" VARCHAR(40) NOT NULL,
    "acquisition_mode" VARCHAR(40) NOT NULL,
    "internal_catalog_id" VARCHAR(120),
    "last_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "source_runs_source_started_at_idx" ON "source_runs"("source", "started_at");
CREATE UNIQUE INDEX "external_references_source_external_id_key" ON "external_references"("source", "external_id");
CREATE INDEX "external_references_source_category_retrieved_at_idx" ON "external_references"("source", "category", "retrieved_at");
CREATE INDEX "external_references_source_brand_idx" ON "external_references"("source", "brand");
CREATE INDEX "external_references_internal_catalog_id_idx" ON "external_references"("internal_catalog_id");
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_last_run_id_fkey" FOREIGN KEY ("last_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
