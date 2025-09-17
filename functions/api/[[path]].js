/**
 * Cloudflare Pages Function to proxy API calls to Worker
 * This function acts as a bridge between Pages and the Worker
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the worker URL from environment variables
  const workerUrl = env.WORKER_URL || 'https://screen-recorder-worker.youraccount.workers.dev';
  
  // Forward the request to the worker
  const workerRequest = new Request(workerUrl + url.pathname + url.search, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  try {
    const response = await fetch(workerRequest);
    return response;
  } catch (error) {
    console.error('Error proxying to worker:', error);
    return new Response('Service Unavailable', { status: 503 });
  }
}