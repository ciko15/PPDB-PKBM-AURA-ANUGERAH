// Vercel Serverless Function: Proxy PDF Google Drive (bebas CORS) untuk Mode Baca Buku
// Setara dengan route app.get('/api/pdf-proxy') di server.js (yang hanya jalan di server lokal).
export default async function handler(req, res) {
  try {
    const { id, url } = req.query || {};
    let targetUrl = '';

    if (id) {
      if (!/^[a-zA-Z0-9_-]+$/.test(String(id))) {
        return res.status(400).send('ID file tidak valid');
      }
      targetUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
    } else if (url) {
      const parsed = new URL(String(url));
      if (!/(^|\.)google(usercontent)?\.com$/.test(parsed.hostname)) {
        return res.status(400).send('Hanya URL Google Drive yang diizinkan');
      }
      targetUrl = parsed.href;
    } else {
      return res.status(400).send('Parameter id atau url diperlukan');
    }

    const driveRes = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow'
    });

    if (!driveRes.ok) {
      return res.status(driveRes.status).send(`Google Drive HTTP ${driveRes.status}`);
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());

    // Pastikan yang dikirim benar-benar PDF (bukan halaman HTML konfirmasi Google)
    if (buffer.slice(0, 5).toString() !== '%PDF-') {
      return res.status(502).send('Respons Google Drive bukan file PDF');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).send('Gagal memuat PDF: ' + err.message);
  }
}
