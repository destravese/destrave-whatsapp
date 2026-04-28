// scripts/register-webhook.js
// Rode após fazer deploy no Render para registrar o webhook no Trello
// node scripts/register-webhook.js

require('dotenv').config();
const axios = require('axios');

const { TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;

const RENDER_URL = process.env.RENDER_URL || 'https://sua-url.onrender.com';

async function registerWebhook() {
  console.log('📡 Registrando webhook no Trello...\n');

  try {
    const existing = await axios.get(
      `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks`,
      { params: { key: TRELLO_API_KEY } }
    );

    for (const wh of existing.data) {
      if (wh.idModel === TRELLO_BOARD_ID) {
        await axios.delete(
          `https://api.trello.com/1/webhooks/${wh.id}`,
          { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
        );
        console.log(`🗑️  Webhook antigo removido: ${wh.id}`);
      }
    }

    const res = await axios.post(
      'https://api.trello.com/1/webhooks',
      {
        description: 'Destrave Automação Pós-Atendimento',
        callbackURL: `${RENDER_URL}/webhook/trello`,
        idModel: TRELLO_BOARD_ID,
      },
      { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
    );

    console.log('✅ Webhook registrado com sucesso!');
    console.log(`   ID: ${res.data.id}`);
    console.log(`   URL: ${RENDER_URL}/webhook/trello`);
  } catch (err) {
    console.error('Erro ao registrar webhook:', err.response?.data || err.message);
  }
}

registerWebhook();
