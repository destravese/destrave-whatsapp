console.log('SERVER V2 - rota /api/claude ativa');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

http.createServer(function(req, res) {

  if (req.method === 'POST' && req.url === '/api/claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'no key'}));
      return;
    }
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('{}'); return; }
      const payload = JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: parsed.messages
      });
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      const apiReq = https.request(options, function(apiRes) {
        let data = '';
        apiRes.on('data', function(c) { data += c; });
        apiRes.on('end', function() {
          res.writeHead(apiRes.statusCode, {'Content-Type': 'application/json'});
          res.end(data);
        });
      });
      apiReq.on('error', function(err) {
        res.writeHead(500);
        res.end(JSON.stringify({error: err.message}));
      });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  if (req.method === 'GET') {
    fs.readFile(path.join(__dirname, 'index.html'), function(err, data) {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT);
