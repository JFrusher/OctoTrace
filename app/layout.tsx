import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";

const firaSans = Fira_Sans({ variable: "--font-fira-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const firaCode = Fira_Code({ variable: "--font-fira-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgilePulse",
  description: "Octopus Agile consumption, cost and savings dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${firaSans.variable} ${firaCode.variable} antialiased`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
