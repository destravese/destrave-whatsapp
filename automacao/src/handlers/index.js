// src/handlers/index.js
const trelloService = require('../services/trello');
const { generateEmail } = require('../services/openai');
const { sendEmail } = require('../services/gmail');
const { promptAcionamento, promptNegativa, promptCancelamento } = require('../prompts/destrave');

async function handleAcionamento(card) {
  console.log(`🔧 Processando acionamento: ${card.name}`);

  const clientName = trelloService.extractClientName(card.name);
  const date = trelloService.extractDate(card.name);
  const fields = trelloService.parseDescription(card.desc);
  const email = fields.email;

  if (!email) {
    console.warn(`⚠️  Email não encontrado no card "${card.name}". Pulando.`);
    return { success: false, reason: 'email_not_found' };
  }

  const { photos } = trelloService.separateAttachments(card.attachments || []);

  const attachments = [];
  for (const photo of photos) {
    try {
      const downloaded = await trelloService.downloadAttachment(photo);
      attachments.push(downloaded);
    } catch (err) {
      console.warn(`⚠️  Não foi possível baixar o anexo "${photo.name}": ${err.message}`);
    }
  }

  const prompt = promptAcionamento({
    clientName,
    date,
    servico: fields.servico,
    cidade: fields.cidade,
    problema: fields.problema,
    km: fields.km,
    observacoes: fields.observacoes,
  });

  const { assunto, corpo } = await generateEmail(prompt);

  await sendEmail({
    to: email,
    subject: assunto,
    body: corpo,
    attachments,
  });

  console.log(`✅ Email de acionamento enviado para ${email}`);
  return { success: true, type: 'acionamento', to: email };
}

async function handleNegativa(card) {
  console.log(`🚫 Processando negativa: ${card.name}`);

  const clientName = trelloService.extractClientName(card.name);
  const date = trelloService.extractDate(card.name);
  const email = trelloService.extractEmail(card.desc);
  const contexto = card.desc || '';

  if (!email) {
    console.warn(`⚠️  Email não encontrado no card "${card.name}". Pulando.`);
    return { success: false, reason: 'email_not_found' };
  }

  const prompt = promptNegativa({ clientName, date, contexto });
  const { assunto, corpo } = await generateEmail(prompt);

  await sendEmail({ to: email, subject: assunto, body: corpo });

  console.log(`✅ Email de negativa enviado para ${email}`);
  return { success: true, type: 'negativa', to: email };
}

async function handleCancelamento(card) {
  console.log(`❌ Processando cancelamento: ${card.name}`);

  const clientName = trelloService.extractClientName(card.name);
  const date = trelloService.extractDate(card.name);
  const email = trelloService.extractEmail(card.desc);
  const contexto = card.desc || '';

  if (!email) {
    console.warn(`⚠️  Email não encontrado no card "${card.name}". Pulando.`);
    return { success: false, reason: 'email_not_found' };
  }

  const prompt = promptCancelamento({ clientName, date, contexto });
  const { assunto, corpo } = await generateEmail(prompt);

  await sendEmail({ to: email, subject: assunto, body: corpo });

  console.log(`✅ Email de cancelamento enviado para ${email}`);
  return { success: true, type: 'cancelamento', to: email };
}

module.exports = { handleAcionamento, handleNegativa, handleCancelamento };
