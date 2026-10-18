import type { Metadata } from "next";
import './components/app-shell.css';

export const metadata: Metadata = {
  title: "Oneliner",
  description: "A quieter way to keep a trading journal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
