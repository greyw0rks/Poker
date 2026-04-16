import './globals.css';

export const metadata = {
  title:       'CeloPoker — No-Limit Hold\'em on MiniPay',
  description: 'Play No-Limit Texas Hold\'em with cUSD on Celo. Built for MiniPay.',
  viewport:    'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor:  '#1a6b3a',
  other: {
    'talentapp:project_verification': '53e3df34a59e7bcbf3f313f454ced37f31fe4f29eebf427ccbed23405fd9c5f533ff46ccbe80012e214ea251aa4a675b03e86508e25f2319eec5d4e126ffe468',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
