import { supabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const checks = {
    supabase: false,
    webhookTable: false,
    webhookSecret: !!process.env.GHL_WEBHOOK_SECRET,
    ghlApiKey: !!process.env.GHL_API_KEY,
    ghlLocationId: !!process.env.GHL_LOCATION_ID,
    pendingEvents: 0,
  };

  if (supabaseAdmin) {
    checks.supabase = true;

    // Check webhook table exists and count pending events
    const { data, error } = await supabaseAdmin
      .from('ghl_webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false);

    if (!error) {
      checks.webhookTable = true;
      checks.pendingEvents = data?.length ?? 0;
    }

    // Check user mapping table
    const { data: mappings, error: mapError } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('ghl_user_id, ghl_user_name, employee_id');

    checks.userMappings = !mapError ? (mappings || []).length : 0;
  }

  const allCritical = checks.supabase && checks.webhookTable;
  const status = allCritical ? 'ready' : 'not_ready';

  return res.status(200).json({
    status,
    mode: 'webhook',
    webhookUrl: `https://${req.headers.host}/api/ghl/webhook`,
    checks,
    help: !allCritical ? {
      missing: [
        !checks.supabase && 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
        !checks.webhookTable && 'Run migration 002_ghl_integration.sql',
        !checks.webhookSecret && 'GHL_WEBHOOK_SECRET (optional but recommended)',
        !checks.ghlApiKey && 'GHL_API_KEY (Private Integration Token)',
        !checks.ghlLocationId && 'GHL_LOCATION_ID',
      ].filter(Boolean),
    } : undefined,
  });
}
