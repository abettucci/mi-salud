# Mi Salud — MVP gratuito

Portal personal para organizar documentos y eventos de salud. El MVP usa **Vercel Hobby** para Next.js y **Supabase Free** para autenticación, PostgreSQL y almacenamiento privado.

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sin variables de Supabase, la pantalla mantiene un modo demo con datos ficticios. Nunca carga archivos reales en ese modo.

## Configurar Supabase Free

1. Creá un proyecto gratuito en la región **South America (São Paulo) / `sa-east-1`**.
2. En **SQL Editor**, ejecutá [`supabase/migrations/202609230001_mi_salud_mvp.sql`](supabase/migrations/202609230001_mi_salud_mvp.sql). Crea las tablas, RLS y el bucket privado `health-documents`.
3. En **Authentication → URL Configuration**, agregá `http://localhost:3000` como URL local y luego el dominio de Vercel. Activá confirmación de correo antes de invitar testers.
4. En **Project Settings → API**, copiá Project URL y la clave *publishable* a `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

La clave publishable es segura para el navegador gracias a RLS. No uses nunca `service_role` ni una contraseña de base en el frontend.

## Desplegar gratis en Vercel

1. Subí el repositorio a GitHub y, en Vercel, elegí **Add New → Project**.
2. Elegí `frontend` como **Root Directory** y el framework Next.js.
3. Cargá las dos variables `NEXT_PUBLIC_SUPABASE_*` para Production y Preview.
4. Deploy. Agregá la URL final de Vercel a las URLs permitidas de Supabase Auth.

## Alcance real del MVP

- Registro e inicio de sesión por email, documentos privados, eventos, búsqueda y subida de PDF/JPG/PNG/HEIC hasta 15 MB.
- Los archivos se suben desde el navegador a un bucket privado; RLS limita filas y objetos al propietario autenticado.
- El OCR se mantiene como estado pendiente: no se envía contenido clínico a ningún proveedor externo.
- La pantalla de compartir es una experiencia de producto; compartir documentos con terceros requiere una fase posterior con invitaciones, permisos por documento y auditoría del servidor.

Consultá [SECURITY.md](SECURITY.md) antes de probar con cualquier información sensible.
