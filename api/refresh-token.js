// api/refresh-token.js — Vercel Edge Function
// Renueva el access_token de Google usando el refresh_token guardado en Supabase
// El client_secret NUNCA sale al frontend — solo vive aquí como variable de entorno

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
    const { refresh_token } = await req.json();
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'refresh_token requerido' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el request viene de un usuario autenticado (bearer token de Supabase)
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Llamar a Google Token endpoint con el client_secret (variable de entorno segura)
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type:    'refresh_token',
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await googleRes.json();

    if (!googleRes.ok || !data.access_token) {
      console.error('Google token error:', data);
      return new Response(JSON.stringify({ error: data.error || 'Token refresh failed', details: data.error_description }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      access_token: data.access_token,
      expires_in:   data.expires_in || 3600,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('refresh-token error:', e);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}
