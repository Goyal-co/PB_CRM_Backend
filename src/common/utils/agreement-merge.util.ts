/**
 * Agreement templates use `{{param_name}}` placeholders. Merge is done in the API so it does not
 * depend on Postgres RPC behaviour for substitution.
 */

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function stringifyPrimitive(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'string') {
    return v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '';
    }
  }
  return String(v);
}

/**
 * Flattens booking context into merge params. Later steps override earlier ones where keys clash.
 * Order: project → unit → field_snapshot → booking scalars (booking wins on overlaps like allottee_phone).
 */
export function buildAgreementParamMap(input: {
  booking: Record<string, unknown>;
  unit: Record<string, unknown> | null;
  project: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
}): Record<string, string> {
  const params: Record<string, string> = {};
  const assignRow = (row: Record<string, unknown> | null | undefined) => {
    if (!row) {
      return;
    }
    for (const [k, v] of Object.entries(row)) {
      params[k] = stringifyPrimitive(v);
    }
  };

  assignRow(input.project);
  assignRow(input.unit);

  const snap = input.booking.field_snapshot;
  if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
    for (const [k, v] of Object.entries(snap as Record<string, unknown>)) {
      params[k] = stringifyPrimitive(v);
    }
  }

  for (const [k, v] of Object.entries(input.booking)) {
    if (k === 'field_snapshot') {
      continue;
    }
    params[k] = stringifyPrimitive(v);
  }

  const p = input.profile;
  if (p) {
    const first = p.first_name != null ? String(p.first_name) : '';
    const last = p.last_name != null ? String(p.last_name) : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (!params.allottee_full_name?.trim() && full) {
      params.allottee_full_name = full;
    }
  }

  if (!params.apartment_no?.trim() && params.unit_no?.trim()) {
    params.apartment_no = params.unit_no;
  }
  if (!params.unit_number?.trim() && params.unit_no?.trim()) {
    params.unit_number = params.unit_no;
  }

  return params;
}

export function mergeAgreementPlaceholders(
  html: string,
  params: Record<string, string>,
): string {
  return html.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const v = params[key];
    return v !== undefined && v !== null ? String(v) : '';
  });
}

export function wrapAgreementHtmlDocument(parts: {
  header_html?: string | null;
  body_html: string;
  footer_html?: string | null;
}): string {
  const h = parts.header_html ?? '';
  const b = parts.body_html ?? '';
  const f = parts.footer_html ?? '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Agreement</title>
</head>
<body>
${h}
${b}
${f}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pick(params: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = params[k];
    if (v && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

/**
 * Some templates in the wild are PDF-to-HTML dumps (absolute-position spans) with no placeholders,
 * and \"blank\" areas cannot be reliably filled. This header guarantees key booking details appear.
 */
export function buildAgreementDetailsHeaderHtml(params: Record<string, string>): string {
  const rows: Array<{ label: string; value: string }> = [];

  const name = pick(params, ['allottee_full_name', 'customer_name', 'name']);
  const phone = pick(params, ['allottee_phone', 'phone', 'mobile', 'mobile_no']);
  const email = pick(params, ['allottee_email', 'email']);
  const project = pick(params, ['project_name', 'name_project', 'project']);
  const unit = pick(params, ['unit_no', 'unit_number', 'apartment_no', 'flat_no']);
  const booking = pick(params, ['booking_id', 'id']);

  if (name) rows.push({ label: 'Customer', value: name });
  if (phone) rows.push({ label: 'Phone', value: phone });
  if (email) rows.push({ label: 'Email', value: email });
  if (project) rows.push({ label: 'Project', value: project });
  if (unit) rows.push({ label: 'Unit', value: unit });
  if (booking) rows.push({ label: 'Booking ID', value: booking });

  if (rows.length === 0) {
    return '';
  }

  const trs = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 8px;color:#555;white-space:nowrap;">${escapeHtml(
          r.label,
        )}</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(
          r.value,
        )}</td></tr>`,
    )
    .join('');

  return `<div style="font-family:Arial, sans-serif;margin:0 0 12px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;">
  <div style="font-size:12px;font-weight:700;margin:0 0 6px 0;">Agreement details</div>
  <table style="border-collapse:collapse;font-size:11px;width:100%;">${trs}</table>
</div>`;
}

export function shouldInjectAgreementDetailsHeader(
  mergedBodyHtml: string,
  params: Record<string, string>,
): boolean {
  const name = pick(params, ['allottee_full_name', 'customer_name', 'name']);
  const unit = pick(params, ['unit_no', 'unit_number', 'apartment_no', 'flat_no']);
  // If the merged body doesn't contain key identifiers, add header.
  if (name && !mergedBodyHtml.includes(name)) return true;
  if (unit && !mergedBodyHtml.includes(unit)) return true;
  return false;
}

/**
 * Lightweight HTML compaction to reduce transfer size and speed up rendering.
 * Intentionally conservative: removes comments and collapses obvious whitespace.
 */
export function compactAgreementHtml(html: string): string {
  if (!html) return html;
  let out = html;
  // Remove HTML comments (common in WYSIWYG templates).
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  // Normalize newlines and collapse large runs of whitespace between tags.
  out = out.replace(/\r\n/g, '\n');
  out = out.replace(/>\s+</g, '><');
  // Collapse very long whitespace runs (but keep single spaces inside text nodes).
  out = out.replace(/[ \t]{2,}/g, ' ');
  // Collapse huge runs of <br> used for spacing.
  out = out.replace(/(?:<br\s*\/?>\s*){4,}/gi, '<br/><br/>');
  return out.trim();
}
