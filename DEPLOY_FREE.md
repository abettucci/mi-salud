# Checklist de despliegue gratuito

- [ ] Proyecto Supabase Free creado en `sa-east-1` (São Paulo).
- [ ] Migración SQL ejecutada sin errores.
- [ ] Bucket `health-documents` confirmado como privado.
- [ ] Confirmación de correo habilitada en Supabase Auth.
- [ ] URL local y dominio `*.vercel.app` agregados a Redirect URLs.
- [ ] Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cargadas en Vercel.
- [ ] Ninguna clave `service_role`, contraseña de base o archivo clínico real incluida en Git.
- [ ] Deploy de Vercel probado con dos cuentas distintas: cada una debe ver una carpeta vacía propia.
- [ ] Un archivo de prueba se sube, se abre y no queda accesible luego de cerrar sesión.

Cuando necesites uso comercial, backups automáticos o datos de pacientes a escala, migrá a Supabase Pro y reemplazá Vercel Hobby por un plan apto para el uso previsto.
