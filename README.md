# TeleCRM — Setup Guide

A simple, shared CRM built for telemarketing teams. Two users, real-time data, Zoom Phone integration, automatic client timezone display.

---

## What you'll need (all free)

- A [Supabase](https://supabase.com) account — your database
- A [Vercel](https://vercel.com) account — your website hosting
- A [GitHub](https://github.com) account — to connect your code to Vercel
- [Node.js](https://nodejs.org) installed on your computer (for first-time setup only)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for Zoom webhook deployment only)

---

## Step 1 — Set up Supabase (your database) - iV#aB+X7uPnu-Se

1. Go to [supabase.com](https://supabase.com) and sign up for free
2. Click **New project**, give it a name (e.g. `telecrm`), choose a region close to you, set a password
3. Once the project loads, click **SQL Editor** in the left menu
4. Copy the entire contents of `supabase/schema.sql` and paste it in, then click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`) 
https://cjrxjifgbggqvrqfltka.supabase.co

   - **anon public** key (long string starting with `eyJ...`) eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcnhqaWZnYmdncXZycWZsdGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTE5MjEsImV4cCI6MjA5NzE4NzkyMX0.P19UjWlq2oLoV5LlUXX_vWCr7QsL_0w_-gxRXxUELDA

---

## Step 2 — Create user accounts

1. In Supabase, go to **Authentication → Users**
2. Click **Invite user** (or **Add user**) and enter your email
3. Do the same for your partner's email
4. Both of you will receive an email to set your password

---

## Step 3 — Deploy to Vercel

1. **Upload the code to GitHub:**
   - Go to [github.com](https://github.com) and create a **New repository** (call it `telecrm`)
   - On your computer, open a terminal in the `telecrm` folder and run:
     ```
     npm install
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/telecrm.git
     git push -u origin main
     ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign up with GitHub
   - Click **Add New Project** → import your `telecrm` repo
   - Before clicking Deploy, go to **Environment Variables** and add:
     ```
     VITE_SUPABASE_URL       = https://xxxx.supabase.co     (from Step 1)
     VITE_SUPABASE_ANON_KEY  = eyJ...                       (from Step 1)
     ```
   - Click **Deploy** — your CRM will be live at a `https://telecrm-xxx.vercel.app` URL

---

## Step 4 — Set up Zoom Phone integration (call auto-logging)

This step makes Zoom Phone automatically log every call to the CRM.

### 4a — Deploy the webhook function

Install the Supabase CLI, then in your terminal: project id is cjrxjifgbggqvrqfltka

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
supabase secrets set ZOOM_WEBHOOK_SECRET=tz-bOI2pQ7WFieUf4-6lgw
supabase functions deploy zoom-webhook
```

Your webhook URL will be:
```
https://cjrxjifgbggqvrqfltka.supabase.co/functions/v1/zoom-webhook
```

### 4b — Create the Zoom app

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us) and sign in
2. Click **Develop → Build App** → choose **Webhook Only**
3. Give it a name (e.g. `TeleCRM`) and enable it
4. Under **Event Subscriptions**, add a subscription:
   - **Event notification URL:** paste your webhook URL from above
   - Subscribe to these events:
     - `phone.call_ended`
     - `phone.callee_missed`
5. Copy the **Secret Token** Zoom gives you - tz-bOI2pQ7WFieUf4-6lgw
6. Run: `supabase secrets set ZOOM_WEBHOOK_SECRET=THE_TOKEN_YOU_COPIED`
7. Redeploy: `supabase functions deploy zoom-webhook`

After this, every call you make or receive through Zoom Phone will automatically appear in the client's call history, and **Last Call Date** will update automatically.

---

## Daily use

### Click-to-dial
Every client row and detail page has a **Call** button. Clicking it opens Zoom Phone and dials the number automatically. Zoom Phone must be installed and running on your computer.

### Client local time
The CRM automatically detects the client's timezone from their phone number (e.g. +61 → Sydney time) and shows their local time in real time. This helps you call at the right hour.

### Status colors
| Status | Meaning |
|---|---|
| 🔵 New | Fresh lead, not yet contacted |
| ⚫ No Answer | Called, no response |
| 🟡 Follow Up | Interested, needs follow-up |
| 🟢 In The Money | Client bought / paying |
| 🔴 Not Interested | Declined |
| 🟣 Monkey | Unclear / non-committal |
| 🟤 Broke | Can't afford, no budget |

### Follow-up alerts
- 🔴 **Red rows** = overdue follow-ups (past the scheduled date)
- 🟡 **Yellow rows** = follow-ups due today
- The Dashboard shows all of today's follow-ups at a glance

---

## Local development (optional)

If you want to run the CRM on your computer before deploying:

```bash
# Copy .env.example to .env and fill in your Supabase values
cp .env.example .env

npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Questions?

- The CRM auto-refreshes when data changes — both users see updates in real time
- To add more users, go to Supabase → Authentication → Users
- To change a client's status, click the client row and click any status pill
