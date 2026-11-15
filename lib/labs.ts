// Parser local de resultados de laboratorio. Todo corre en el navegador: sin servicios externos.
// Es heurístico: cubre el formato de los informes habituales; los casos raros se omiten, no se inventan.

export type LabFlag = "Bajo" | "Normal" | "Alto" | "Sin referencia"

export type LabResult = {
  analyte: string
  value: number
  unit: string
  refLow: number | null
  refHigh: number | null
  refText: string
  flag: LabFlag
  rawLine: string
}

export type ParsedLab = { collectedOn: string | null; results: LabResult[] }

const UNITS = [
  "mg/dL", "g/dL", "mmol/L", "UI/L", "U/L", "ng/mL", "pg/mL", "µUI/mL", "mUI/L", "mIU/L",
  "µg/dL", "ug/dL", "mEq/L", "/mm3", "/mm³", "/µL", "/uL", "fL", "pg", "seg", "mm/h", "mL", "%",
]
const UNIT = UNITS.map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
const NUM = String.raw`\d+(?:[.,]\d+)*`
const SAMPLE = String.raw`Muestra\s*:\s*(?:sangre entera|plasma citratado|suero|plasma|sangre|orina)`
const RESULT_RE = new RegExp(
  String.raw`(${NUM})\s*(${UNIT})(?![\w/])\s*(?:(hasta|menor de)\s+)?(${NUM})?(?:\s*-\s*(${NUM}))?`,
  "gi",
)

export function parseLabText(raw: string): ParsedLab {
  const dateMatch = raw.match(/Fecha y Orden:\s*(\d{2})\/(\d{2})\/(\d{4})/)
  const text = raw
    .replace(/Página \d+ de \d+ Paciente:[\s\S]*?-{10,}/g, " ")
    .replace(/\s+/g, " ")
  const collectedOn = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null

  const results: LabResult[] = []
  let cursor = 0
  for (const match of text.matchAll(RESULT_RE)) {
    const index = match.index ?? 0
    const before = text.slice(0, index).trimEnd()
    const prevChar = before.slice(-1)
    const segment = text.slice(cursor, index)
    cursor = index + match[0].length
    // Descarta "41-69 %" dentro de rangos por edad y similares: el número va precedido de "-" o ":".
    if (prevChar === "-" || prevChar === ":") continue

    const analyte = analyteFrom(segment)
    if (!analyte) continue

    const [, valueText, unit, prefix, ref1, ref2] = match
    const value = toNumber(valueText)
    const refLow = ref2 !== undefined && !prefix ? toNumber(ref1) : null
    const refHigh = ref2 !== undefined && !prefix ? toNumber(ref2) : ref1 !== undefined ? toNumber(ref1) : null
    const refText = [prefix, ref1, ref2 ? `- ${ref2}` : ""].filter(Boolean).join(" ")
    results.push({
      analyte,
      value,
      unit,
      refLow,
      refHigh,
      refText,
      flag: flagFor(value, refLow, refHigh, Boolean(ref1)),
      rawLine: `${analyte} ${valueText} ${unit}${refText ? ` ${refText}` : ""}`,
    })
  }
  return { collectedOn, results }
}

function analyteFrom(segment: string) {
  let name = segment
  const sample = segment.match(new RegExp(SAMPLE, "i"))
  if (sample && sample.index !== undefined) {
    const after = segment.slice(sample.index + sample[0].length).trim()
    name = after || segment.slice(0, sample.index)
  }
  // Sin "Muestra" delante, el nombre va antes de "Método:".
  const method = name.indexOf("Método:")
  if (method >= 0) name = name.slice(0, method).trim()
  // Quita números y basura previa: el nombre es lo que sigue al último token con dígitos.
  const tokens = name.trim().split(" ")
  const lastDigit = tokens.map((t) => /\d/.test(t)).lastIndexOf(true)
  if (lastDigit >= 0) name = tokens.slice(lastDigit + 1).join(" ")
  // Quita títulos de sección que suelen preceder al primer análisis.
  name = name.replace(/^(Hemograma|Hepatograma|Coagulograma básico|Coagulograma|Lipidograma)\s+/i, "")
  name = name.replace(/[:\-–(\s]+$/, "").replace(/^[\s:\-–]+/, "").trim()
  if (name.length < 3 || name.length > 80) return ""
  if (/Adultos|Niños|Observaciones|Diferencial|Deseable|Limítrofe|Alto:/i.test(name)) return ""
  return name
}

function toNumber(text: string | undefined) {
  if (text === undefined) return NaN
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."))
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ""))
  return Number(text)
}

function flagFor(value: number, low: number | null, high: number | null, hasRef: boolean): LabFlag {
  if (!hasRef) return "Sin referencia"
  if (low !== null && value < low) return "Bajo"
  if (high !== null && value > high) return "Alto"
  return "Normal"
}
