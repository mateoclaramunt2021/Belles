'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────
interface RowData {
  fecha: string
  matricula: string
  numero_remito: string
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  chofer_nombre: string
  km: number
  toneladas: number
  tarifa_aplicada: number
  importe: number
  notas: string
  estado_cobro: 'pendiente' | 'cobrado'
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
}

// ── Excel date → ISO string ────────────────────────────────────────────────
function excelDateToISO(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'number') {
    // Excel serial date (days since 1900-01-00)
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return ''
    const m = String(d.m).padStart(2, '0')
    const day = String(d.d).padStart(2, '0')
    return `${d.y}-${m}-${day}`
  }
  if (typeof val === 'string') {
    // Try DD/MM/YY or DD/MM/YYYY
    const parts = val.trim().split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      const year = y.length === 2 ? '20' + y : y
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // Already ISO?
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10)
  }
  return ''
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

// ── Column normalizer ──────────────────────────────────────────────────────
function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ── Map one raw Excel row → RowData ───────────────────────────────────────
function mapRow(raw: Record<string, unknown>, headerMap: Record<string, string>): RowData | null {
  const get = (field: string): unknown => {
    const col = headerMap[field]
    return col ? raw[col] : undefined
  }

  const fecha = excelDateToISO(get('fecha'))
  const matricula = toStr(get('matricula'))

  // Skip empty / summary rows
  if (!fecha || !matricula || matricula.toLowerCase() === 'total') return null

  const pago = toStr(get('pago'))
  const estado_cobro: 'pendiente' | 'cobrado' = pago && pago !== '' ? 'cobrado' : 'pendiente'

  const remolque = toStr(get('remolque'))
  const planilla  = toStr(get('planilla'))
  const remito    = toStr(get('remito'))

  return {
    fecha,
    matricula,
    numero_remito: planilla || remito || '',
    cliente_nombre: toStr(get('cliente')),
    origen: toStr(get('origen')),
    destino: toStr(get('destino')),
    mercaderia: toStr(get('mercaderia')),
    chofer_nombre: toStr(get('chofer')),
    km: toNum(get('km')),
    toneladas: toNum(get('tons') ?? get('toneladas')),
    tarifa_aplicada: toNum(get('pto') ?? get('tarifa')),
    importe: toNum(get('importe')),
    notas: remolque ? 'Remolque: ' + remolque : '',
    estado_cobro,
    gasto_gasoil: 0,
    litros_gasoil: 0,
    comision: 0,
    peajes: 0,
  }
}

// ── Detect header row (look for "Matricula" keyword) ──────────────────────
function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:T100')
  for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (cell && typeof cell.v === 'string') {
        const norm = normalizeHeader(cell.v)
        if (norm.includes('matricul') || norm.includes('cliente') || norm.includes('destino')) {
          return r
        }
      }
    }
  }
  return 0
}

// ── Build headerMap: fieldName → excelColumnLetter ────────────────────────
function buildHeaderMap(sheet: XLSX.WorkSheet, headerRow: number): Record<string, string> {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:T200')
  const map: Record<string, string> = {}

  const FIELD_KEYWORDS: Record<string, string[]> = {
    fecha:     ['carga', 'fecha'],
    matricula: ['matricula', 'matricul'],
    remolque:  ['remolque', 'mat. remol', 'mat remol'],
    planilla:  ['planilla'],
    cliente:   ['cliente'],
    origen:    ['origen'],
    destino:   ['destino'],
    mercaderia:['mercaderia', 'mercader'],
    chofer:    ['chofer'],
    remito:    ['remito'],
    km:        ['km'],
    tons:      ['tons', 'tonelada'],
    pto:       ['p/to', 'pto', 'tarifa', 'precio'],
    importe:   ['importe'],
    pago:      ['pago', 'f.cobr', 'fcobr'],
  }

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })]
    if (!cell || !cell.v) continue
    const norm = normalizeHeader(String(cell.v))
    const colLetter = XLSX.utils.encode_col(c)

    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (!map[field] && keywords.some(kw => norm.includes(kw))) {
        map[field] = colLetter
      }
    }
  }
  return map
}

// ── Parse sheet → rows ────────────────────────────────────────────────────
function parseSheet(sheet: XLSX.WorkSheet): RowData[] {
  const headerRow = detectHeaderRow(sheet)
  const headerMap = buildHeaderMap(sheet, headerRow)

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:T200')
  const rows: RowData[] = []

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const raw: Record<string, unknown> = {}
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      raw[XLSX.utils.encode_col(c)] = cell ? cell.v : undefined
    }
    const mapped = mapRow(raw, headerMap)
    if (mapped) rows.push(mapped)
  }
  return rows
}

