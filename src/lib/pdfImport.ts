import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import jsQR from 'jsqr'
import type { BillState } from '../types'
import { decodeBillFromQR } from './billCodec'

// Bundled locally (via Vite) rather than fetched from a CDN, so importing works offline
// and doesn't depend on a third-party host being reachable.
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// Larger bills (more people/items) encode into a denser QR code that needs more pixels per
// module to lock onto reliably. Rendering the page at a single fixed scale worked for small
// test bills but silently failed to decode denser ones — so retry at increasing render scales
// instead of guessing one scale that has to work for every bill size.
const RENDER_SCALES = [3, 5, 8, 12]

export async function importBillFromPDF(file: File): Promise<BillState> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)

    for (const scale of RENDER_SCALES) {
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) continue

      await page.render({ canvasContext: context, viewport }).promise
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        return decodeBillFromQR(code.data)
      }
    }
  }

  throw new Error("Couldn't find a Split the Bill QR code in that PDF — make sure it was exported from this app.")
}
