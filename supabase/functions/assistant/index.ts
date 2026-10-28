import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Se requiere iniciar sesión" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey || !openaiKey) return json({ error: "Falta configuración del servidor" }, 500);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Sesión inválida" }, 401);
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin.from("profiles").select("role,active").eq("id", user.id).single();
  if (!profile?.active) return json({ error: "Usuario no autorizado" }, 403);
  let body: { message?: string };
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }
  const message = (body.message ?? "").trim();
  if (!message || message.length > 4000) return json({ error: "El mensaje debe tener entre 1 y 4000 caracteres" }, 400);
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.chat.completions.create({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sos el asistente de accesibilidad y apoyo administrativo de Patitas, una veterinaria de Argentina. Respondé en español latino claro, amable y breve. Ayudá con procesos administrativos, navegación, listas de verificación y explicaciones generales. No diagnostiques, no indiques dosis ni tratamientos veterinarios personalizados y no sustituyas al profesional veterinario. Ante urgencias, indicá contactar a un veterinario. No afirmes que accedés a datos de pacientes, agenda o inventario: no tenés esa conexión. No solicites datos personales sensibles innecesarios. Usá listas cortas y lenguaje inclusivo y sencillo." },
        { role: "user", content: message },
      ],
      max_tokens: 500,
    });
    return json({ reply: response.choices[0]?.message?.content?.trim() ?? "No pude generar una respuesta. Intentá de nuevo." });
  } catch (e) {
    console.error("assistant function failed", e);
    return json({ error: "El asistente no está disponible en este momento" }, 502);
  }
});
