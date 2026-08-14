export interface ScannedItem {
  name: string
  price: number
}

export interface ScannedReceipt {
  items: ScannedItem[]
  tax: number | null
  tip: number | null
  subtotal: number | null
  total: number | null
  date: string | null
}

const MODEL = 'claude-sonnet-5'

const SYSTEM_PROMPT = `You extract structured data from photos of restaurant/bar receipts.
Read every line item you can see, including its exact name and price (before tax/tip).
Also find the tax amount and tip amount if printed on the receipt (tip is often blank — if
you don't see one printed, return null for it, don't guess), and the date printed on the
receipt if there is one. Ignore the header/footer, payment card info, and loyalty text.

Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly:
{
  "items": [{"name": string, "price": number}, ...],
  "subtotal": number | null,
  "tax": number | null,
  "tip": number | null,
  "total": number | null,
  "date": string | null
}
All numbers are plain decimal dollar amounts (no currency symbols). "date" must be formatted
as "YYYY-MM-DD" (converting whatever format is printed), or null if no date is visible. If a
value is not present on the receipt, use null. If a line item's price is ambiguous, make your
best estimate.`

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export async function scanReceipt(apiKey: string, base64Image: string, mediaType: string): Promise<ScannedReceipt> {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings first.')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            {
              type: 'text',
              text: 'Extract this receipt into the JSON schema described in your instructions.',
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let message = `Anthropic API error (${response.status})`
    try {
      const parsed = JSON.parse(body)
      if (parsed?.error?.message) message = parsed.error.message
    } catch {
      // keep default message
    }
    throw new Error(message)
  }

  const data = await response.json()
  const text: string = data?.content?.find((block: { type: string }) => block.type === 'text')?.text ?? ''
  if (!text) throw new Error('The model did not return any text to parse.')

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch {
    throw new Error('Could not parse a JSON receipt from the model response.')
  }

  const raw = parsed as Partial<ScannedReceipt>
  const items: ScannedItem[] = Array.isArray(raw.items)
    ? raw.items
        .filter((item): item is ScannedItem => !!item && typeof item.name === 'string' && Number.isFinite(item.price))
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
    : []

  const toNumberOrNull = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null

  return {
    items,
    subtotal: toNumberOrNull(raw.subtotal),
    tax: toNumberOrNull(raw.tax),
    tip: toNumberOrNull(raw.tip),
    total: toNumberOrNull(raw.total),
    date,
  }
}

export function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type ?? 'image/jpeg'
      resolve({ base64, mediaType })
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}
