import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();

const allowedOrigins = new Set([
  'https://ashbis.app',
  'https://ashbis-ae5b2.web.app',
  'http://localhost:8100',
  'http://localhost:4200'
]);

type RateState = { count: number; startMs: number };
const rateLimitMap = new Map<string, RateState>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function corsHeaders(origin?: string): Record<string, string> {
  if (origin && allowedOrigins.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    };
  }
  return {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function hitRateLimit(uid: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(uid);
  if (!current || now - current.startMs > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, startMs: now });
    return false;
  }
  current.count += 1;
  rateLimitMap.set(uid, current);
  return current.count > RATE_LIMIT_MAX;
}

export const aiProxy = onRequest(async (req, res) => {
  const origin = req.headers.origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(match[1]);
    if (hitRateLimit(decoded.uid)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    const prompt = String(req.body?.prompt || '').trim();
    const categoria = String(req.body?.categoria || '').trim();
    const mascota = String(req.body?.mascota || '').trim();
    if (!prompt || prompt.length > 5000) {
      res.status(400).json({ error: 'Invalid prompt' });
      return;
    }

    const geminiKey = functions.config()?.gemini?.key;
    if (!geminiKey) {
      res.status(200).json({
        text:
          'Ashbis IA esta en modo basico temporal. Configura la clave de Gemini para respuestas completas. Mientras tanto, ante sintomas graves en tu mascota, acude a un veterinario de urgencia.'
      });
      return;
    }

    const upstreamResp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Categoria: ${categoria}\nMascota: ${mascota}\n${prompt}` }] }]
        })
      }
    );

    if (!upstreamResp.ok) {
      const body = await upstreamResp.text();
      res.status(502).json({ error: 'Upstream Gemini error', detail: body.slice(0, 500) });
      return;
    }

    const data = await upstreamResp.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
