'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EstadoLiquidacion, EstadoCobro } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { FileText, CheckCircle, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Viaje } from '@/types'
import { exportarLiquidacionExcel } from '@/lib/export/excel'
import { exportarLiquidacionPDF } from '@/lib/export/pdf'

interface Quincena {
  periodo:     string
  label:       string
  fecha_inicio: string
  fecha_fin:   string
  viajes:      Viaje[]
  total:       number
  estado:      'abierta' | 'cerrada' | 'cobrada'
  liquidacion_id?: string
}

export default function LiquidacionesPage() {
  const supabase = createClient()
  const [quincenas, setQuincenas] = useState<Quincena[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ quincena: Quincena; accion: 'cerrar' | 'cobrar' } | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Generar últimas 6 quincenas
    const hoy = new Date()
    const periodos: Omit<Quincena, 'viajes' | 'total' | 'estado' | 'liquidacion_id'>[] = []

    for (let i = 0; i < 6; i++) {
      const mes = subMonths(hoy, i)
      const anio = mes.getFullYear()
      const mesNum = mes.getMonth() + 1
      const mesStr = String(mesNum).padStart(2, '0')

      // Q2: del 16 al fin del mes
      const q2inicio = `${anio}-${mesStr}-16`
      const q2fin    = format(endOfMonth(mes), 'yyyy-MM-dd')
      const q2label  = format(mes, "MMMM yyyy", { locale: es }) + ' (16-fin)'

      periodos.push({
        periodo:     `${anio}-${mesStr}-Q2`,
        label:       q2label.charAt(0).toUpperCase() + q2label.slice(1),
        fecha_inicio: q2inicio,
        fecha_fin:   q2fin,
      })

      // Q1: del 1 al 15
      const q1inicio = `${anio}-${mesStr}-01`
      const q1fin    = `${anio}-${mesStr}-15`
      const q1label  = format(mes, "MMMM yyyy", { locale: es }) + ' (1-15)'

      periodos.push({
        periodo:     `${anio}-${mesStr}-Q1`,
        label:       q1label.charAt(0).toUpperCase() + q1label.slice(1),
        fecha_inicio: q1inicio,
        fecha_fin:   q1fin,
      })
    }

    // Obtener viajes y liquidaciones
    const fechaMin = periodos[periodos.length - 1].fecha_inicio
    const fechaMax = periodos[0].fecha_fin

    const [vRes, lRes] = await Promise.all([
      supabase.from('viajes').select('*').gte('fecha', fechaMin).lte('fecha', fechaMax).order('fecha'),
      supabase.from('liquidaciones').select('*'),
    ])

    const todosViajes = (vRes.data ?? []) as Viaje[]
    const liquidaciones = lRes.data ?? []

    const result: Quincena[] = periodos.map((p) => {
      const viajesQ = todosViajes.filter((v) => v.fecha >= p.fecha_inicio && v.fecha <= p.fecha_fin)
      const liq = liquidaciones.find((l) => l.periodo === p.periodo)
      return {
        ...p,
        viajes: viajesQ,
        total:  viajesQ.reduce((s, v) => s + (v.importe ?? 0), 0),
        estado: liq?.estado ?? 'abierta',
        liquidacion_id: liq?.id,
      }
    })

    setQuincenas(result)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCambiarEstado = async () => {
    if (!confirmModal) return
    const { quincena, accion } = confirmModal
    setSaving(true)

    const nuevoEstado = accion === 'cerrar' ? 'cerrada' : 'cobrada'

    if (quincena.liquidacion_id) {
      await supabase.from('liquidaciones').update({ estado: nuevoEstado }).eq('id', quincena.liquidacion_id)
    } else {
      const { data } = await supabase.from('liquidaciones').insert({
        periodo:       quincena.periodo,
        fecha_inicio:  quincena.fecha_inicio,
        fecha_fin:     quincena.fecha_fin,
        total_importe: quincena.total,
        total_viajes:  quincena.viajes.length,
        estado:        nuevoEstado,
      }).select().single()

      // Si se cobró, marcar los viajes como cobrados
      if (accion === 'cobrar' && data) {
        const ids = quincena.viajes.map((v) => v.id)
        if (ids.length > 0) {
          await supabase.from('viajes').update({ estado_cobro: 'cobrado' }).in('id', ids)
        }
      }
    }

    setSaving(false)
    setConfirmModal(null)
    toast.success(accion === 'cerrar' ? 'Quincena cerrada' : 'Quincena marcada como cobrada')
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Liquidaciones</h1>
        <p className="text-text-secondary text-sm mt-0.5">Vista quincenal de viajes y cobros</p>
      </div>

      <div className="space-y-3">
        {quincenas.map((q) => (
          <div key={q.periodo} className="card">
            {/* Header de la quincena */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandida(expandida === q.periodo ? null : q.periodo)}
            >
              <div className="flex items-center gap-3">
                <button className="text-text-secondary transition-transform duration-200" style={{ transform: expandida === q.periodo ? 'rotate(90deg)' : 'none' }}>
                  <ChevronRight size={18} />
                </button>
                <div>
                  <p className="font-semibold text-text-primary capitalize">{q.label}</p>
                  <p className="text-xs text-text-secondary">{q.viajes.length} viajes · {q.fecha_inicio} → {q.fecha_fin}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="font-data font-bold text-success">${q.total.toLocaleString('es-UY')}</p>
                  <p className="text-xs text-text-secondary">{q.viajes.filter((v) => v.estado_cobro === 'pendiente').length} pendientes</p>
                </div>
                <EstadoLiquidacion estado={q.estado} />
              </div>
            </div>

            {/* Detalle expandido */}
            {expandida === q.periodo && (
              <div className="mt-4 space-y-4 animate-fade-in">
                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border-color">
                  {q.estado === 'abierta' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmModal({ quincena: q, accion: 'cerrar' }) }}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <FileText size={14} /> Cerrar quincena
                    </button>
                  )}
                  {(q.estado === 'cerrada' || q.estado === 'abierta') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmModal({ quincena: q, accion: 'cobrar' }) }}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <CheckCircle size={14} /> Marcar como cobrada
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); exportarLiquidacionExcel(q.viajes, q.label) }}
                    className="btn-ghost text-sm flex items-center gap-2"
                  >
                    <Download size={14} /> Excel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportarLiquidacionPDF(q.viajes, q.label) }}
                    className="btn-ghost text-sm flex items-center gap-2"
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>

                {/* Resumen financiero */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Ingresos', value: q.total, color: 'text-success' },
                    { label: 'Gasoil', value: q.viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0), color: 'text-warning' },
                    { label: 'Neto', value: q.total - q.viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0) + (v.comision ?? 0) + (v.peajes ?? 0), 0), color: 'text-accent-cyan' },
                    { label: 'Toneladas', value: q.viajes.reduce((s, v) => s + (v.toneladas ?? 0), 0), color: 'text-text-primary', suffix: ' t' },
                  ].map((item) => (
                    <div key={item.label} className="bg-bg-primary rounded-lg p-3 text-center">
                      <p className="text-xs text-text-secondary">{item.label}</p>
                      <p className={`font-data font-bold ${item.color}`}>
                        {item.label === 'Toneladas' ? item.value.toFixed(1) : `$${item.value.toLocaleString('es-UY')}`}{item.suffix ?? ''}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Tabla de viajes */}
                {q.viajes.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border-color">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="table-header text-left">Fecha</th>
                          <th className="table-header text-left">Remito</th>
                          <th className="table-header text-left hidden md:table-cell">Matrícula</th>
                          <th className="table-header text-left hidden lg:table-cell">Chofer</th>
                          <th className="table-header text-left hidden md:table-cell">Destino</th>
                          <th className="table-header text-right">Toneladas</th>
                          <th className="table-header text-right">Importe</th>
                          <th className="table-header">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.viajes.map((v) => (
                          <tr key={v.id} className="table-row-hover">
                            <td className="table-cell font-data text-xs">{v.fecha}</td>
                            <td className="table-cell font-data text-xs text-accent-cyan">{v.numero_remito}</td>
                            <td className="table-cell font-data text-xs hidden md:table-cell">{v.matricula}</td>
                            <td className="table-cell text-text-secondary text-xs hidden lg:table-cell">{v.chofer_nombre}</td>
                            <td className="table-cell text-xs hidden md:table-cell">{v.destino}</td>
                            <td className="table-cell text-right font-data text-xs">{v.toneladas?.toFixed(3)}</td>
                            <td className="table-cell text-right font-data text-xs text-success">${v.importe?.toLocaleString('es-UY')}</td>
                            <td className="table-cell"><EstadoCobro estado={v.estado_cobro} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-text-secondary text-sm py-6">Sin viajes en esta quincena</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal confirmación */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.accion === 'cerrar' ? 'Cerrar quincena' : 'Marcar como cobrada'}
        size="sm"
        footer={
          <>
            <button onClick={() => setConfirmModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleCambiarEstado} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Procesando...' : confirmModal?.accion === 'cerrar' ? 'Cerrar' : 'Marcar cobrada'}
            </button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">
          {confirmModal?.accion === 'cerrar'
            ? `¿Cerrar la quincena "${confirmModal?.quincena.label}"? Se congelará el resumen pero podrás seguir editando viajes.`
            : `¿Marcar "${confirmModal?.quincena.label}" como cobrada? Se marcará cada viaje de la quincena como cobrado.`
          }
        </p>
      </Modal>
    </div>
  )
}
