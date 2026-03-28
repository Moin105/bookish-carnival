import type { Metadata } from 'next'
import './globals.css'
import SecurityGuard from './components/SecurityGuard'
import AntiTamper from './components/AntiTamper'
import DevToolsBlocker from './components/DevToolsBlocker'
import AuthGuard from './components/AuthGuard'

export const metadata: Metadata = {
  title: 'Clock Chair Company',
  description: 'E-Invoicing System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DevToolsBlocker />
        <SecurityGuard />
        <AntiTamper />
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}
