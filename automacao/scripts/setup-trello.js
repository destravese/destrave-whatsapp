// scripts/setup-trello.js
// Rode este script UMA VEZ para descobrir os IDs das suas listas e etiquetas
// node scripts/setup-trello.js

require('dotenv').config();
const axios = require('axios');

const { TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;

async function setup() {
  console.log('🔍 Buscando listas e etiquetas do board Destrave...\n');

  const listsRes = await axios.get(
    `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists`,
    { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
  );

  console.log('📋 LISTAS ENCONTRADAS:');
  listsRes.data.forEach(list => {
    console.log(`  Nome: "${list.name}"`);
    console.log(`  ID:   ${list.id}`);
    console.log('');
  });

  const labelsRes = await axios.get(
    `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/labels`,
    { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
  );

  console.log('🏷️  ETIQUETAS ENCONTRADAS:');
  labelsRes.data.forEach(label => {
    console.log(`  Nome: "${label.name}"`);
    console.log(`  ID:   ${label.id}`);
    console.log('');
  });

  console.log('✅ Copie os IDs acima e cole no seu arquivo .env');
}

setup().catch(err => {
  console.error('Erro:', err.message);
});
