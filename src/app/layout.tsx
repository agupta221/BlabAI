import type { Metadata } from "next"
import { Inter, Righteous } from "next/font/google"
import "./globals.css"
import { ClientThemeProvider } from "@/app/components/client-theme-provider"

const inter = Inter({ subsets: ["latin"] })
const righteous = Righteous({ 
  weight: "400", 
  subsets: ["latin"],
  variable: '--font-righteous'
})

export const metadata: Metadata = {
  title: "BlabAI",
  description: "Your AI-powered conversation platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${righteous.variable}`}>
        <ClientThemeProvider>
          {children}
        </ClientThemeProvider>
      </body>
    </html>
  )
}
