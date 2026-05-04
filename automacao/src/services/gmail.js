require("dotenv").config();
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const OAuth2 = google.auth.OAuth2;

async function getAccessToken() {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const { token } = await oauth2Client.getAccessToken();
  return token;
}

async function createTransporter() {
  const accessToken = await getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_FROM,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken,
    },
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function sendEmail(options) {
  const cleanTo = String(options.to).replace(/[\r\n\t\s"']/g, "").trim();
  console.log("Destinatario: " + cleanTo);

  const mailOptions = {
    from: "Atendimento Destrave <" + process.env.GMAIL_FROM + ">",
    to: cleanTo,
    bcc: process.env.GMAIL_BCC,
    subject: options.subject,
    text: options.body,
    attachments: (options.attachments || []).map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  };

  const maxTentativas = 3;
  let tentativa = 1;

  while (tentativa <= maxTentativas) {
    try {
      const transporter = await createTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log("Email enviado para " + cleanTo);
      return result;
    } catch (err) {
      console.log("Tentativa " + tentativa + " falhou: " + err.message);
      if (tentativa === maxTentativas) throw err;
      await sleep(5000);
      tentativa++;
    }
  }
}

module.exports = { sendEmail };
