import './globals.css';

export const metadata = {
  title:       "CeloPoker — No-Limit Hold'em on MiniPay",
  description: "Play No-Limit Texas Hold'em with cUSD on Celo. Built for MiniPay.",
  other: {
    'talentapp:project_verification':
      '53e3df34a59e7bcbf3f313f454ced37f31fe4f29eebf427ccbed23405fd9c5f533ff46ccbe80012e214ea251aa4a675b03e86508e25f2319eec5d4e126ffe468',
  },
};

// Next.js 14+ requires viewport/themeColor in a separate export
export const viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor:   '#1a6b3a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
