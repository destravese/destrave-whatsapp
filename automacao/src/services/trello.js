require("dotenv").config();

var axios = require("axios");

var BASE = "https://api.trello.com/1";
var auth = {
  key: process.env.TRELLO_API_KEY,
  token: process.env.TRELLO_TOKEN,
};

async function getCard(cardId) {
  var res = await axios.get(BASE + "/cards/" + cardId, {
    params: { key: auth.key, token: auth.token, attachments: true, labels: true },
  });
  return res.data;
}

async function getList(listId) {
  var res = await axios.get(BASE + "/lists/" + listId, {
    params: { key: auth.key, token: auth.token },
  });
  return res.data;
}

async function downloadAttachment(attachment) {
  var res = await axios.get(attachment.url, {
    params: { key: auth.key, token: auth.token },
    responseType: "arraybuffer",
  });
  return {
    filename: attachment.name,
    content: Buffer.from(res.data),
    contentType: attachment.mimeType || "application/octet-stream",
  };
}

function identifyEventType(listName) {
  var name = listName.toUpperCase();
  if (name.includes("ACIONAMENTO")) return "acionamento";
  if (name.includes("NEGADO") || name.includes("NEGATIVA")) return "negativa";
  if (name.includes("CANCELAMENTO")) return "cancelamento";
  return null;
}

function extractEmail(description) {
  if (!description) return null;
  var firstLine = description.split("\n")[0];
  var markdownMatch = firstLine.match(/\(mailto:([^)]+)\)/i);
  if (markdownMatch) return markdownMatch[1].trim().replace(/["\s]/g, "");
  var simpleMatch = firstLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (simpleMatch) return simpleMatch[1].trim().replace(/["\s]/g, "");
  return null;
}

function extractClientName(cardName) {
  var parts = cardName.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return cardName.trim();
}

function extractDate(cardName) {
  var match = cardName.match(/(\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : null;
}

function separateAttachments(attachments) {
  var photos = [];
  var invoices = [];
  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var name = att.name.toUpperCase();
    if (name.includes("NF") || name.includes("NOTA")) {
      invoices.push(att);
    } else {
      photos.push(att);
    }
  }
  return { photos: photos, invoices: invoices };
}

function parseDescription(description) {
  if (!description) return {};
  var fields = {};
  var lines = description.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.includes(":")) {
      var colonIndex = line.indexOf(":");
      var key = line.substring(0, colonIndex).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      var value = line.substring(colonIndex + 1).trim();
      if (key === "email") fields.email = value;
      else if (key === "servico") fields.servico = value;
      else if (key === "cidade") fields.cidade = value;
      else if (key === "estado" || key === "uf") fields.estado = value;
      else if (key === "problema") fields.problema = value;
      else if (key === "km" || key === "kms") fields.km = value;
    }
  }
  var separatorIndex = -1;
  for (var j = 0; j < lines.length; j++) {
    if (lines[j].trim() === "---") { separatorIndex = j; break; }
  }
  if (separatorIndex !== -1) {
    fields.observacoes = lines.slice(separatorIndex + 1).join("\n").trim();
  } else {
    fields.contexto = description;
  }
  return fields;
}

module.exports = {
  getCard: getCard,
  getList: getList,
  downloadAttachment: downloadAttachment,
  identifyEventType: identifyEventType,
  extractEmail: extractEmail,
  extractClientName: extractClientName,
  extractDate: extractDate,
  separateAttachments: separateAttachments,
  parseDescription: parseDescription,
};
