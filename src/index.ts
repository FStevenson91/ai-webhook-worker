/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		return new Response('Hello World!');
// 	},
// } satisfies ExportedHandler<Env>;

// Función para reenviar a Azure (se ejecuta en background)
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
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'ai-webhook-worker' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Webhook endpoint
    if (url.pathname === '/webhook') {
      // GET = verificación (Meta/WhatsApp envía esto primero)
      if (request.method === 'GET') {
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        
        // Token de verificación (en producción usa env.VERIFY_TOKEN)
        if (token === 'mi_token_secreto') {
          return new Response(challenge || 'OK');
        }
        return new Response('Token inválido', { status: 403 });
      }

      // POST = mensaje entrante
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
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'JSON inválido' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Ruta no encontrada
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
