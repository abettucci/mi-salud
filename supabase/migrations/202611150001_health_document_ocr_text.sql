-- Texto extraído localmente en el navegador (OCR/PDF). Solo lo lee el dueño por RLS.
alter table public.health_documents
  add column if not exists ocr_text text not null default '' check (char_length(ocr_text) <= 50000);
