'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Row {
  chofer: string
  viajes: number
  ingresos: number
  gasoil: number
  litros: number
  comisiones: number
}

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }

export default function ChoferesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('viajes')
        .select('chofer_nombre,importe,gasto_gasoil,litros_gasoil,comision')
      const m: Record<string, Row> = {}
      ;(data ?? []).forEach((v: any) => {
        const k = v.chofer_nombre || 'Sin asignar'
        if (!m[k]) m[k] = { chofer: k, viajes: 0, ingresos: 0, gasoil: 0, litros: 0, comisiones: 0 }
        m[k].viajes++
        m[k].ingresos += v.importe ?? 0
        m[k].gasoil += v.gasto_gasoil ?? 0
        m[k].litros += v.litros_gasoil ?? 0
        m[k].comisiones += v.comision ?? 0
      })
      setRows(Object.values(m).sort((a, b) => b.ingresos - a.ingresos))
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <h3 className="text-sm font-semibold text-text-primary">Rendimiento por Chofer</h3>
          <span className="font-mono text-xs text-text-secondary">{rows.length} choferes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Chofer','Viajes','Ingresos Generados','Gasto Gasoil','Litros','Comisiones','Promedio/Viaje'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-secondary">Sin datos</td>
                </tr>
              ) : rows.map((r, i) => {
                const avg = r.viajes > 0 ? r.ingresos / r.viajes : 0
                return (
                  <tr key={r.chofer} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `hsl(${(i * 47) % 360}, 60%, 40%)`, color: '#fff' }}
                        >
                          {r.chofer.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.chofer}</span>
                      </div>
                    </td>
                    <td className="table-cell px-4 font-mono text-right">{r.viajes}</td>
                    <td className="table-cell px-4 font-mono text-right text-success">${fmt(r.ingresos)}</td>
                    <td className="table-cell px-4 font-mono text-right text-danger">${fmt(r.gasoil)}</td>
                    <td className="table-cell px-4 font-mono text-right">{fmt(r.litros)} lt</td>
                    <td className="table-cell px-4 font-mono text-right">${fmt(r.comisiones)}</td>
                    <td className="table-cell px-4 font-mono text-right text-accent-cyan">${fmt(Math.round(avg))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
