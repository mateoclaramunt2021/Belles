import * as XLSX from 'xlsx'
import type { Viaje } from '@/types'

export function exportarLiquidacionExcel(viajes: Viaje[], periodo: string) {
  const rows: Record<string, string | number>[] = viajes.map((v) => ({
    Fecha:           v.fecha,
    Remito:          v.numero_remito ?? '',
    Matrícula:       v.matricula ?? '',
    Chofer:          v.chofer_nombre ?? '',
    Cliente:         v.cliente_nombre ?? '',
    Origen:          v.origen ?? '',
    Destino:         v.destino ?? '',
    Mercadería:      v.mercaderia ?? '',
    'Toneladas':     v.toneladas ?? 0,
    'Tarifa $/t':    v.tarifa_aplicada ?? 0,
    Importe:         v.importe ?? 0,
    Gasoil:          v.gasto_gasoil ?? 0,
    Comisión:        v.comision ?? 0,
    Peajes:          v.peajes ?? 0,
    Neto:            (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0),
    'Estado cobro':  v.estado_cobro ?? '',
  }))

  const totalImporte  = viajes.reduce((s, v) => s + (v.importe ?? 0), 0)
  const totalGasoil   = viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0)
  const totalComision = viajes.reduce((s, v) => s + (v.comision ?? 0), 0)
  const totalPeajes   = viajes.reduce((s, v) => s + (v.peajes ?? 0), 0)
  const totalNeto     = totalImporte - totalGasoil - totalComision - totalPeajes

  // Fila de totales
  rows.push({
    Fecha:           'TOTALES',
    Remito:          '',
    Matrícula:       '',
    Chofer:          '',
    Cliente:         '',
    Origen:          '',
    Destino:         '',
    Mercadería:      '',
    'Toneladas':     viajes.reduce((s, v) => s + (v.toneladas ?? 0), 0),
    'Tarifa $/t':    0,
    Importe:         totalImporte,
    Gasoil:          totalGasoil,
    Comisión:        totalComision,
    Peajes:          totalPeajes,
    Neto:            totalNeto,
    'Estado cobro':  'TOTAL',
  })

  const ws   = XLSX.utils.json_to_sheet(rows)
  const wb   = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Liquidación')

  // Anchos de columna
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
  ]

  const fileName = `Liquidacion_${periodo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

export function exportarReporteExcel(data: Record<string, unknown>[], titulo: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.substring(0, 31))
  XLSX.writeFile(wb, `${titulo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
}
