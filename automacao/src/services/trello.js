// src/services/trello.js
const axios = require('axios');

const BASE = 'https://api.trello.com/1';
const auth = {
  key: process.env.TRELLO_API_KEY,
  token: process.env.TRELLO_TOKEN,
};

async function getCard(cardId) {
  const res = await axios.get(`${BASE}/cards/${cardId}`, {
    params: { ...auth, attachments: true, labels: true },
  });
  return res.data;
}

async function getList(listId) {
  const res = await axios.get(`${BASE}/lists/${listId}`, {
    params: auth,
  });
  return res.data;
}

async function downloadAttachment(attachment) {
  const res = await axios.get(attachment.url, {
    params: auth,
    responseType: 'arraybuffer',
    headers: { Authorization: `OAuth oauth_consumer_key="${auth.key}", oauth_token="${auth.token}"` },
  });
  return {
    filename: attachment.name,
    content: Buffer.from(res.data),
    contentType: attachment.mimeType || 'application/octet-stream',
  };
}

function identifyEventType(listName) {
  const name = listName.toUpperCase();
  if (name.includes('ACIONAMENTO')) return 'acionamento';
  if (name.includes('NEGADO') || name.includes('NEGATIVA')) return 'negativa';
  if (name.includes('CANCELAMENTO')) return 'cancelamento';
  return null;
}

function extractEmail(description) {
  if (!description) return null;
  const lines = description.split('\n');
  for (const line of lines) {
    const match = line.match(/email[:\s]+([^\s]+@[^\s]+)/i);
    if (match) return match[1].trim();
  }
  return null;
}

function extractClientName(cardName) {
  const parts = cardName.split(' - ');
  if (parts.length >= 2) {
    return parts.slice(1).join(' - ').trim();
  }
  return cardName.trim();
}

function extractDate(cardName) {
  const match = cardName.match(/(\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : null;
}

function separateAttachments(attachments) {
  const photos = [];
  const invoices = [];

  for (const att of attachments) {
    const name = att.name.toUpperCase();
    if (name.includes('NF') || name.includes('NOTA')) {
      invoices.push(att);
    } else {
      photos.push(att);
    }
  }

  return { photos, invoices };
}

function parseDescription(description) {
  if (!description) return {};

  const fields = {};
  const lines = description.split('\n');

  for (const line of lines) {
    if (line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const normalizedKey = key.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (normalizedKey === 'email') fields.email = value;
      else if (normalizedKey === 'servico' || normalizedKey === 'serviço') fields.servico = value;
      else if (normalizedKey === 'cidade') fields.cidade = value;
      else if (normalizedKey === 'problema') fields.problema = value;
      else if (normalizedKey === 'km' || normalizedKey === 'kms') fields.km = value;
    }
  }

  const separatorIndex = lines.findIndex(l => l.trim() === '---');
  if (separatorIndex !== -1) {
    fields.observacoes = lines.slice(separatorIndex + 1).join('\n').trim();
  } else {
    fields.contexto = description;
  }

  return fields;
}

module.exports = {
  getCard,
  getList,
  downloadAttachment,
  identifyEventType,
  extractEmail,
  extractClientName,
  extractDate,
  separateAttachments,
  parseDescription,
};
