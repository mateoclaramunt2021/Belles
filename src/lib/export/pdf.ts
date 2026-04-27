import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Viaje } from '@/types'

const BRAND_COLOR: [number, number, number]  = [0, 212, 255]   // accent-cyan
const BG_COLOR:    [number, number, number]  = [10, 11, 16]     // bg-primary
const CARD_COLOR:  [number, number, number]  = [18, 19, 26]     // bg-secondary
const TEXT_COLOR:  [number, number, number]  = [210, 215, 230]  // text-primary
const TEXT_MUTED:  [number, number, number]  = [110, 118, 140]  // text-secondary
const SUCCESS:     [number, number, number]  = [0, 232, 157]    // success green
const WARNING:     [number, number, number]  = [255, 165, 2]    // warning orange

function addHeader(doc: jsPDF, titulo: string, subtitulo: string) {
  const w = doc.internal.pageSize.getWidth()

  // Fondo oscuro header
  doc.setFillColor(...BG_COLOR)
  doc.rect(0, 0, w, 30, 'F')

  // Borde inferior cyan
  doc.setDrawColor(...BRAND_COLOR)
  doc.setLineWidth(0.5)
  doc.line(0, 30, w, 30)

  // Logo text
  doc.setTextColor(...BRAND_COLOR)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('TransControl', 14, 12)

  doc.setTextColor(...TEXT_MUTED)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('BELLES URUGUAY', 14, 18)

  // Título a la derecha
  doc.setTextColor(...TEXT_COLOR)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, w - 14, 12, { align: 'right' })

  doc.setTextColor(...TEXT_MUTED)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitulo, w - 14, 19, { align: 'right' })

  // Fecha generación
  doc.setFontSize(7)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-UY')}`, w - 14, 25, { align: 'right' })
}

function addFooter(doc: jsPDF) {
  const w    = doc.internal.pageSize.getWidth()
  const h    = doc.internal.pageSize.getHeight()
  const pages = (doc as any).internal.getNumberOfPages()

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BRAND_COLOR)
    doc.setLineWidth(0.3)
    doc.line(14, h - 10, w - 14, h - 10)

    doc.setTextColor(...TEXT_MUTED)
    doc.setFontSize(7)
    doc.text('TransControl Belles Uruguay', 14, h - 6)
    doc.text(`Pág. ${i} / ${pages}`, w - 14, h - 6, { align: 'right' })
  }
}

export function exportarLiquidacionPDF(viajes: Viaje[], periodo: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w   = doc.internal.pageSize.getWidth()

  addHeader(doc, 'Liquidación', periodo)

  // Resumen KPIs
  const totalImporte  = viajes.reduce((s, v) => s + (v.importe ?? 0), 0)
  const totalGasoil   = viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0)
  const totalComision = viajes.reduce((s, v) => s + (v.comision ?? 0), 0)
  const totalPeajes   = viajes.reduce((s, v) => s + (v.peajes ?? 0), 0)
  const totalNeto     = totalImporte - totalGasoil - totalComision - totalPeajes
  const totalTons     = viajes.reduce((s, v) => s + (v.toneladas ?? 0), 0)

  const kpis = [
    { label: 'Viajes',   value: String(viajes.length) },
    { label: 'Toneladas', value: `${totalTons.toFixed(2)} t` },
    { label: 'Ingresos', value: `$${totalImporte.toLocaleString('es-UY')}` },
    { label: 'Gasoil',   value: `$${totalGasoil.toLocaleString('es-UY')}` },
    { label: 'Neto',     value: `$${totalNeto.toLocaleString('es-UY')}` },
  ]

  let x = 14
  const kpiW = (w - 28) / kpis.length
  kpis.forEach((k, i) => {
    doc.setFillColor(...CARD_COLOR)
    doc.roundedRect(x + i * kpiW + 1, 34, kpiW - 2, 14, 2, 2, 'F')
    doc.setTextColor(...TEXT_MUTED)
    doc.setFontSize(7)
    doc.text(k.label, x + i * kpiW + kpiW / 2 + 1, 40, { align: 'center' })
    doc.setTextColor(i === 4 ? SUCCESS[0] : TEXT_COLOR[0], i === 4 ? SUCCESS[1] : TEXT_COLOR[1], i === 4 ? SUCCESS[2] : TEXT_COLOR[2])
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(k.value, x + i * kpiW + kpiW / 2 + 1, 46, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })

  // Tabla de viajes
  autoTable(doc, {
    startY: 52,
    head: [['Fecha', 'Remito', 'Matrícula', 'Chofer', 'Destino', 'Toneladas', 'Tarifa $/t', 'Importe', 'Gasoil', 'Neto']],
    body: viajes.map((v) => {
      const neto = (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0)
      return [
        v.fecha,
        v.numero_remito ?? '',
        v.matricula ?? '',
        v.chofer_nombre ?? '',
        v.destino ?? '',
        (v.toneladas ?? 0).toFixed(3),
        `$${(v.tarifa_aplicada ?? 0).toLocaleString('es-UY')}`,
        `$${(v.importe ?? 0).toLocaleString('es-UY')}`,
        `$${(v.gasto_gasoil ?? 0).toLocaleString('es-UY')}`,
        `$${neto.toLocaleString('es-UY')}`,
      ]
    }),
    foot: [['', '', '', '', 'TOTAL', `${totalTons.toFixed(3)} t`, '', `$${totalImporte.toLocaleString('es-UY')}`, `$${totalGasoil.toLocaleString('es-UY')}`, `$${totalNeto.toLocaleString('es-UY')}`]],
    theme: 'plain',
    styles: {
      fillColor: CARD_COLOR,
      textColor: TEXT_COLOR,
      fontSize: 7,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: BG_COLOR,
      textColor: BRAND_COLOR,
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: BRAND_COLOR,
      lineWidth: 0.3,
    },
    footStyles: {
      fillColor: BG_COLOR,
      textColor: SUCCESS,
      fontSize: 7,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: BG_COLOR },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 20, halign: 'right', textColor: SUCCESS },
      8: { cellWidth: 18, halign: 'right', textColor: WARNING },
      9: { cellWidth: 20, halign: 'right', textColor: SUCCESS },
    },
  })

  addFooter(doc)

  const fileName = `Liquidacion_${periodo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(fileName)
}
