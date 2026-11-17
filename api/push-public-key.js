// Vercel Serverless Function: Push Public Key Endpoint
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BP7KCUfLkQMqYnzgQRwTBmOHxMcip_JXkNiACCoAdrg_wOTED9Awpb6nrY5x8tm9A2hAXmQbvOIzmxA3F-uylwE';

  return res.status(200).json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY
  });
}
