require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const LIST_ACIONAMENTOS = process.env.TRELLO_LIST_ACIONAMENTOS;
const DIAS_LEMBRETE = 3;

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_FROM,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
}

function extrairEmail(descricao) {
  if (!descricao) return null;
  const primeiraLinha = descricao.split('\n')[0];
  const markdown = primeiraLinha.match(/\(mailto:([^)]+)\)/i);
  if (markdown) return markdown[1].trim();
  const simples = primeiraLinha.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (simples) return simples[1].trim();
  return null;
}

function extrairNome(cardName) {
  const parts = cardName.split(' - ');
  if (parts.length >= 2) return parts.slice(1).join(' - ').trim();
  return cardName.trim();
}

function extrairData(cardName) {
  const match = cardName.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(match[3], match[2] - 1, match[1]);
}

function isGuincho(descricao) {
  if (!descricao) return false;
  return /servi[cç]o:\s*guincho/i.test(descricao);
}

function diffDias(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);
  const diff = hoje - data;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

async function getCards() {
  const res = await axios.get(
    'https://api.trello.com/1/lists/' + LIST_ACIONAMENTOS + '/cards',
    { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
  );
  return res.data;
}

async function enviarLembrete(email, clientName, dataAtendimento) {
  const transporter = createTransporter();

  const dataFormatada = dataAtendimento.toLocaleDateString('pt-BR');
  const dataLiberacao = new Date(dataAtendimento);
  dataLiberacao.setDate(dataLiberacao.getDate() + 30);
  const dataLiberacaoFormatada = dataLiberacao.toLocaleDateString('pt-BR');

  const assunto = 'Informativo sobre seu serviço de guincho';

  const corpo = 'Olá, ' + clientName + '! Tudo certo?\n\n' +
    'Passando para te deixar um aviso importante sobre o seu plano.\n\n' +
    'Conforme os nossos Termos de Uso (' + 'https://destrave.se/termos-de-uso/' + '), o serviço de guincho possui um intervalo mínimo de 30 dias entre utilizações. ' +
    'Como você utilizou o guincho no dia ' + dataFormatada + ', o próximo acionamento pelo plano estará disponível a partir de ' + dataLiberacaoFormatada + '.\n\n' +
    'Caso precise de apoio antes dessa data, não se preocupe — temos o serviço avulso disponível. ' +
    'É só entrar em contato pelo WhatsApp (11) 94586-6543 e a gente faz um orçamento na hora.\n\n' +
    'Qualquer dúvida, estamos por aqui 💚\n\n' +
    'Atenciosamente,\n' +
    '--\n' +
    'Equipe Destrave\n' +
    'Setor de Atendimento\n' +
    'Cel.: (11) 94586-6543\n' +
    'destrave.se';

  await transporter.sendMail({
    from: 'Atendimento Destrave <' + process.env.GMAIL_FROM + '>',
    to: email,
    bcc: process.env.GMAIL_BCC,
    subject: assunto,
    text: corpo,
  });

  console.log('Lembrete enviado para ' + email);
}

async function run() {
  console.log('Iniciando cron de lembrete guincho - ' + new Date().toISOString());

  const cards = await getCards();
  console.log('Total de cards na lista: ' + cards.length);

  let enviados = 0;

  for (const card of cards) {
    if (!isGuincho(card.desc)) continue;

    const dataCard = extrairData(card.name);
    if (!dataCard) continue;

    const dias = diffDias(dataCard);
    if (dias !== DIAS_LEMBRETE) continue;

    const email = extrairEmail(card.desc);
    if (!email) {
      console.log('Email nao encontrado no card: ' + card.name);
      continue;
    }

    const clientName = extrairNome(card.name);

    console.log('Enviando lembrete para ' + clientName + ' (' + email + ') - atendimento em ' + dataCard.toLocaleDateString('pt-BR'));

    await enviarLembrete(email, clientName, dataCard);
    enviados++;
  }

  console.log('Concluido. Lembretes enviados: ' + enviados);
}

run().catch(function(err) {
  console.error('Erro no cron:', err.message);
  process.exit(1);
});
