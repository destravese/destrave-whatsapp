const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_SENHA = process.env.DASHBOARD_SENHA || 'destrave2025';
const LOG_FILE = path.join(__dirname, 'logs.json');
const APRENDIZADOS_FILE = path.join(__dirname, 'aprendizados.json');

const USUARIOS = {
  camila:  process.env.SENHA_CAMILA  || 'camila123',
  suelen:  process.env.SENHA_SUELEN  || 'suelen123',
  thais:   process.env.SENHA_THAIS   || 'thais123',
};

function lerJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch(e) {}
  return fallback;
}

function salvarJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data)); } catch(e) {}
}

function salvarLog(entrada) {
  const logs = lerJSON(LOG_FILE, []);
  logs.push(entrada);
  if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  salvarJSON(LOG_FILE, logs);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
    res.end(data);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

http.createServer(async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await parseBody(req);
    const nome = (body.usuario || '').toLowerCase().trim();
    const senha = body.senha || '';

    if (nome === 'admin' && senha === ADMIN_SENHA) {
      return json(res, 200, { ok: true, role: 'admin', nome: 'Admin' });
    }

    if (USUARIOS[nome] && USUARIOS[nome] === senha) {
      salvarLog({ tipo: 'login', usuario: nome, ts: new Date().toISOString() });
      return json(res, 200, { ok: true, role: 'atendente', nome });
    }

    return json(res, 401, { ok: false, erro: 'Usuário ou senha incorretos' });
  }

  // ── CLAUDE API ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return json(res, 500, { error: 'no key' });

    const body = await parseBody(req);

    if (body.log) salvarLog(body.log);

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: body.messages
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

    const apiReq = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', c => data += c);
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });
    apiReq.on('error', err => json(res, 500, { error: err.message }));
    apiReq.write(payload);
    apiReq.end();
    return;
  }

  // ── REGISTRAR ACESSO À BASE ─────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/acesso-base') {
    const body = await parseBody(req);
    salvarLog({
      tipo: 'consulta_base',
      usuario: body.usuario || 'desconhecido',
      termo: body.termo || '',
      ts: new Date().toISOString()
    });
    return json(res, 200, { ok: true });
  }

  // ── APRENDIZADOS (GET e POST) ───────────────────────────────────────────────
  if (req.url === '/api/aprendizados') {
    if (req.method === 'GET') {
      const auth = req.headers['x-admin-senha'];
      const aprendizados = lerJSON(APRENDIZADOS_FILE, []);
      // atendentes veem só os não-rascunhos; admin vê tudo
      const lista = auth === ADMIN_SENHA ? aprendizados : aprendizados.filter(a => !a.rascunho);
      return json(res, 200, lista);
    }

    if (req.method === 'POST') {
      const auth = req.headers['x-admin-senha'];
      if (auth !== ADMIN_SENHA) return json(res, 401, { erro: 'Sem permissão' });

      const body = await parseBody(req);
      const aprendizados = lerJSON(APRENDIZADOS_FILE, []);
      const novo = {
        id: Date.now(),
        titulo: body.titulo || '',
        tipo: body.tipo || 'erro',        // 'erro' | 'regra' | 'processo'
        descricao: body.descricao || '',
        correto: body.correto || '',
        regra: body.regra || '',
        categoria: body.categoria || 'geral',
        ts: new Date().toISOString(),
        rascunho: body.rascunho || false
      };
      aprendizados.unshift(novo);
      salvarJSON(APRENDIZADOS_FILE, aprendizados);
      return json(res, 200, { ok: true, id: novo.id });
    }

    if (req.method === 'DELETE') {
      const auth = req.headers['x-admin-senha'];
      if (auth !== ADMIN_SENHA) return json(res, 401, { erro: 'Sem permissão' });
      const body = await parseBody(req);
      let aprendizados = lerJSON(APRENDIZADOS_FILE, []);
      aprendizados = aprendizados.filter(a => a.id !== body.id);
      salvarJSON(APRENDIZADOS_FILE, aprendizados);
      return json(res, 200, { ok: true });
    }
  }

  // ── DASHBOARD ADMIN (dados) ─────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/dashboard') {
    const auth = req.headers['x-admin-senha'];
    if (auth !== ADMIN_SENHA) return json(res, 401, { erro: 'Senha incorreta' });
    const logs = lerJSON(LOG_FILE, []);
    return json(res, 200, logs);
  }

  // ── PÁGINAS HTML ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/dashboard') {
    return serveFile(res, path.join(__dirname, 'dashboard.html'), 'text/html');
  }

  if (req.method === 'GET') {
    return serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT, () => {
  console.log('Destrave rodando na porta ' + PORT);
});
