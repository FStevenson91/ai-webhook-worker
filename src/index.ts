/**
 * Cloudflare Worker que actúa como webhook receiver
 * y forwardea eventos a un agente de IA alojado en Azure.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function forwardToAzure(data: unknown): Promise<void> {
  try {
    const response = await fetch('https://ai-agent-felipe.azurewebsites.net/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'webhook-session',
        message: JSON.stringify(data)
      })
    });
    
    const result = await response.json();
    console.log('Azure response:', JSON.stringify(result));
  } catch (error) {
    console.error('Error forwarding to Azure:', error);
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'ai-webhook-worker' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/webhook') {
      if (request.method === 'GET') {
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        
        // En producción este token debe venir desde env.VERIFY_TOKEN
        // para evitar exponer secretos en el código
        if (token === 'mi_token_secreto') {
          return new Response(challenge || 'OK', { headers: corsHeaders });
        }
        return new Response('Token inválido', { status: 403, headers: corsHeaders });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          
          console.log('Webhook recibido:', JSON.stringify(body));
          
          // Responder rápido a Meta (evita timeout)
          ctx.waitUntil(
            forwardToAzure(body)
          );
          
          return new Response(JSON.stringify({ 
            received: true, 
            timestamp: new Date().toISOString()
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'JSON inválido' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;