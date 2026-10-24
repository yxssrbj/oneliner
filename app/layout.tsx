import { AccountTheme } from './components/account-controls';
import { io } from 'next/cache';
import { getAuthenticatedUser } from '../lib/supabase/server';
import { themeFromUserMetadata } from '../lib/theme';
import type { Metadata } from "next";
import './components/app-shell.css';

// Account-owned document attributes require request-time rendering.
export const instant = false;

export const metadata: Metadata = {
  title: "Oneliner",
  description: "A quieter way to keep a trading journal.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await io();
  const auth = await getAuthenticatedUser();
  const theme = themeFromUserMetadata(auth?.user.user_metadata);
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body><AccountTheme key={auth?.user.id ?? 'signed-out'} userId={auth?.user.id ?? null} initialTheme={theme} />{children}</body>
    </html>
  );
}
