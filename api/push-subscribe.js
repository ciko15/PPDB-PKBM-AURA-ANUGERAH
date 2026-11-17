// Vercel Serverless Function: Push Notification Subscription Endpoint
// Menerima push subscription dari browser / HP dan meneruskannya / menyimpannya
export default async function handler(req, res) {
  // Atur header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ success: true, message: 'Push subscribe endpoint ready (POST expected)' });
  }

  try {
    const { subscription, user } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription endpoint diperlukan' });
    }

    // Pada Vercel serverless (read-only filesystem), data subscription juga secara otomatis
    // disinkronkan langsung ke Google Sheets / Database Utama via frontend syncPushSubscriptionWithServer.
    return res.status(200).json({
      success: true,
      message: 'Push subscription berhasil diterima',
      user: user || { username: 'guest', role: 'Umum' }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
