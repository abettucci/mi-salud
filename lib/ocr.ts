// OCR local: todo corre en el navegador. Los archivos no salen del dispositivo.
// Tesseract descarga solo los modelos de idioma (no contienen datos del usuario).

const MAX_TEXT = 50000
const MAX_PDF_PAGES = 20

export async function extractText(file: File): Promise<string> {
  if (file.type === "application/pdf") return extractPdfText(file)
  if (file.type === "image/jpeg" || file.type === "image/png") return recognizeImage(file)
  // HEIC/HEIF no lo lee Tesseract; se guarda sin texto.
  return ""
}

async function recognizeImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("spa+eng")
  try {
    const { data } = await worker.recognize(file)
    return clean(data.text)
  } finally {
    await worker.terminate()
  }
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
  }
  // PDF escaneados (sin capa de texto) devuelven vacío: no se hace OCR de imágenes dentro del PDF.
  return clean(pages.join("\n"))
}

function clean(text: string) {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT)
}
