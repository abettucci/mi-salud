# Seguridad y límites del MVP

## Controles implementados

- Supabase Auth separa las sesiones por usuario.
- La migración habilita Row Level Security en cada tabla: cada consulta exige que `owner_id = auth.uid()`.
- El bucket `health-documents` es privado, acepta solo PDF/JPG/PNG/HEIC/HEIF de hasta 15 MB y solo permite objetos dentro de la carpeta con el UUID del usuario autenticado.
- La vista de un documento solicita una URL firmada de 60 segundos después de pasar la política de Storage.
- La clave publicable puede estar en Vercel; la clave `service_role`, credenciales de base y secretos no deben llegar nunca al navegador.

## Límites deliberados del tier gratuito

No usar como historia clínica productiva ni como repositorio único de datos irremplazables. Supabase Free puede pausar proyectos inactivos y no provee el nivel de backups, soporte, monitoreo, análisis antimalware, MFA avanzado ni auditoría de producción requeridos para una operación clínica.

## Requisitos para recibir datos reales

- Revisión jurídica y de privacidad de acuerdo con el caso de uso y los prestadores involucrados.
- Backups verificados y procedimiento de recuperación.
- Escaneo antimalware, validación por contenido y cuarentena de archivos antes de publicar vistas.
- Permisos de compartición por recurso, destinatarios autenticados, vencimiento/revocación y auditoría inmutable del lado servidor.
- Rate limiting, CSP/HSTS, monitoreo, respuesta a incidentes y revisión independiente de seguridad.
- Evaluación contractual y de retención antes de activar OCR externo.
