# Patitas v2 — Gestión veterinaria con Supabase

Esta versión es una base de aplicación para preparar un despliegue real. Incluye inicio de sesión con Supabase Auth, datos centralizados, roles, vacunas estructuradas, calendario con control de superposición en PostgreSQL y asistente de IA con dictado/lectura del navegador.

## Archivos
- `index.html`, `styles.css`, `app.js`: interfaz responsive y lógica de cliente.
- `config.js`: URL y clave pública (anon/publishable) del proyecto Supabase.
- `supabase/schema.sql`: tablas, roles, RLS, auditoría, bloqueo de turnos superpuestos y cola de recordatorios.
- `supabase/functions/assistant/index.ts`: Edge Function que llama a OpenAI sin exponer la clave en el navegador.
- `supabase/functions/appointment-reminders/index.ts`: endpoint de trabajo programado para la cola; no envía mensajes hasta configurar proveedor y consentimiento.

## 1. Crear la base centralizada
1. Creá un proyecto en Supabase.
2. Abrí **SQL Editor** y ejecutá todo `supabase/schema.sql`.
3. En **Project Settings → API** copiá la Project URL y la clave pública `anon`/`publishable`.
4. Pegalas en `config.js`. Nunca pegues una `service_role` key en `config.js`.
5. Habilitá confirmación de correo, contraseña robusta y protección contra contraseñas filtradas si está disponible. Desactivá el registro público de usuarios.

## 2. Crear usuarios y asignar roles
1. En Supabase → Authentication → Users, creá cada usuario manualmente (administrador, veterinario y recepción).
2. Copiá el UUID de cada usuario y ejecutá en SQL Editor, reemplazando los datos:

```sql
insert into public.profiles (id, full_name, role, active)
values ('UUID-DEL-USUARIO', 'Nombre Apellido', 'admin', true);
```

Valores de `role`: `admin`, `vet`, `reception`. Creá primero al administrador. Solo el administrador puede gestionar perfiles a través de las políticas de la base de datos. No hay alta pública desde la pantalla de login.

## 3. Desplegar el asistente IA
Necesitás Node.js y Supabase CLI, y una clave de OpenAI API. Desde la carpeta del proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set OPENAI_API_KEY=TU_CLAVE OPENAI_MODEL=gpt-4o-mini APP_ORIGIN=https://tu-dominio.example
supabase functions deploy assistant
```

Configurá `APP_ORIGIN` con el origen real de la web (por ejemplo `https://patitas.tudominio.com`). La clave de OpenAI se guarda como secreto del servidor; nunca la pongas en HTML, JavaScript cliente o repositorio Git. La función exige una sesión válida y un perfil activo. El asistente es de apoyo administrativo/general, no un sistema de diagnóstico ni una herramienta conectada a los datos clínicos.

## 4. Publicar la web
Podés desplegar los archivos estáticos en Netlify, Vercel o GitHub Pages. Subí `index.html`, `styles.css`, `app.js` y `config.js`. Configurá Supabase Auth → URL Configuration con el dominio final y las URLs de redirección permitidas. Usá siempre HTTPS. Para un proyecto de producción, agregá un proceso de despliegue que no publique secretos.

## 5. Turnos y recordatorios
- PostgreSQL rechaza intervalos de turnos superpuestos, salvo turnos cancelados. Esto se aplica aunque dos usuarios intenten reservar al mismo tiempo.
- La tabla `reminder_queue` recibe un recordatorio previsto 24 horas antes del turno. El perfil del propietario incluye email y consentimiento explícito.
- Para enviar emails reales, verificá un dominio en Resend, configurá `RESEND_API_KEY`, `RESEND_FROM` y `REMINDER_JOB_SECRET` como secretos de Edge Functions, desplegá `appointment-reminders` y programá su invocación periódica con Supabase Cron/pg_cron o un scheduler externo que envíe el header `x-job-secret`. La función solo envía si el propietario tiene email y consentimiento. Probá primero con una dirección interna. SMS no está implementado.

## 6. Seguridad, permisos y backups
- RLS se aplica en la base de datos; no dependas solo de ocultar botones en la interfaz.
- `clinical_records` está separado para que recepción no pueda leer ni escribir diagnósticos e historia clínica. Administrador y veterinario sí pueden acceder.
- Las operaciones clínicas y administrativas dejan eventos en `audit_logs`; solo administrador puede consultarlos desde la base.
- Para respaldos, revisá Supabase **Database Backups** y contratá el plan adecuado para la frecuencia de backup y retención que necesites. Para mayor control, programá exportaciones cifradas fuera del proyecto y probá restauraciones periódicamente. Un backup no está configurado automáticamente por este repositorio.
- Para información clínica real, usá fotos en un bucket privado de Supabase Storage con políticas RLS; el formulario actual admite URL y no implementa carga privada de fotos.
- Usá cuentas individuales, MFA para administradores si está disponible, HTTPS, acceso mínimo necesario, retención definida y procedimiento de baja de empleados. No compartas contraseñas.
- Antes de producción, revisá requisitos legales aplicables a datos personales y clínicos en tu jurisdicción y probá el sistema con datos ficticios.

## 7. Accesibilidad
- Navegación por teclado y foco visible, etiquetas y estados accesibles, opción de texto grande y alto contraste.
- Dictado de voz mediante Web Speech API cuando el navegador lo soporte y conceda permiso de micrófono.
- Lectura de respuestas con `speechSynthesis` cuando esté disponible.
- La disponibilidad del dictado varía por navegador/sistema operativo; en algunos navegadores el audio puede procesarse por servicios del proveedor. Para personas que no puedan usar voz, se mantiene la entrada por teclado y controles estándar.

## 8. Validación antes de uso real
1. Probar en un proyecto Supabase de pruebas con datos ficticios.
2. Crear usuarios de los tres roles y confirmar que recepción no puede consultar `clinical_records` ni registrar vacunas.
3. Intentar crear dos turnos superpuestos desde dos sesiones y confirmar que el segundo falla.
4. Probar cancelación y reprogramación, errores de red y sesiones vencidas.
5. Verificar backups y restauración; configurar envío de recordatorios con consentimiento.
6. Hacer una revisión de seguridad y accesibilidad antes de cargar datos reales.
