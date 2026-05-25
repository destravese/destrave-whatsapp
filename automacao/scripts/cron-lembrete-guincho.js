require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const LIST_ACIONAMENTOS = process.env.TRELLO_LIST_ACIONAMENTOS;
const DIAS_LEMBRETE = 3;

function createTransporter() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

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

function sanitizarEmail(email) {
  if (!email) return null;

  // 1. Converte para string limpa — remove todos os caracteres fora do ASCII imprimível
  let limpo = email
    .normalize('NFD')             // decompõe caracteres compostos
    .replace(/[^\x20-\x7E]/g, '') // mantém só ASCII 32-126
    .replace(/\s/g, '')           // remove espaços, tabs, quebras de linha
    .replace(/['"<>]/g, '')       // remove aspas e marcadores HTML
    .toLowerCase()
    .trim();

  // 2. Valida o formato final antes de retornar
  const valido = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(limpo);
  if (!valido) {
    console.log('Email inválido após sanitização:', JSON.stringify(limpo));
    return null;
  }

  return limpo;
}

function extrairEmail(descricao) {
  if (!descricao) return null;

  // Normaliza quebras de linha para garantir consistência
  const linhas = descricao.replace(/\r\n/g, '\n').split('\n');
  const primeiraLinha = linhas[0];

  // Tenta capturar formato markdown do Trello: [email](mailto:email)
  const markdown = primeiraLinha.match(/\(mailto:([^)\s"']+)\)/i);
  if (markdown) return sanitizarEmail(markdown[1]);

  // Tenta capturar email simples após "Email:" ou "email:"
  const comLabel = primeiraLinha.match(/e-?mail\s*:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (comLabel) return sanitizarEmail(comLabel[1]);

  // Fallback: qualquer email na linha
  const simples = primeiraLinha.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (simples) return sanitizarEmail(simples[1]);

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
  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
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

  const corpo =
    'Olá, ' + clientName + '! Tudo certo?\n\n' +
    'Passando para te deixar um aviso importante sobre o seu plano.\n\n' +
    'Conforme os nossos Termos de Uso (https://destrave.se/termos-de-uso/), o serviço de guincho possui um intervalo mínimo de 30 dias entre utilizações. ' +
    'Como você utilizou o guincho no dia ' + dataFormatada + ', o próximo acionamento pelo plano estará disponível a partir de ' + dataLiberacaoFormatada + '.\n\n' +
    'Caso precise de apoio antes dessa data, não se preocupe — temos o serviço avulso disponível. ' +
    'É só entrar em contato pelo WhatsApp (11) 94586-6543 e a gente faz um orçamento na hora.\n\n' +
    'Qualquer dúvida, estamos por aqui\n\n' +
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

  console.log('Lembrete enviado para: ' + email);
}

async function run() {
  console.log('Iniciando cron de lembrete guincho - ' + new Date().toISOString());

  const cards = await getCards();
  console.log('Total de cards na lista: ' + cards.length);

  let enviados = 0;
  let ignorados = 0;

  for (const card of cards) {
    if (!isGuincho(card.desc)) continue;

    const dataCard = extrairData(card.name);
    if (!dataCard) {
      console.log('Data nao encontrada no card: ' + card.name);
      continue;
    }

    const dias = diffDias(dataCard);
    if (dias !== DIAS_LEMBRETE) continue;

    const emailRaw = extrairEmail(card.desc);

    // Log diagnóstico: mostra o email bruto para detectar caracteres invisíveis
    console.log('Email bruto (JSON):', JSON.stringify(emailRaw));

    if (!emailRaw) {
      console.log('Email invalido ou nao encontrado no card: ' + card.name);
      ignorados++;
      continue;
    }

    const clientName = extrairNome(card.name);

    console.log('Enviando lembrete para ' + clientName + ' (' + emailRaw + ') - atendimento em ' + dataCard.toLocaleDateString('pt-BR'));

    try {
      await enviarLembrete(emailRaw, clientName, dataCard);
      enviados++;
    } catch (err) {
      console.error('Erro ao enviar para ' + emailRaw + ': ' + err.message);
      ignorados++;
    }
  }

  console.log('Concluido. Enviados: ' + enviados + ' | Ignorados/Erro: ' + ignorados);
}

run().catch(function(err) {
  console.error('Erro no cron:', err.message);
  process.exit(1);
});
