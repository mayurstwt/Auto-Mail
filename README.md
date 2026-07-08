# Job Email Automation

A Next.js 15 web app that lets you send personalised job-application emails to multiple recruiters in one go, attaching your resume and auto-filling each recipient's name from their email address.

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Gmail SMTP credentials

Open `.env.local` and fill in your Gmail details:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

#### How to generate a Gmail App Password

> You must have **2-Step Verification** enabled on your Google account.

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**.
2. Under *"How you sign in to Google"*, click **2-Step Verification**.
3. Scroll to the bottom and click **App passwords**.
4. Select **Other (Custom name)**, name it `Job Email Bot`, and click **Generate**.
5. Copy the 16-character password and paste it as `SMTP_PASS` in `.env.local`.

> ⚠️ **Never commit `.env.local` to git.** It is already in `.gitignore`.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 How It Works

| Step | Action |
|------|--------|
| **Step 1** | Enter an email subject and body (use `{{name}}` as a personalisation placeholder), then upload your resume (PDF/DOCX). |
| **Step 2** | Paste recruiter email addresses (one per line). Click **Send Emails**. |
| **Results** | Each email's send status (✅ sent / ❌ failed) is shown in real time after the API call completes. |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS 3 |
| Email transport | Nodemailer v6 + Gmail SMTP |
| File parsing | Busboy v1 (multipart/form-data) |

---

## ⚠️ Important Limits

| Limit | Detail |
|-------|--------|
| **Gmail daily cap** | ~500 emails/day for regular Gmail accounts |
| **Vercel function timeout** | 10 seconds default – recommend **max 20 emails per batch** (each send adds a 1.5 s delay) |
| **Resume file size** | Max **4.5 MB** (Vercel's serverless body limit) |

---

## 🏗️ Project Structure

```
automail/
├── app/
│   ├── globals.css           # Tailwind + custom styles
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Two-step form UI (Client Component)
│   └── api/send-emails/
│       └── route.ts          # POST handler (Busboy + Nodemailer)
├── lib/
│   └── email-utils.ts        # extractNameFromEmail, validateEmail, delay
├── types/
│   └── index.ts              # Shared TypeScript interfaces
├── .env.local                # Gmail SMTP credentials (never commit!)
├── package.json
└── README.md
```

---

## 🛡️ Privacy & Security

- Uploaded resumes are held **only in memory** during the API call; they are never written to disk or stored anywhere.
- SMTP credentials are read exclusively from server-side environment variables and are never exposed to the browser.
