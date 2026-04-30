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
  if (name.i
