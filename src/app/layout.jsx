import './globals.css';

export const metadata = {
  title:       'CeloPoker — No-Limit Hold\'em on MiniPay',
  description: 'Play No-Limit Texas Hold\'em with cUSD on Celo. Built for MiniPay.',
  viewport:    'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor:  '#1a6b3a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
