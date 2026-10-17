-- Columnas opcionales: las cotizaciones EP1 conservan sus datos.
ALTER TABLE "quotes"
ADD COLUMN "configuration" JSONB,
ADD COLUMN "recommended_psu_watts" INTEGER;
