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
