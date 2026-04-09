// api/exchange-code.js — Vercel Edge Function
// Intercambia el authorization code de Google por access_token + refresh_token
// El client_secret NUNCA sale al frontend

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'code y redirect_uri son requeridos' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el request viene de un usuario autenticado
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code:          code,
      redirect_uri:  redirect_uri,
      grant_type:    'authorization_code',
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await googleRes.json();

    if (!googleRes.ok || !data.access_token) {
      console.error('Google exchange error:', data);
      return new Response(JSON.stringify({ error: data.error || 'Exchange failed', details: data.error_description }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in:    data.expires_in || 3600,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('exchange-code error:', e);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}
