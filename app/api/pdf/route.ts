import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

export const runtime = 'nodejs'

type PdfRequest = {
  rowsCount: number
  sumHours: number
  averageHours: number
  invalidValues: number
}

function formatNumberDe(value: number, decimals = 2) {
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  return new Intl.NumberFormat('de-DE', opts).format(value)
}

export async function POST(req: Request) {
  try {
    const body: PdfRequest = await req.json()
    const { rowsCount, sumHours, averageHours, invalidValues } = body

    if (!rowsCount || sumHours === undefined) {
      return NextResponse.json({ error: 'Fehlende KPI-Daten' }, { status: 400 })
    }

    // PDF-Dokument erstellen (Buffer-based)
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Titel
    doc.fontSize(20).font('Helvetica-Bold').text('Wöchentliches Reporting', { align: 'center' })
    doc.moveDown()

    // Datum
    const today = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.fontSize(10).font('Helvetica').text(`Erstellt: ${today}`, { align: 'center' })
    doc.moveDown(1.5)

    // KPIs-Überschrift
    doc.fontSize(14).font('Helvetica-Bold').text('Kennzahlen', { underline: true })
    doc.moveDown(0.5)

    // KPIs als einfache Liste
    doc.fontSize(11).font('Helvetica')
    doc.text(`• Erfasste Einträge: ${formatNumberDe(rowsCount, 0)}`)
    doc.text(`• Summe Stunden: ${formatNumberDe(sumHours, 2)} h`)
    doc.text(`• Durchschnitt / Eintrag: ${formatNumberDe(averageHours, 2)} h`)
    if (invalidValues > 0) {
      doc.text(`• Ungültige Werte: ${formatNumberDe(invalidValues, 0)}`)
    }
    doc.moveDown(1)

    // Zusammenfassung-Überschrift
    doc.fontSize(14).font('Helvetica-Bold').text('Zusammenfassung', { underline: true })
    doc.moveDown(0.5)

    // Summary-Text
    const summary =
      rowsCount === 0
        ? 'Für den ausgewählten Zeitraum liegen keine auswertbaren Einträge vor.'
        : `In diesem Zeitraum wurden ${formatNumberDe(rowsCount, 0)} Einträge erfasst mit insgesamt ${formatNumberDe(sumHours, 2)} Stunden. Der durchschnittliche Aufwand pro Eintrag beträgt ${formatNumberDe(averageHours, 2)} Stunden.${
            invalidValues > 0
              ? ` ${formatNumberDe(invalidValues, 0)} Einträge enthielten ungültige oder leere Werte und wurden bei der Berechnung ignoriert.`
              : ''
          }`

    doc.fontSize(11).font('Helvetica').text(summary, { align: 'justify', lineGap: 4 })

    // Finalize
    doc.end()

    // Warte, bis alle Chunks gepuffert sind
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve())
    })

    const pdfBuffer = Buffer.concat(chunks)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="weekly-report.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
