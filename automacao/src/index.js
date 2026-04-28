require('dotenv').config();

const express = require('express');
const axios = require('axios');
const trelloService = require('./services/trello');
const { handleAcionamento, handleNegativa, handleCancelamento } = require('./handlers');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LABEL_EMAIL_ENVIADO = process.env.TRELLO_LABEL_EMAIL_ENVIADO;

const processedCards = new Set();
const PROCESSED_TTL = 60 * 1000;

function markProcessed(cardId) {
  processedCards.add(cardId);
  setTimeout(() => processedCards.delete(cardId), PROCESSED_TTL);
}

app.get('/webhook/trello', (req, res) => {
  res.sendStatus(200);
});

app.post('/webhook/trello', async (req, res) => {
  res.sendStatus(200);

  const { action } = req.body;
  if (!action) return;
  if (action.type !== 'addLabelToCard') return;

  const labelId = action.data && action.data.label && action.data.label.id;
  const card = action.data && action.data.card;

  if (!LABEL_EMAIL_ENVIADO || labelId !== LABEL_EMAIL_ENVIADO) return;

  const cardId = card && card.id;
  if (!cardId) return;

  if (processedCards.has(cardId)) {
    console.log('Card ' + cardId + ' ja processado recentemente. Ignorando.');
    return;
  }

  markProcessed(cardId);

  try {
    const fullCard = await trelloService.getCard(cardId);
    const list = await trelloService.getList(fullCard.idList);
    const eventType = trelloService.identifyEventType(list.name);

    console.log('Novo evento: ' + list.name + ' | Card: ' + fullCard.name);

    if (!eventType) {
      console.log('Lista nao mapeada: ' + list.name + '. Ignorando.');
      return;
    }

    let result;
    if (eventType === 'acionamento') {
      result = await handleAcionamento(fullCard);
    } else if (eventType === 'negativa') {
      result = await handleNegativa(fullCard);
    } else if (eventType === 'cancelamento') {
      result = await handleCancelamento(fullCard);
    }

    console.log('Resultado:', result);

  } catch (err) {
    console.error('Erro ao processar card ' + cardId + ':', err.message);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Destrave Automacao', timestamp: new Date().toISOString() });
});

app.get('/setup-webhook', async (req, res) => {
  try {
    const result = await axios.post('https://api.trello.com/1/webhooks', {
      description: 'Destrave Automacao',
      callbackURL: 'https://destrave-automacao.onrender.com/webhook/trello',
      idModel: process.env.TRELLO_BOARD_ID,
    }, {
      params: {
        key: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
      }
    });
    res.json({ success: true, webhook: result.data });
  } catch (err) {
    res.json({ success: false, error: (err.response && err.response.data) || err.message });
  }
});

app.listen(PORT, () => {
  console.log('Destrave Automacao rodando na porta ' + PORT);
  console.log('Health: http://localhost:' + PORT + '/health');
  console.log('Webhook: http://localhost:' + PORT + '/webhook/trello');
});
