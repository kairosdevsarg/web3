/* Configuración pública de Supabase.
 * Es seguro incluir la URL y la anon/publishable key en el cliente SIEMPRE que
 * Row Level Security esté habilitado y las políticas SQL estén aplicadas.
 * NUNCA pongas aquí la service_role key ni una clave de OpenAI.
 */
window.PATITAS_CONFIG = {
  supabaseUrl: 'https://kylvjxtzopdyzaxsbcok.supabase.co',
  supabaseAnonKey: 'sb_publishable_KBuTPNkIiC9xRUfyeom38g_asIikCBz',
  assistantFunctionName: 'assistant'
};
