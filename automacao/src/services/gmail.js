require("dotenv").config();
const { google } = require("googleapis");

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return oauth2Client;
}

function cleanEmailAddress(raw) {
  return String(raw)
    .replace(/\(mailto:[^)]+\)/gi, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[\r\n\t"']/g, "")
    .trim();
}

function buildRawEmail(options) {
  const cleanTo = cleanEmailAddress(options.to);
  const boundary = "destrave_boundary_" + Date.now();
  const hasAttachments = options.attachments && options.attachments.length > 0;

  const headers = [
    "From: Atendimento Destrave <" + process.env.GMAIL_FROM + ">",
    "To: " + cleanTo,
    "Bcc: " + (process.env.GMAIL_BCC || ""),
    "Subject: " + options.subject,
    "MIME-Version: 1.0",
    hasAttachments
      ? "Content-Type: multipart/mixed; boundary=\"" + boundary + "\""
      : "Content-Type: text/plain; charset=utf-8",
  ].join("\r\n");

  let body = headers + "\r\n\r\n";

  if (hasAttachments) {
    body += "--" + boundary + "\r\n";
    body += "Content-Type: text/plain; charset=utf-8\r\n\r\n";
    body += options.body + "\r\n\r\n";

    for (const att of options.attachments) {
      const base64Content = Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : Buffer.from(att.content).toString("base64");

      body += "--" + boundary + "\r\n";
      body += "Content-Type: " + (att.contentType || "application/octet-stream") + "\r\n";
      body += "Content-Transfer-Encoding: base64\r\n";
      body += "Content-Disposition: attachment; filename=\"" + att.filename + "\"\r\n\r\n";
      body += base64Content + "\r\n\r\n";
    }

    body += "--" + boundary + "--";
  } else {
    body += options.body;
  }

  return Buffer.from(body).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEmail(options) {
  const cleanTo = cleanEmailAddress(options.to);
  console.log("Destinatario: " + cleanTo);

  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildRawEmail(options);

  const maxTentativas = 3;
  let tentativa = 1;

  while (tentativa <= maxTentativas) {
    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      console.log("Email enviado para " + cleanTo);
      return { success: true };
    } catch (err) {
      console.log("Tentativa " + tentativa + " falhou: " + err.message);
      if (tentativa === maxTentativas) throw err;
      await sleep(5000);
      tentativa++;
    }
  }
}

module.exports = { sendEmail };
