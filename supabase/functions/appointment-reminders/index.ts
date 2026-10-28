// Desplegar como función programada. Requiere REMINDER_JOB_SECRET, RESEND_API_KEY
// y RESEND_FROM (dominio verificado en Resend). Solo envía si hay consentimiento explícito.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  if (req.headers.get("x-job-secret") !== Deno.env.get("REMINDER_JOB_SECRET")) return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM");
  if (!url || !key || !resendKey || !from) return Response.json({ error: "Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY o RESEND_FROM" }, { status: 500 });
  const db = createClient(url, key);
  const { data: queue, error } = await db.from("reminder_queue")
    .select("id,appointment_id,channel,scheduled_for,attempts,appointment:appointments(id,start_at,reason,status,pets(name,owner_name,owner_email,reminder_consent))")
    .eq("status", "pending").lte("scheduled_for", new Date().toISOString()).limit(50);
  if (error) return Response.json({ error: "No se pudo leer la cola" }, { status: 500 });
  let sent = 0, skipped = 0, failed = 0;
  for (const item of queue ?? []) {
    const appt = Array.isArray(item.appointment) ? item.appointment[0] : item.appointment;
    const pet = appt && (Array.isArray(appt.pets) ? appt.pets[0] : appt.pets);
    if (!appt || appt.status === "cancelled") {
      await db.from("reminder_queue").update({ status: "cancelled" }).eq("id", item.id); skipped++; continue;
    }
    if (item.channel !== "email" || !pet?.owner_email || pet.reminder_consent !== true) {
      await db.from("reminder_queue").update({ status: "cancelled", last_error: "No hay email o consentimiento explícito" }).eq("id", item.id); skipped++; continue;
    }
    const date = new Date(appt.start_at).toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Argentina/Cordoba" });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [pet.owner_email], subject: "Recordatorio de turno — Patitas", text: `Hola ${pet.owner_name || ""}. Te recordamos el turno de ${pet.name} para ${date}. Motivo: ${appt.reason}. Si necesitás cambiarlo, contactá a la veterinaria.\n\nPatitas Veterinaria` })
    });
    if (response.ok) {
      await db.from("reminder_queue").update({ status: "sent", attempts: (item.attempts ?? 0) + 1, last_error: null }).eq("id", item.id); sent++;
    } else {
      const errText = (await response.text()).slice(0, 500);
      await db.from("reminder_queue").update({ status: "failed", attempts: (item.attempts ?? 0) + 1, last_error: errText }).eq("id", item.id); failed++;
    }
  }
  return Response.json({ sent, skipped, failed, checked: queue?.length ?? 0 });
});
