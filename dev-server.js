const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = 8000;

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
