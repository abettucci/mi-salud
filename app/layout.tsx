import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mi Salud — Tu historia, bajo tu control",
  description: "Portal personal para organizar documentos e información de salud.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body>{children}</body></html>
}
