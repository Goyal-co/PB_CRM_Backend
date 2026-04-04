import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEMPLATE_ID = '5b997db1-0416-4465-bb4e-bee734b6e3f5';
const HTML_PATH = path.resolve(process.cwd(), 'tmp_propforma_ats_orchid_life.html');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error('SUPABASE_URL is missing');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');

  const html = await readFile(HTML_PATH, 'utf-8');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from('agreement_templates')
    .update({ body_html: html, updated_at: new Date().toISOString() })
    .eq('id', TEMPLATE_ID);

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }

  console.log('Updated template:', TEMPLATE_ID);
  console.log('HTML chars:', html.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

