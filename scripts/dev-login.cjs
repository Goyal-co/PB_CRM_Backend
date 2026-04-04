'use strict';

/**
 * Logs in against local API using credentials from .env so manual testing matches your Supabase users.
 *
 * Env (first match wins):
 *   DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD
 *   TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD
 *   TEST_SUPER_ADMIN_EMAIL / TEST_SUPER_ADMIN_PASSWORD
 * Defaults: manager1@gmail.com / manager1234 (only work if those users exist in Supabase Auth)
 *
 * Usage: npm run dev:login
 *        $env:DEV_LOGIN_EMAIL="you@x.com"; $env:DEV_LOGIN_PASSWORD="..."; npm run dev:login
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const base = (
  process.env.TEST_BASE_URL ||
  process.env.DEV_API_BASE ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

function pickCreds() {
  if (process.env.DEV_LOGIN_EMAIL?.trim()) {
    return {
      email: process.env.DEV_LOGIN_EMAIL.trim(),
      password: process.env.DEV_LOGIN_PASSWORD ?? '',
    };
  }
  if (process.env.TEST_MANAGER_EMAIL?.trim()) {
    return {
      email: process.env.TEST_MANAGER_EMAIL.trim(),
      password: process.env.TEST_MANAGER_PASSWORD ?? '',
    };
  }
  if (process.env.TEST_SUPER_ADMIN_EMAIL?.trim()) {
    return {
      email: process.env.TEST_SUPER_ADMIN_EMAIL.trim(),
      password: process.env.TEST_SUPER_ADMIN_PASSWORD ?? '',
    };
  }
  return {
    email: 'manager1@gmail.com',
    password: 'manager1234',
  };
}

async function main() {
  const { email, password } = pickCreds();
  const url = `${base}/api/v1/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error('Login failed (%s):', res.status, JSON.stringify(body, null, 2));
    // eslint-disable-next-line no-console
    console.error(`
Fix: use emails/passwords that exist in YOUR Supabase project (Dashboard → Authentication → Users).

Add to .env (repo root):
  DEV_LOGIN_EMAIL=your-manager@company.com
  DEV_LOGIN_PASSWORD=your-real-password

Or set TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD to match users you created (or e2e bootstrap).

First-time API setup: POST /api/v1/auth/bootstrap-admin with BOOTSTRAP_ADMIN_SECRET (see .env.example).
`);
    process.exit(1);
  }

  const session = body.data;
  const token = session?.access_token;
  if (!token) {
    // eslint-disable-next-line no-console
    console.error('Unexpected response shape:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Using email:', email);
  // eslint-disable-next-line no-console
  console.log('access_token:\n', token);
  // eslint-disable-next-line no-console
  console.log('\nList approved bookings (pick id where status=approved):');
  // eslint-disable-next-line no-console
  console.log(
    `  curl -s -H "Authorization: Bearer ${token}" "${base}/api/v1/bookings?page=1&limit=20"`,
  );
  // eslint-disable-next-line no-console
  console.log('\nDownload PDF — bash/macOS/Linux (one line):');
  // eslint-disable-next-line no-console
  console.log(
    `  curl -s -H "Authorization: Bearer ${token}" "${base}/api/v1/bookings/BOOKING_ID/agreement-download" -o agreement.pdf`,
  );
  // eslint-disable-next-line no-console
  console.log('\nWindows PowerShell — use curl.exe (not backslash line breaks; <token> was a placeholder):');
  // eslint-disable-next-line no-console
  console.log(
    `  curl.exe -s -H "Authorization: Bearer ${token}" "${base}/api/v1/bookings/BOOKING_ID/agreement-download" -o agreement.pdf`,
  );
  // eslint-disable-next-line no-console
  console.log('  Or: .\\scripts\\curl-agreement-pdf.ps1 -Token "<paste token>" -BookingId "UUID"');
  // eslint-disable-next-line no-console
  console.log('\nPowerShell (use real password; BOOKING_ID = approved booking UUID):');
  // eslint-disable-next-line no-console
  console.log(
    `  .\\scripts\\download-agreement.ps1 -Email "${email}" -Password "YOUR_PASSWORD" -BookingId "BOOKING_ID"`,
  );
  // eslint-disable-next-line no-console
  console.log('HTML instead: ?format=html or .\\scripts\\download-agreement.ps1 ... -Format html');
  // eslint-disable-next-line no-console
  console.log(
    '\nAll-in-one (Windows): .\\scripts\\windows-agreement-download.ps1 -Email "..." -Password "..."',
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
