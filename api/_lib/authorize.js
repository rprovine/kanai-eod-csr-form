export function authorize(req) {
  if (!process.env.CRON_SECRET) return true;
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.query?.token === process.env.CRON_SECRET) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form')) return true;
  return false;
}
