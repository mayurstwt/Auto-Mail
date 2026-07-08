/**
 * app/api/send-emails/route.ts
 * POST /api/send-emails
 *
 * Accepts multipart/form-data:
 *   subject, body, emails (newline-separated), resume (file)
 *
 * Body is sent verbatim — no name extraction from email addresses.
 */

import { NextRequest, NextResponse } from 'next/server';
import Busboy from 'busboy';
import nodemailer from 'nodemailer';
import { validateEmail, delay } from '@/lib/email-utils';
import type { EmailResult, ParsedFormData } from '@/types';

const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;
const SEND_DELAY_MS = 1500;

// ── Multipart parser ──────────────────────────────────────────────────────────

function parseForm(req: NextRequest): Promise<ParsedFormData> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get('content-type') ?? '';
    const bb = Busboy({ headers: { 'content-type': contentType } });

    const fields: Record<string, string> = {};
    let resumeBuffer: Buffer | null = null;
    let resumeFilename = 'resume';
    let resumeMimeType = 'application/octet-stream';
    let fileSizeBytes = 0;

    bb.on('field', (name: string, val: string) => { fields[name] = val; });

    bb.on('file', (_name: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      resumeFilename = info.filename || 'resume';
      resumeMimeType = info.mimeType || 'application/octet-stream';
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        fileSizeBytes += chunk.length;
        if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
          stream.resume();
          bb.emit('error', new Error(`File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`));
          return;
        }
        chunks.push(chunk);
      });

      stream.on('end', () => { resumeBuffer = Buffer.concat(chunks); });
    });

    bb.on('finish', () => {
      if (!resumeBuffer) return reject(new Error('No resume file uploaded.'));
      resolve({
        subject: fields.subject ?? '',
        body: fields.body ?? '',
        emails: fields.emails ?? '',
        resume: { buffer: resumeBuffer, filename: resumeFilename, mimeType: resumeMimeType },
      });
    });

    bb.on('error', (err: Error) => reject(err));

    if (!req.body) return reject(new Error('Empty request body.'));

    const reader = req.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { bb.end(); break; }
          bb.write(value);
        }
      } catch (e) { bb.destroy(e as Error); reject(e); }
    };
    pump();
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let parsed: ParsedFormData;
    try {
      parsed = await parseForm(req);
    } catch (e) {
      return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
    }

    const subject = parsed.subject.trim();
    const body = parsed.body.trim();
    const { resume } = parsed;

    if (!subject) return NextResponse.json({ success: false, error: 'Subject is required.' }, { status: 400 });
    if (!body) return NextResponse.json({ success: false, error: 'Body is required.' }, { status: 400 });
    if (!parsed.emails) return NextResponse.json({ success: false, error: 'Email list is required.' }, { status: 400 });

    const emailList = parsed.emails.split('\n').map((e) => e.trim()).filter(Boolean);
    if (emailList.length === 0) return NextResponse.json({ success: false, error: 'Email list is empty.' }, { status: 400 });

    const validEmails = emailList.filter(validateEmail);
    const invalidEmails = emailList.filter((e) => !validateEmail(e));

    if (validEmails.length === 0) return NextResponse.json({ success: false, error: 'No valid email addresses found.' }, { status: 400 });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const results: EmailResult[] = [];

    for (const bad of invalidEmails) {
      results.push({ email: bad, status: 'failed', error: 'Invalid email format.' });
    }

    for (let i = 0; i < validEmails.length; i++) {
      const to = validEmails[i];
      if (i > 0) await delay(SEND_DELAY_MS);
      try {
        await transporter.sendMail({
          from: `"Job Application" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text: body,
          attachments: [{ filename: resume.filename, content: resume.buffer, contentType: resume.mimeType }],
        });
        console.log(`[automail] ✅ Sent → ${to}`);
        results.push({ email: to, status: 'sent' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error.';
        console.error(`[automail] ❌ Failed → ${to}: ${msg}`);
        results.push({ email: to, status: 'failed', error: msg });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected server error.';
    console.error('[automail] Fatal:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
