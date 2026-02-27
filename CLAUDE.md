# Oil Dashboard — Claude Code Project Memory

## Project overview
Next.js 15 dashboard voor Oranjehoen (pluimvee-olieverwerking). Vercel deploy, Supabase backend.

## Dev server starten
- `npm` werkt NIET als runtimeExecutable in `.claude/launch.json` vanwege spaties in pad
- Gebruik short paths (8.3 format):
  - node: `C:/PROGRA~2/NOTESJ~1/node.exe`
  - next: `C:/Users/leend/ALEEND~1/ORANJE~1/DASHBO~1/OIL-DA~1/NODE_M~1/next/dist/bin/next`
- Snelste manier lokaal testen: `npm run dev` via Bash background + curl

## Env vars
- Alle Vercel env vars staan in `.env.local` (niet in git)
- Inclusief: Twilio, OUTREACH_WEBHOOK_SECRET, Supabase keys

## WhatsApp outreach test (lokaal)
1. Reset send naar pending via Supabase REST PATCH
2. `curl -X POST http://localhost:3000/api/outreach/send -H "x-outreach-secret: ..." -d '{"send_id":"..."}'`
3. Send ID voor tests: `7a25450b-c7e3-4124-89a8-343cc721ef64`

## Vercel MCP
- `list_teams`, `get_access_to_vercel_url` werken
- Voor auth op preview deploys: shareable URL ophalen via cookie dance
- `web_fetch_vercel_url` ondersteunt alleen GET

## Outreach architectuur
- **Email**: via Power Automate webhook → Outlook
- **WhatsApp**: via Twilio REST API (nog sandbox, niet productie)
- Append-only delivery ledger (`outreach_delivery_events`)
- Idempotente cron (`week_key` format `YYYY-WW-channel`)
- Wave 10 = campaign-based, Wave 11 = rich editor (Tiptap) updates

## Code conventies
- Nederlands in UI-teksten, Engels in code/variabelen
- Supabase RLS policies op alle tabellen
- Server Actions in `src/lib/actions/`
- Types in `src/types/`
- Migrations in `supabase/migrations/`
