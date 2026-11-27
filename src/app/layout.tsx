import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "600"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1220",
};

export const metadata: Metadata = {
  title: { default: "MY-VIEW", template: "%s · MY-VIEW" },
  description: "Seu dia em um só lugar: agenda, tarefas, e-mails e conhecimento — MVA Solutions.",
  icons: {
    icon: [
      { url: "/mva/favicon.svg", type: "image/svg+xml" },
      { url: "/mva/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/mva/apple-touch-icon.png",
  },
  manifest: "/mva/site.webmanifest",
  openGraph: {
    title: "MY-VIEW · MVA Solutions",
    description: "Seu dia em um só lugar: agenda, tarefas, e-mails e base de conhecimento.",
    images: ["/mva/og-image.png"],
  },
  verification: {
    google: "pcJeh2gBIUcX3up3_HKAGt_RKVpuW6V19Al6D3EvmtA",
  },
};

// Runs before first paint so the saved (or system) theme never flashes the wrong colors.
const themeScript = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${space.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
