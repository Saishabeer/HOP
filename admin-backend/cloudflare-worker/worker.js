import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 2. Enforce POST method
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: getCorsHeaders(env),
      });
    }

    // 3. Authenticate the request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: getCorsHeaders(env),
      });
    }

    try {
      // 4. Parse request body
      const { filename, contentType } = await request.json();
      
      if (!filename || !contentType) {
        return new Response(JSON.stringify({ error: 'Missing filename or contentType' }), {
          status: 400,
          headers: getCorsHeaders(env),
        });
      }

      // Sanitize filename and add unique prefix
      const uniqueFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // 5. Initialize aws4fetch client
      const aws = new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: 's3',
        region: 'auto',
      });

      // 6. Generate Pre-signed URL
      const url = new URL(`https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${uniqueFilename}`);
      url.searchParams.set('X-Amz-Expires', '3600'); // 1 hour expiry
      
      // We sign the request using aws4fetch
      const signedRequest = await aws.sign(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        }
      });

      const publicUrl = `${env.PUBLIC_R2_URL}/${uniqueFilename}`;

      return new Response(JSON.stringify({
        uploadUrl: signedRequest.url,
        publicUrl: publicUrl
      }), {
        headers: { ...getCorsHeaders(env), 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: getCorsHeaders(env),
      });
    }
  }
};

function getCorsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Content-Type': 'application/json'
  };
}
