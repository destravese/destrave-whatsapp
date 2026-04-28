const { google } = require('googleapis');
const nodemailer = require('nodemailer');

function createTransporter() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

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

async function sendEmail({ to, subject, body, attachments = [] }) {
  const transporter = createTransporter();

  // Limpa o email removendo espaços, quebras de linha e caracteres invisíveis
  const cleanTo = String(to).trim().replace(/[\r\n\t]/g, '');
  
  console.log(`📧 Destinatário limpo: "${cleanTo}"`);

  const mailOptions = {
    from: `Atendimento Destrave <${process.env.GMAIL_FROM}>`,
    to: cleanTo,
    bcc: process.env.GMAIL_BCC,
    subject: subject,
    text: body,
    attachments: attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  };

  const result = await transporter.sendMail(mailOptions);
  console.log(`✉️  Email enviado para ${cleanTo} | MessageID: ${result.messageId}`);
  return result;
}

module.exports = { sendEmail };
