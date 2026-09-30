// Create an admin user:  npm run create-admin
// Prompts for email, name and password (password input is hidden).
import readline from 'node:readline';
import { createUser, PASSWORD_MIN } from './auth.js';
import { EMAIL_RE } from './schema.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (s) => { if (!muted || s.includes('\n')) rl.output.write(muted ? '\n' : s); };
const ask = (q, hidden = false) => new Promise((resolve) => {
  rl.question(q, (a) => { muted = false; resolve(a.trim()); });
  muted = hidden;
});

try {
  const email = await ask('Admin email: ');
  if (!EMAIL_RE.test(email)) throw new Error('That is not a valid email address.');
  const name = await ask('Name: ');
  const password = await ask(`Password (min ${PASSWORD_MIN} characters): `, true);
  const confirm = await ask('Confirm password: ', true);
  if (password !== confirm) throw new Error('Passwords do not match.');
  createUser(email, name, password);
  console.log(`\nAdmin ${email} created. Sign in at /admin/`);
} catch (err) {
  console.error(`\n${/UNIQUE/.test(err.message) ? 'A user with that email already exists.' : err.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
