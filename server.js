const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DASHBOARD_SENHA = process.env.DASHBOARD_SENHA || 'destrave2025';
const LOG_FILE = path.join(__dirname, 'logs.json');

function lerLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
  } catch(e) {}
  return [];
}

function salvarLog(entrada) {
  try {
    var logs = lerLogs();
    logs.push(entrada);
    if (logs.length > 5000) logs = logs.slice(-5000);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs));
  } catch(e) {}
}

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

      if (parsed.log) {
        salvarLog(parsed.log);
      }

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

  if (req.method === 'GET' && req.url === '/api/dashboard') {
    var auth = req.headers['x-dashboard-senha'];
    if (auth !== DASHBOARD_SENHA) {
      res.writeHead(401, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Senha incorreta'}));
      return;
    }
    var logs = lerLogs();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(logs));
    return;
  }

  if (req.method === 'GET' && req.url === '/dashboard') {
    fs.readFile(path.join(__dirname, 'dashboard.html'), function(err, data) {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(data);
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
