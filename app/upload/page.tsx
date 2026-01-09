"use client"

import { useState } from "react"

type ApiResult = {
  rowsCount?: number
  sumHours?: number
  averageHours?: number
  invalidValues?: number
  preview?: any[]
  error?: string
}

export default function UploadPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const ab = await file.arrayBuffer()
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-filename": file.name,
          "content-type": "application/octet-stream",
        },
        body: ab,
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data?.error || 'Upload fehlgeschlagen' })
      } else {
        setResult(data)
      }
    } catch (err) {
      setResult({ error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadPdf() {
    if (!result || result.error) return
    setDownloadLoading(true)
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rowsCount: result.rowsCount,
          sumHours: result.sumHours,
          averageHours: result.averageHours,
          invalidValues: result.invalidValues,
        }),
      })
      if (!res.ok) throw new Error('PDF-Download fehlgeschlagen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'weekly-report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Fehler beim PDF-Download: ' + String(err))
    } finally {
      setDownloadLoading(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Wöchentliches Reporting — Upload</h1>
      <p>Wähle eine CSV- oder Excel-Datei (.csv, .xlsx, .xls)</p>
      <input disabled={loading} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} />

      {loading && <p>Verarbeite Datei…</p>}

      {result && (
        <section style={{ marginTop: 20 }}>
          <h2>KPIs</h2>
          {result.error ? (
            <div style={{ color: 'crimson' }}>
              <strong>Fehler:</strong> {result.error}
            </div>
          ) : (
            <div>
              <ul>
                <li><strong>Zeilen (rowsCount):</strong> {formatNumberDe(result.rowsCount, 0)}</li>
                <li><strong>Summe Stunden (sumHours):</strong> {formatNumberDe(result.sumHours, 2)}</li>
                <li><strong>Durchschnitt Stunden / Eintrag (averageHours):</strong> {formatNumberDe(result.averageHours, 2)}</li>
                <li><strong>Ungültige Werte (invalidValues):</strong> {formatNumberDe(result.invalidValues, 0)}</li>
              </ul>

              {/* Regelbasierte, kurze Text-Zusammenfassung (Frontend) */}
              <div style={{ marginTop: 12 }}>
                <SummaryDisplay result={result} />
              </div>

              <div style={{ marginTop: 16 }}>
                <button disabled={downloadLoading} onClick={handleDownloadPdf}>
                  {downloadLoading ? 'PDF wird generiert…' : 'PDF herunterladen'}
                </button>
              </div>

              {result.preview && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setShowPreview(v => !v)}>
                    {showPreview ? 'Vorschau verbergen' : 'Vorschau anzeigen'}
                  </button>
                  {showPreview && (
                    <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12, marginTop: 8 }}>
                      {JSON.stringify(result.preview, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  )
}

function formatNumberDe(value?: number, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  return new Intl.NumberFormat('de-DE', opts).format(Number(value))
}

function SummaryDisplay({ result }: { result: ApiResult }) {
  const rows = result.rowsCount ?? 0
  const fmt = (n?: number) => formatNumberDe(n, 2)

  if (rows === 0) {
    return <p>Für den ausgewählten Zeitraum liegen keine auswertbaren Einträge vor.</p>
  }

  return (
    <div>
      <p>
        In diesem Zeitraum wurden {formatNumberDe(rows, 0)} Einträge erfasst mit insgesamt {fmt(result.sumHours)} Stunden. Der
        durchschnittliche Aufwand pro Eintrag beträgt {fmt(result.averageHours)} Stunden.
      </p>
      {result.invalidValues && result.invalidValues > 0 && (
        <p>{formatNumberDe(result.invalidValues, 0)} Einträge enthielten ungültige oder leere Werte und wurden bei der Berechnung ignoriert.</p>
      )}
    </div>
  )
}
