// Admin notification emails for new contact messages and job applications.
// Sent in the background after the submission is saved, so a slow or failing mail server
// never affects the visitor. Recipients and on/off switches live in Admin → Site settings.
import { sendMail, mailConfigured } from './mailer.js';
import { getSettings } from './db.js';
import { esc } from './render.js';

// Last delivery result, shown in the admin settings page
export const mailStatus = { lastSuccessAt: null, lastErrorAt: null, lastError: null };

export const recipients = (s = getSettings()) =>
  String(s.notify_email || s.email || '').split(',').map((e) => e.trim()).filter(Boolean);

const row = (label, value) => (value ? `<tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;color:#0f172a">${value}</td></tr>` : '');

function layout(title, intro, rows, bodyTitle, body, button) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#050816;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px">NTALEC <span style="color:#22d3ee;font-weight:600">· ${esc(title)}</span></td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 18px;color:#334155;font-size:15px">${intro}</p>
      <table role="presentation" style="font-size:14px;border-collapse:collapse">${rows}</table>
      ${body ? `<p style="margin:22px 0 8px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px">${esc(bodyTitle)}</p>
      <div style="padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(body)}</div>` : ''}
      ${button ? `<p style="margin:26px 0 0"><a href="${esc(button.href)}" style="display:inline-block;padding:11px 20px;background:#22d3ee;color:#050816;text-decoration:none;font-weight:700;border-radius:8px;font-size:14px">${esc(button.label)}</a></p>` : ''}
    </td></tr>
  </table>
  <p style="max-width:600px;margin:14px auto 0;color:#94a3b8;font-size:12px;text-align:center">Sent by your website. Change notification settings in Admin → Site settings.</p>
</body></html>`;
}

function deliver(settingKey, mail) {
  const s = getSettings();
  if (s[settingKey] !== '1' || !mailConfigured()) return;
  const to = recipients(s);
  if (!to.length) return;
  sendMail({ ...mail, to })
    .then(() => { mailStatus.lastSuccessAt = new Date().toISOString(); })
    .catch((err) => {
      mailStatus.lastErrorAt = new Date().toISOString();
      mailStatus.lastError = err.message;
      console.error(`Notification email failed: ${err.message}`);
    });
}

export function notifyNewMessage(m, siteUrl) {
  deliver('notify_messages', {
    subject: `New website message: ${m.subject}`,
    replyTo: { name: m.name, address: m.email },
    text: `New message from the NTALEC website contact form.\n\nFrom: ${m.name} <${m.email}>\nSubject: ${m.subject}\n\n${m.message}\n\nReply to this email to answer ${m.name} directly, or open the inbox: ${siteUrl}/admin/#/messages`,
    html: layout('New message',
      `You have a new message from the website contact form. <strong>Reply to this email</strong> to answer ${esc(m.name)} directly.`,
      row('From', esc(m.name)) + row('Email', `<a href="mailto:${esc(m.email)}" style="color:#0891b2">${esc(m.email)}</a>`) + row('Subject', esc(m.subject)),
      'Message', m.message,
      { href: `${siteUrl}/admin/#/messages`, label: 'Open inbox' })
  });
}

export function notifyNewApplication(a, siteUrl) {
  deliver('notify_applications', {
    subject: `New application: ${a.job_title} — ${a.name}`,
    replyTo: { name: a.name, address: a.email },
    text: `New job application received.\n\nPosition: ${a.job_title}\nName: ${a.name}\nEmail: ${a.email}\n${a.phone ? `Phone: ${a.phone}\n` : ''}${a.linkedin ? `LinkedIn / portfolio: ${a.linkedin}\n` : ''}\n${a.cover_letter ? `Cover letter:\n${a.cover_letter}\n\n` : ''}The CV is available in the admin portal: ${siteUrl}/admin/#/applications`,
    html: layout('New application',
      `A new application has arrived for <strong>${esc(a.job_title)}</strong>. Download the CV from the admin portal.`,
      row('Position', esc(a.job_title)) + row('Name', esc(a.name)) +
        row('Email', `<a href="mailto:${esc(a.email)}" style="color:#0891b2">${esc(a.email)}</a>`) + row('Phone', esc(a.phone)) +
        row('LinkedIn / portfolio', /^https?:\/\//i.test(a.linkedin) ? `<a href="${esc(a.linkedin)}" style="color:#0891b2">${esc(a.linkedin)}</a>` : esc(a.linkedin)),
      'Cover letter', a.cover_letter,
      { href: `${siteUrl}/admin/#/applications`, label: 'Review application' })
  });
}

export async function sendTestEmail(to, siteUrl) {
  await sendMail({
    to,
    subject: 'NTALEC website: test notification',
    text: `This is a test email from your NTALEC website. Notifications are working.\n\n${siteUrl}/admin/`,
    html: layout('Test email', 'This is a test email from your website — <strong>notifications are working.</strong>', '', '', '', { href: `${siteUrl}/admin/`, label: 'Open admin portal' })
  });
  mailStatus.lastSuccessAt = new Date().toISOString();
}
