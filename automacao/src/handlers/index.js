var trelloService = require("../services/trello");
var openaiService = require("../services/openai");
var gmailService = require("../services/gmail");
var prompts = require("../prompts/destrave");

async function handleAcionamento(card) {
  console.log("Processando acionamento: " + card.name);
  var clientName = trelloService.extractClientName(card.name);
  var date = trelloService.extractDate(card.name);
  var fields = trelloService.parseDescription(card.desc);
  var email = fields.email;
  if (!email) {
    console.log("Email nao encontrado no card: " + card.name);
    return { success: false, reason: "email_not_found" };
  }
  var separated = trelloService.separateAttachments(card.attachments || []);
  var photos = separated.photos;
  var attachments = [];
  for (var i = 0; i < photos.length; i++) {
    try {
      var downloaded = await trelloService.downloadAttachment(card.id, photos[i]);
      attachments.push(downloaded);
    } catch (err) {
      console.log("Erro ao baixar anexo: " + err.message);
    }
  }
  var prompt = prompts.promptAcionamento({
    clientName: clientName,
    date: date,
    servico: fields.servico,
    cidade: fields.cidade,
    estado: fields.estado,
    problema: fields.problema,
    km: fields.km,
    observacoes: fields.observacoes,
  });
  var generated = await openaiService.generateEmail(prompt);
  await gmailService.sendEmail({
    to: email,
    subject: generated.assunto,
    body: generated.corpo,
    attachments: attachments,
  });
  console.log("Email de acionamento enviado para " + email);
  return { success: true, type: "acionamento", to: email };
}

async function handleNegativa(card) {
  console.log("Processando negativa: " + card.name);
  var clientName = trelloService.extractClientName(card.name);
  var date = trelloService.extractDate(card.name);
  var fields = trelloService.parseDescription(card.desc);
  var email = fields.email;
  if (!email) {
    console.log("Email nao encontrado no card: " + card.name);
    return { success: false, reason: "email_not_found" };
  }
  var prompt = prompts.promptNegativa({ clientName: clientName, date: date, contexto: card.desc || "" });
  var generated = await openaiService.generateEmail(prompt);
  await gmailService.sendEmail({ to: email, subject: generated.assunto, body: generated.corpo });
  console.log("Email de negativa enviado para " + email);
  return { success: true, type: "negativa", to: email };
}

async function handleCancelamento(card) {
  console.log("Processando cancelamento: " + card.name);
  var clientName = trelloService.extractClientName(card.name);
  var date = trelloService.extractDate(card.name);
  var fields = trelloService.parseDescription(card.desc);
  var email = fields.email;
  if (!email) {
    console.log("Email nao encontrado no card: " + card.name);
    return { success: false, reason: "email_not_found" };
  }
  var prompt = prompts.promptCancelamento({ clientName: clientName, date: date, contexto: card.desc || "" });
  var generated = await openaiService.generateEmail(prompt);
  await gmailService.sendEmail({ to: email, subject: generated.assunto, body: generated.corpo });
  console.log("Email de cancelamento enviado para " + email);
  return { success: true, type: "cancelamento", to: email };
}

module.exports = {
  handleAcionamento: handleAcionamento,
  handleNegativa: handleNegativa,
  handleCancelamento: handleCancelamento,
};
