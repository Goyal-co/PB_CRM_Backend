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

function titleizeKey(k: string): string {
  return k
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function buildAgreementFormDetailsHtml(input: {
  snapshot: unknown;
  includeEmpty?: boolean;
  excludeKeys?: string[];
}): string {
  const { snapshot, includeEmpty = false } = input;
  const exclude = new Set((input.excludeKeys ?? []).map((x) => x.toLowerCase()));

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return '';
  }

  const entries = Object.entries(snapshot as Record<string, unknown>)
    .filter(([k]) => !exclude.has(k.toLowerCase()))
    .map(([k, v]) => [k, stringifyPrimitive(v)] as const)
    .filter(([, v]) => includeEmpty || Boolean(v.trim()));

  if (entries.length === 0) {
    return '';
  }

  entries.sort(([a], [b]) => a.localeCompare(b));

  const trs = entries
    .map(([k, v]) => {
      const label = titleizeKey(k);
      return `<tr>
  <td style="padding:4px 8px;color:#555;vertical-align:top;white-space:nowrap;">${escapeHtml(
    label,
  )}</td>
  <td style="padding:4px 8px;font-weight:600;">${escapeHtml(v)}</td>
</tr>`;
    })
    .join('');

  return `<div style="font-family:Arial, sans-serif;margin:0 0 12px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;">
  <div style="font-size:12px;font-weight:700;margin:0 0 6px 0;">Form details</div>
  <table style="border-collapse:collapse;font-size:11px;width:100%;">${trs}</table>
</div>`;
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

function fillUnderscoreBlank(
  html: string,
  pattern: RegExp,
  value: string,
): string {
  if (!value?.trim()) {
    return html;
  }
  return html.replace(pattern, (_m, prefix: string, suffix: string) => {
    return `${prefix}${escapeHtml(value.trim())}${suffix}`;
  });
}

/**
 * Heuristic filler for PDF→HTML templates that contain underscore blanks instead of placeholders.
 * This cannot be perfect, but it fixes the most common blanks (name, Aadhaar, PAN, address, etc.).
 */
export function fillCommonAgreementBlanksFromParams(
  mergedHtml: string,
  params: Record<string, string>,
): string {
  let out = mergedHtml;

  const name = pick(params, ['allottee_full_name', 'customer_name', 'name']);
  const aadhar = pick(params, ['aadhar_no', 'aadhaar_no', 'allottee_aadhar']);
  const pan = pick(params, ['pan', 'pan_no', 'allottee_pan']);
  const father = pick(params, ['father_name', 'allottee_father_name']);
  const address = pick(params, ['address', 'residential_address', 'allottee_address']);

  const appNo = pick(params, ['application_no', 'application_number']);
  const appDate = pick(params, ['application_date', 'application_dt']);
  const aptNo = pick(params, ['apartment_no', 'unit_no', 'unit_number', 'flat_no']);
  const carpet = pick(params, ['carpet_area', 'carpet_area_sqft']);
  const sba = pick(params, ['super_built_up_area', 'super_builtup_area', 'sba_sqft']);
  const floor = pick(params, ['floor', 'floor_no']);
  const tower = pick(params, ['tower', 'tower_no', 'tower_name']);
  const aptType = pick(params, ['apartment_type', 'unit_type', 'bhk_type']);
  const carParks = pick(params, ['car_parking', 'car_parking_nos', 'car_parking_count']);

  const totalPrice = pick(params, ['total_price', 'agreement_total_price', 'gross_amount']);
  const reraReg = pick(params, ['rera_registration_no', 'rera_no', 'project_rera']);
  const website = pick(params, ['project_website', 'website']);

  // MR/MS line + identifiers
  out = fillUnderscoreBlank(
    out,
    /(MR\.?\s*\/\s*MS\.?\s*)(_{4,})(,?)/gi,
    name,
  );
  out = fillUnderscoreBlank(
    out,
    /(\(\s*Aadhar\s*no\.?\s*)(_{4,})(\s*\))/gi,
    aadhar,
  );
  out = fillUnderscoreBlank(
    out,
    /(\(\s*PAN\s*)(_{4,})(\s*\))/gi,
    pan,
  );
  out = fillUnderscoreBlank(
    out,
    /(son\/daughter\s*of\s*)(_{4,})(,?)/gi,
    father,
  );
  out = fillUnderscoreBlank(
    out,
    /(residing\s*at\s*)(_{4,})(,?)/gi,
    address,
  );

  // RERA + website lines
  out = fillUnderscoreBlank(
    out,
    /(Registration\s*No\.?\s*)(_{4,})(\s*)/gi,
    reraReg,
  );
  out = fillUnderscoreBlank(
    out,
    /(website\s*for\s*the\s*Project\s*is\s*)(_{4,})(;?)/gi,
    website,
  );

  // Application/allotment sentence (Recital M)
  out = fillUnderscoreBlank(
    out,
    /(application\s*no\.?\s*)(_{3,})(\s*dated)/gi,
    appNo,
  );
  out = fillUnderscoreBlank(
    out,
    /(dated\s*)(_{3,})(\s*and\s*has\s*been\s*allotted)/gi,
    appDate,
  );
  out = fillUnderscoreBlank(
    out,
    /(apartment\s*no\.?\s*)(_{3,})(\s*having)/gi,
    aptNo,
  );
  out = fillUnderscoreBlank(
    out,
    /(carpet\s*area\s*of\s*)(_{3,})(\s*square\s*feet)/gi,
    carpet,
  );
  out = fillUnderscoreBlank(
    out,
    /(\s*and\s*)(_{3,})(\s*square\s*feet\s*of\s*super\s*built\s*up\s*area)/gi,
    sba,
  );
  out = fillUnderscoreBlank(
    out,
    /(being\s*)(_{3,})(\s*type\s*of\s*the\s*apartment)/gi,
    aptType,
  );
  out = fillUnderscoreBlank(
    out,
    /(located\s*on\s*)(_{3,})(\s*floor)/gi,
    floor,
  );
  out = fillUnderscoreBlank(
    out,
    /(in\s*Tower\s*no\.?\s*)(_{1,})(\s*of\s*the\s*Project)/gi,
    tower,
  );
  out = fillUnderscoreBlank(
    out,
    /(along\s*with\s*)(_{1,})(\s*\(nos\)\s*of\s*car\s*parking)/gi,
    carParks,
  );

  // Total price section
  out = fillUnderscoreBlank(
    out,
    /(TotalPrice\s*fortheSchedulePropertyis\s*Rs\.?\s*)(_{3,})(\s*\/\-)/gi,
    totalPrice,
  );

  return out;
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
