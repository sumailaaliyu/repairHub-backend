const config = require('../config');

async function sendPasswordResetEmail(to, link) {
  if (!config.resendApiKey) {
    if (config.isProd) {
      console.warn('RESEND_API_KEY is not set. Password reset email was not sent.');
    } else {
      console.log(`[email not configured] Password reset link for ${to}: ${link}`);
    }
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject: 'Reset your RepairHub password',
      html:
        '<p>Someone asked to reset the password for your RepairHub account.</p>' +
        `<p><a href="${link}">Choose a new password</a></p>` +
        '<p>This link works once and expires in one hour. If you did not ask for this, ignore this email.</p>',
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

module.exports = { sendPasswordResetEmail };
