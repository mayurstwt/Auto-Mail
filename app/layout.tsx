import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Email Automation',
  description: 'Send personalised job applications automatically to multiple recruiters at once.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