// ─────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────
export default function ImportarPage() {
  const supabase = createClient()

  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [preview, setPreview] = useState<RowData[]>([])
  const [allRows, setAllRows] = useState<RowData[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [errors, setErrors] = useState(0)
  const [done, setDone] = useState(false)

  // ── File upload ──────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setFileName(file.name)
    setDone(false)
    setImported(0)
    setErrors(0)

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      if (!data) return
      const wb = XLSX.read(data, { type: 'array' })
      setWorkbook(wb)
      setSheets(wb.SheetNames)
      const first = wb.SheetNames[0]
      setSelectedSheet(first)
      loadSheet(wb, first)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return
    const rows = parseSheet(sheet)
    setAllRows(rows)
    setPreview(rows.slice(0, 10))
  }

  const handleSheetChange = (name: string) => {
    setSelectedSheet(name)
    if (workbook) loadSheet(workbook, name)
    setDone(false)
    setImported(0)
    setErrors(0)
  }

  // ── Drag & drop ──────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Import to Supabase ───────────────────────────────────────────────
  const doImport = async () => {
    if (!allRows.length) return
    setImporting(true)
    setDone(false)
    let ok = 0
    let err = 0

    // Insert in batches of 100
    const BATCH = 100
    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH)
      const { error } = await supabase.from('viajes').insert(batch)
      if (error) {
        err += batch.length
        console.error('Batch error:', error.message)
      } else {
        ok += batch.length
      }
    }

    setImported(ok)
    setErrors(err)
    setImporting(false)
    setDone(true)

    if (ok > 0) toast.success(`${ok} viajes importados correctamente`)
    if (err > 0) toast.error(`${err} registros con error`)
  }

  const fmt = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      {/* Header info */}
      <div className="card">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="text-accent-cyan mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-1">Importación desde Excel</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Subí el archivo Excel de control de viajes. El sistema detecta automáticamente las columnas
              (Carga, Matrícula, Planilla, Cliente, Origen, Destino, Mercadería, Chofer, Km, Tons, P/To, Importe).
              Podés importar múltiples hojas (VIAJES, URUFOR, SAMAN, TGL, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border-color rounded-xl p-10 text-center cursor-pointer transition-all hover:border-accent-cyan/50 hover:bg-accent-cyan/5"
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <Upload size={32} className="text-accent-cyan mx-auto mb-3 opacity-70" />
        {fileName ? (
          <p className="text-sm font-semibold text-accent-cyan">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-text-primary">Arrastrá el archivo Excel aquí</p>
            <p className="text-xs text-text-secondary mt-1">o hacé clic para seleccionarlo (.xlsx, .xls)</p>
          </>
        )}
      </div>

      {/* Sheet selector */}
      {sheets.length > 1 && (
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
            Seleccioná la hoja a importar
          </p>
          <div className="flex flex-wrap gap-2">
            {sheets.map(s => (
              <button
                key={s}
                onClick={() => handleSheetChange(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  selectedSheet === s
                    ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                    : 'border-border-color text-text-secondary hover:border-accent-cyan/40 hover:text-text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Vista previa — {allRows.length} registros detectados
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">Mostrando los primeros 10</p>
            </div>
            {!done && (
              <button
                onClick={doImport}
                disabled={importing}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Importar {allRows.length} registros
                  </>
                )}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {['Fecha','Matrícula','N° Planilla','Cliente','Origen','Destino','Mercadería','Chofer','Km','Tons','Tarifa','Importe','Estado'].map(h => (
                    <th key={h} className="table-header text-left whitespace-nowrap px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell px-3 font-mono whitespace-nowrap">{row.fecha}</td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">
                        {row.matricula}
                      </span>
                    </td>
                    <td className="table-cell px-3 font-mono">{row.numero_remito}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{row.cliente_nombre}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{row.origen}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{row.destino}</td>
                    <td className="table-cell px-3">{row.mercaderia}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{row.chofer_nombre}</td>
                    <td className="table-cell px-3 text-right font-mono">{fmt(row.km)}</td>
                    <td className="table-cell px-3 text-right font-mono">{row.toneladas.toFixed(2)}</td>
                    <td className="table-cell px-3 text-right font-mono">{row.tarifa_aplicada}</td>
                    <td className="table-cell px-3 text-right font-mono text-success">${fmt(row.importe)}</td>
                    <td className="table-cell px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        row.estado_cobro === 'cobrado'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {row.estado_cobro}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {done && (
        <div className={`card flex items-start gap-3 ${errors === 0 ? 'border-success/30' : 'border-warning/30'}`}>
          {errors === 0 ? (
            <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">Importación completada</p>
            <p className="text-xs text-text-secondary mt-1">
              {imported > 0 && <span className="text-success">{imported} viajes importados correctamente. </span>}
              {errors > 0 && <span className="text-warning">{errors} registros con errores (posibles duplicados). </span>}
            </p>
            <button
              onClick={() => { setDone(false); setPreview([]); setAllRows([]); setFileName(''); setWorkbook(null); setSheets([]) }}
              className="btn-secondary text-xs mt-3"
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
