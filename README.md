# ai-webhook-worker

Cloudflare Worker que recibe webhooks (ej: WhatsApp/Meta) y reenvía los datos a un agente de IA en Azure, procesándolos en segundo plano.

## Arquitectura

```
Meta/WhatsApp ──► Cloudflare Worker ──► Azure App Service ──► Groq/Llama (IA)
                       ▲
               Dashboard (Pages)
```

## ¿Por qué Cloudflare Workers?

Meta exige respuesta en menos de 5 segundos. Un Worker corre en el "edge" (servidores distribuidos cerca del usuario), lo que permite responder en ~50ms en lugar de los ~200ms de un servidor tradicional centralizado.

## ¿Por qué `ctx.waitUntil()`?

Procesar con IA toma 1-3 segundos. Si esperamos esa respuesta antes de contestarle a Meta, podríamos pasar del límite de 5 segundos. Con `waitUntil`, el Worker responde "recibido" de inmediato y sigue procesando en segundo plano sin bloquear.

## ¿Por qué CORS manual?

El dashboard frontend (`pages.dev`) y el Worker (`workers.dev`) están en dominios distintos. El navegador bloquea esas peticiones por seguridad (CORS). En Workers no existe un paquete `cors` como en Express, así que se agregan los headers manualmente a cada respuesta.

## ¿Cómo conecta con Azure?

Cuando llega un POST a `/webhook`, el Worker:
1. Responde "recibido" inmediatamente a Meta
2. En background, reenvía el body a la API de Azure (`/api/agent/chat`) usando `ctx.waitUntil()`
3. Azure procesa el mensaje con el agente de IA (Groq/Llama)

## Endpoints

| Ruta | Método | Qué hace |
|------|--------|----------|
| `/health` | GET | Verifica que el Worker está activo |
| `/webhook` | GET | Verificación de token (registro de webhook en Meta) |
| `/webhook` | POST | Recibe mensajes y los reenvía a Azure |

## Desarrollo

```bash
npm install        # Instalar dependencias
npm run dev        # Servidor local en http://localhost:8787
npm run deploy     # Deploy a producción
wrangler tail      # Ver logs en tiempo real (producción)
```
