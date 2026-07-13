// Shared TypeScript interfaces for AutoMail

/** One entry in the send history log */
export interface HistoryEntry {
  id: string;
  sentAt: number;        // Unix ms timestamp
  email: string;         // recipient address
  profileName: string;   // profile used
  resumeName: string;    // resume filename
  subject: string;       // email subject
  status: 'sent' | 'failed';
  error?: string;
}

/** A saved profile: pre-written email template + resume for a specific role */
export interface Profile {
  id: string;
  name: string;          // e.g. "Frontend Engineer", "Backend SDE-2"
  subject: string;
  body: string;
  resumeName: string;    // original filename, stored for display
  resumeMimeType: string;
  resumeData?: string;   // base64-encoded resume file content
  createdAt: number;
  updatedAt: number;
}

/** Result of sending to one recipient */
export interface EmailResult {
  email: string;
  status: 'sent' | 'failed';
  profileName?: string;
  error?: string;
}

/** JSON shape returned by POST /api/send-emails */
export interface SendEmailsResponse {
  success: boolean;
  results: EmailResult[];
  error?: string;
}

/** Parsed multipart form data on the server */
export interface ParsedFormData {
  profileName?: string;
  subject: string;
  body: string;
  emails: string;
  resume: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
}
