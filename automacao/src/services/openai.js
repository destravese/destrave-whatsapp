// src/services/openai.js
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmail(prompt) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0].message.content.trim();

  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.assunto || !parsed.corpo) {
      throw new Error('Resposta da IA não contém assunto ou corpo');
    }
    return parsed;
  } catch (err) {
    console.error('Erro ao parsear resposta da IA:', content);
    throw new Error('A IA não retornou um JSON válido');
  }
}

module.exports = { generateEmail };
