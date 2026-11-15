-- Motivo por el que no se pudo leer el texto de un documento (vacío = lectura correcta).
alter table public.health_documents
  add column if not exists analysis_error text check (char_length(analysis_error) <= 300);
