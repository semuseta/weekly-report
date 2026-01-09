import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const filename = (req.headers.get('x-filename') || '').toLowerCase()
  const arrayBuffer = await req.arrayBuffer()

  try {
    if (filename.endsWith('.csv')) {
      const text = new TextDecoder().decode(arrayBuffer)
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      const rows = parsed.data as any[]
      // compute KPIs below
      return computeKpis(rows)
    }

    // default: try Excel parsing
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any>(sheet)
    return computeKpis(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function computeKpis(rows: any[]) {
  const rowsCount = rows.length
  if (rowsCount === 0) {
    return NextResponse.json({ rowsCount: 0, sumHours: 0, averageHours: 0, preview: [] })
  }

  // find the column key that equals 'hours' case-insensitive
  const first = rows[0]
  const keys = Object.keys(first || {})
  const hoursKey = keys.find(k => k.toLowerCase() === 'hours')
  if (!hoursKey) {
    return NextResponse.json({ error: 'Die Tabelle enthält keine Spalte `hours`.' }, { status: 400 })
  }

  let sum = 0
  let invalidCount = 0

  for (const r of rows) {
    const raw = r[hoursKey]
    if (raw === null || raw === undefined || raw === '') {
      invalidCount++
      continue
    }
    const asString = String(raw).replace(',', '.')
    const n = parseFloat(asString)
    if (Number.isFinite(n)) {
      sum += n
    } else {
      invalidCount++
    }
  }

  const average = rowsCount > 0 ? sum / rowsCount : 0

  return NextResponse.json({
    rowsCount,
    sumHours: Math.round(sum * 100) / 100,
    averageHours: Math.round(average * 100) / 100,
    invalidValues: invalidCount,
    preview: rows.slice(0, 5),
  })
}

