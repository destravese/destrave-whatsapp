require("dotenv").config();
var nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_FROM,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

async function sendEmail(options) {
  var to = options.to;
  var subject = options.subject;
  var body = options.body;
  var attachments = options.attachments || [];
  var cleanTo = String(to).replace(/[\r\n\t\s"']/g, "").trim();
  console.log("Destinatario: " + cleanTo);
  var mailOptions = {
    from: "Atendimento Destrave <" + process.env.GMAIL_FROM + ">",
    to: cleanTo,
    bcc: process.env.GMAIL_BCC,
    subject: subject,
    text: body,
    attachments: attachments.map(function(att) {
      return {
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      };
    }),
  };
  var maxTentativas = 3;
  var tentativa = 1;
  while (tentativa <= maxTentativas) {
    try {
      var transporter = createTransporter();
      var result = await transporter.sendMail(mailOptions);
      console.log("Email enviado para " + cleanTo);
      return result;
    } catch (err) {
      console.log("Tentativa " + tentativa + " falhou: " + err.message);
      if (tentativa === maxTentativas) {
        throw err;
      }
      await sleep(5000);
      tentativa++;
    }
  }
}

module.exports = { sendEmail: sendEmail };
