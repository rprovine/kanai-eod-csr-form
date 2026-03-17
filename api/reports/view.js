import { supabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { week } = req.query;
  if (!week) {
    return res.status(400).json({ error: 'week parameter required (YYYY-MM-DD)' });
  }

  try {
    const { data: report, error } = await supabaseAdmin
      .from('weekly_reports')
      .select('*')
      .eq('week_start', week)
      .single();

    if (error || !report) {
      return res.status(404).json({ error: 'Report not found for that week' });
    }

    // Convert markdown to simple HTML
    const htmlContent = report.report_content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Report: ${report.week_start} - ${report.week_end}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f8f9fa;
      color: #1a1a1a;
      line-height: 1.6;
    }
    h1 { color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 8px; }
    h2 { color: #374151; }
    h3 { color: #4b5563; margin-top: 20px; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 20px 0; }
    strong { color: #1a56db; }
    li { margin-left: 20px; list-style: disc; }
    .meta { color: #6b7280; font-size: 0.9em; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="meta">Generated: ${new Date(report.created_at).toLocaleString()}</div>
  ${htmlContent}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('View report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
