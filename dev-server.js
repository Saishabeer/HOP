const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = 8000;

// Minimal .env loader (no npm deps in this project) so the local mock auth
// endpoint below uses the same credentials as the real Netlify function,
// instead of a third hardcoded copy that could leak real secrets into git.
function loadEnv(filePath) {
  const env = {};
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    contents.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      env[key] = value;
    });
  } catch (e) {
    console.warn('No .env file found — local admin login will be unavailable.');
  }
  return env;
}

const env = loadEnv(path.join(root, '.env'));

const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.join(root, requestedPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // MOCK: Local Dev Server handling for Netlify Auth Function
  if (url.pathname === '/.netlify/functions/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!env.ADMIN_PASSWORD || !env.AUTH_TOKEN) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ADMIN_PASSWORD/AUTH_TOKEN not set in .env' }));
        } else if (payload.password === env.ADMIN_PASSWORD) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token: env.AUTH_TOKEN }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Incorrect password' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request' }));
      }
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, '404.html'), (notFoundErr, notFoundData) => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(notFoundErr ? 'Not Found' : notFoundData);
      });
      return;
    }

    const contentType = types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`HouseOfPrime running at http://127.0.0.1:${port}/`);
});
