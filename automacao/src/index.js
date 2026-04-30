require("dotenv").config();

var express = require("express");
var axios = require("axios");
var trelloService = require("./services/trello");
var handlers = require("./handlers");

var app = express();
app.use(express.json());

var PORT = process.env.PORT || 3000;
var LABEL_EMAIL_ENVIADO = process.env.TRELLO_LABEL_EMAIL_ENVIADO;

var processedCards = new Set();
var PROCESSED_TTL = 60 * 1000;

function markProcessed(cardId) {
  processedCards.add(cardId);
  setTimeout(function() { processedCards.delete(cardId); }, PROCESSED_TTL);
}

app.get("/webhook/trello", function(req, res) {
  res.sendStatus(200);
});

app.post("/webhook/trello", function(req, res) {
  res.sendStatus(200);

  var action = req.body.action;
  if (!action) return;
  if (action.type !== "addLabelToCard") return;

  var labelId = action.data && action.data.label && action.data.label.id;
  var card = action.data && action.data.card;

  if (!LABEL_EMAIL_ENVIADO || labelId !== LABEL_EMAIL_ENVIADO) return;

  var cardId = card && card.id;
  if (!cardId) return;

  if (processedCards.has(cardId)) {
    console.log("Card ja processado: " + cardId);
    return;
  }

  markProcessed(cardId);

  trelloService.getCard(cardId).then(function(fullCard) {
    return trelloService.getList(fullCard.idList).then(function(list) {
      var eventType = trelloService.identifyEventType(list.name);
      console.log("Novo evento: " + list.name + " | Card: " + fullCard.name);

      if (!eventType) {
        console.log("Lista nao mapeada: " + list.name);
        return;
      }

      if (eventType === "acionamento") {
        return handlers.handleAcionamento(fullCard);
      } else if (eventType === "negativa") {
        return handlers.handleNegativa(fullCard);
      } else if (eventType === "cancelamento") {
        return handlers.handleCancelamento(fullCard);
      }
    });
  }).then(function(result) {
    if (result) console.log("Resultado:", result);
  }).catch(function(err) {
    console.log("Erro: " + err.message);
  });
});

app.get("/health", function(req, res) {
  res.json({ status: "ok", service: "Destrave Automacao", timestamp: new Date().toISOString() });
});

app.get("/setup-webhook", function(req, res) {
  axios.post("https://api.trello.com/1/webhooks", {
    description: "Destrave Automacao",
    callbackURL: "https://destrave-automacao.onrender.com/webhook/trello",
    idModel: process.env.TRELLO_BOARD_ID,
  }, {
    params: {
      key: process.env.TRELLO_API_KEY,
      token: process.env.TRELLO_TOKEN,
    }
  }).then(function(result) {
    res.json({ success: true, webhook: result.data });
  }).catch(function(err) {
    res.json({ success: false, error: err.message });
  });
});

app.listen(PORT, function() {
  console.log("Destrave Automacao rodando na porta " + PORT);
  console.log("Health: http://localhost:" + PORT + "/health");
  console.log("Webhook: http://localhost:" + PORT + "/webhook/trello");
});
