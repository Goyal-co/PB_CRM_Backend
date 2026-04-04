You will **not** get 52 pages yet, because the system generates the agreement from **`agreement_templates.body_html`** (HTML), and your current template HTML is only ~6KB (that’s why you get ~2 pages).

### Check what your template currently contains
Run this in **PB_CRM** Supabase SQL editor:

```sql
select id, name, length(body_html) as body_len
from public.agreement_templates
where is_active = true
order by created_at desc;
```

- If `body_len` is small (like 6,000–20,000), you will **not** get 52 pages.

### To get 52 pages
You must **convert** `Propforma ATS Orchid Life.pdf` into HTML and paste that full HTML into `agreement_templates.body_html` for the template your booking uses.

Minimal flow:
1) Convert PDF → HTML (Adobe “Export PDF” / any PDF→HTML converter).
2) Update template body_html:

```sql
update public.agreement_templates
set body_html = '<PASTE FULL 52-PAGE HTML HERE>', updated_at = now()
where id = '<your_agreement_template_id>';
```

3) Re-generate:
- `GET /api/v1/bookings/:id/merged-agreement`

If you tell me your **`agreement_template_id`** (or booking id), I’ll point to the exact row to update.