'use strict';
// Zero-dependency server: serves index.html and owns data.json.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, 'data.json');
const PORT = process.env.PORT || 8000;
const MAX_BODY = 10 * 1024 * 1024;

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function handleGetIndex(res) {
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) return send(res, 500, 'cannot read index.html');
    send(res, 200, data, 'text/html; charset=utf-8');
  });
}

function handleGetData(res) {
  fs.readFile(DATA_PATH, 'utf8', (err, text) => {
    send(res, 200, err ? 'null' : text, 'application/json; charset=utf-8');
  });
}

function handlePostData(req, res) {
  let body = '';
  let aborted = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) {
      aborted = true;
      send(res, 413, 'payload too large');
      req.destroy();
    }
  });
  req.on('end', () => {
    if (aborted) return;
    try {
      JSON.parse(body);
    } catch (e) {
      return send(res, 400, 'invalid JSON');
    }
    // temp file + rename keeps data.json intact if the write is interrupted
    const tmp = DATA_PATH + '.tmp';
    fs.writeFile(tmp, body, (err) => {
      if (err) return send(res, 500, 'write failed');
      fs.rename(tmp, DATA_PATH, (err2) => {
        if (err2) return send(res, 500, 'write failed');
        send(res, 200, 'ok');
      });
    });
  });
}

http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    return handleGetIndex(res);
  }
  if (req.method === 'GET' && pathname === '/data') {
    return handleGetData(res);
  }
  if (req.method === 'POST' && pathname === '/data') {
    return handlePostData(req, res);
  }
  send(res, 404, 'not found');
}).listen(PORT, '127.0.0.1', () => {
  console.log('Dual Timer:  http://localhost:' + PORT);
  console.log('Data file:   ' + DATA_PATH);
});
