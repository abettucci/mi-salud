// Datos del encabezado de un informe, leídos localmente del texto. No interpreta valores clínicos.

export type ReportHeader = {
  institution: string | null
  doctor: string | null
  orderDate: string | null
}

export function extractHeader(text: string): ReportHeader {
  const flat = text.replace(/\s+/g, " ")
  const institution = flat.match(/Instituci[oó]n:\s*([^-]{2,60}?)\s*(?:-{5,}|Página|$)/i)
  const doctor = flat.match(/Dr\.?\s*\/\s*Dra\.?:\s*([^-]{2,60}?)\s*(?:Instituci|-{5,}|Página|$)/i)
  const date = flat.match(/Fecha y Orden:\s*(\d{2}\/\d{2}\/\d{4})/)
  return {
    institution: institution?.[1]?.trim() || null,
    doctor: doctor?.[1]?.trim() || null,
    orderDate: date?.[1] ?? null,
  }
}
