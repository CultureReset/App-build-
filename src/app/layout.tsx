import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Modular — build the tools your business actually needs',
    template: '%s · Modular',
  },
  description:
    'An app store where every app is a container you install, edit and publish. Pick what you need, put it on your page, and never touch code or security.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
