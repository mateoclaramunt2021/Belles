'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Modal } from '@/components/ui/Modal'
import { ViajeForm, defaultFormData, type ViajeFormData, type GasoilRow, type IncidenteRow } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Download, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import type { Viaje } from '@/types'
import * as XLSX from 'xlsx'

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: 'pendiente' | 'cobrado' }) {
  return estado === 'cobrado'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20"><CheckCircle size={10} /> Cobrado</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20"><Clock size={10} /> Pendiente</span>
}

export default function ViajesPage() {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  const [viajes, setViajes] = useState<Viaje[]>([])
  const [loading, setLoading] = useState(true)
  const [editViaje, setEditViaje] = useState<Viaje | null>(null)
  const [editGasoil, setEditGasoil] = useState<GasoilRow[]>([])
  const [editIncidentes, setEditIncidentes] = useState<IncidenteRow[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filters
  const [fMat, setFMat] = useState('')
  const [fCho, setFCho] = useState('')
  const [fCli, setFCli] = useState('')
  const [fMer, setFMer] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fEstado, setFEstado] = useState('')

  const fetchViajes = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('viajes').select('*').order('fecha_carga', { ascending: false, nullsFirst: false }).order('fecha', { ascending: false }).order('created_at', { ascending: false })
    if (!isAdmin && profile?.id) q = (q as any).eq('chofer_id', profile.id)
    const { data } = await q
    setViajes((data as Viaje[]) ?? [])
    setLoading(false)
  }, [supabase, isAdmin, profile?.id])

  useEffect(() => { fetchViajes() }, [fetchViajes])

  const matriculas  = useMemo(() => [...new Set(viajes.map(v => v.matricula))].filter(Boolean).sort(), [viajes])
  const choferes    = useMemo(() => [...new Set(viajes.map(v => v.chofer_nombre).filter(Boolean))].sort(), [viajes])
  const clientes    = useMemo(() => [...new Set(viajes.map(v => v.cliente_nombre).filter(Boolean))].sort(), [viajes])
  const mercaderias = useMemo(() => [...new Set(viajes.map(v => v.mercaderia).filter(Boolean))].sort(), [viajes])

  const filtered = useMemo(() => viajes.filter(v => {
    const fechaRef = v.fecha_carga || v.fecha
    if (fMat && v.matricula !== fMat) return false
    if (fCho && v.chofer_nombre !== fCho) return false
    if (fCli && v.cliente_nombre !== fCli) return false
    if (fMer && v.mercaderia !== fMer) return false
    if (fFrom && fechaRef < fFrom) return false
    if (fTo && fechaRef > fTo) return false
    if (fEstado && v.estado_cobro !== fEstado) return false
    return true
  }), [viajes, fMat, fCho, fCli, fMer, fFrom, fTo, fEstado])

  const clearFilters = () => { setFMat(''); setFCho(''); setFCli(''); setFMer(''); setFFrom(''); setFTo(''); setFEstado('') }

  // Totales de la vista filtrada
  const totales = useMemo(() => ({
    importe: filtered.reduce((s, v) => s + (v.importe ?? 0), 0),
    gasoil:  filtered.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0),
    comision: filtered.reduce((s, v) => s + (v.comision ?? 0), 0),
    peajes:  filtered.reduce((s, v) => s + (v.peajes ?? 0), 0),
    imprevistos: filtered.reduce((s, v) => s + (v.imprevistos ?? 0), 0),
    toneladas: filtered.reduce((s, v) => s + (v.toneladas ?? 0), 0),
    km: filtered.reduce((s, v) => s + (v.km ?? 0), 0),
  }), [filtered])
  const totalNeto = totales.importe - totales.gasoil - totales.comision - totales.peajes - totales.imprevistos

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('viajes').delete().eq('id', deleteId)
    if (error) { toast.error('Error al eliminar') }
    else { toast.success('Viaje eliminado'); setDeleteId(null); fetchViajes() }
  }

  const handleToggleCobro = async (v: Viaje) => {
    const nuevoEstado = v.estado_cobro === 'pendiente' ? 'cobrado' : 'pendiente'
    const { error } = await supabase.from('viajes').update({ estado_cobro: nuevoEstado }).eq('id', v.id)
    if (error) toast.error('Error al actualizar estado')
    else {
      toast.success(nuevoEstado === 'cobrado' ? 'Marcado como cobrado' : 'Marcado como pendiente')
      fetchViajes()
    }
  }

  const openEdit = async (v: Viaje) => {
    const [{ data: g }, { data: inc }] = await Promise.all([
      supabase.from('viaje_gasoil').select('*').eq('viaje_id', v.id).order('orden'),
      supabase.from('incidentes').select('*').eq('viaje_id', v.id).order('created_at'),
    ])
    setEditGasoil(
      (g ?? []).length > 0
        ? (g as any[]).map(r => ({ litros: r.litros, km: r.km, estacion: r.estacion, importe: r.importe }))
        : [{ litros: v.litros_gasoil ?? 0, km: 0, estacion: '', importe: v.gasto_gasoil ?? 0 }]
    )
    setEditIncidentes(
      (inc ?? []).map((i: any) => ({ tipo: i.tipo, descripcion: i.descripcion, importe: i.importe }))
    )
    setEditViaje(v)
  }

  const handleEdit = async (data: ViajeFormData, gasoil: GasoilRow[], incidentes: IncidenteRow[]) => {
    if (!editViaje) return
    setEditLoading(true)
    try {
      const { error } = await supabase.from('viajes').update({
        fecha: data.fecha_carga || data.fecha, fecha_carga: data.fecha_carga || data.fecha,
        fecha_descarga: data.fecha_descarga || null,
        hora_entrada_carga: data.hora_entrada_carga || null, hora_salida_carga: data.hora_salida_carga || null,
        hora_entrada_descarga: data.hora_entrada_descarga || null, hora_salida_descarga: data.hora_salida_descarga || null,
        numero_remito: data.numero_remito_carga || data.numero_remito,
        numero_remito_carga: data.numero_remito_carga, numero_remito_descarga: data.numero_remito_descarga,
        numero_planilla: data.numero_planilla, matricula: data.matricula, mat_zorra: data.mat_zorra,
        camion_id: data.camion_id || null, chofer_id: data.chofer_id || null, chofer_nombre: data.chofer_nombre,
        cliente_id: data.cliente_id || null, cliente_nombre: data.cliente_nombre,
        origen: data.origen, destino: data.destino, mercaderia: data.mercaderia,
        km: data.km, km_carga: data.km_carga, km_descarga: data.km_descarga,
        kg_bruto: data.kg_bruto, kg_tara: data.kg_tara, kg_neto: data.kg_neto,
        toneladas: data.toneladas, tipo_precio: data.tipo_precio,
        tarifa_aplicada: data.tarifa_aplicada, precio_por_unidad: data.precio_por_unidad,
        importe: data.importe, gasto_gasoil: data.gasto_gasoil, litros_gasoil: data.litros_gasoil,
        comision: data.comision, peajes: data.peajes, imprevistos: data.imprevistos,
        estado_cobro: data.estado_cobro, medio_pago: data.medio_pago || null,
        fecha_cobro: data.fecha_cobro || null, numero_factura: data.numero_factura || null,
        foto_url: data.foto_url || null, foto_remito_descarga_url: data.foto_remito_descarga_url || null,
        notas: data.notas || null,
      }).eq('id', editViaje.id)

      if (error) { toast.error('Error al actualizar'); return }

      // Actualizar gasoil
      await supabase.from('viaje_gasoil').delete().eq('viaje_id', editViaje.id)
      const gasoilValido = gasoil.filter(g => g.litros > 0 || g.importe > 0)
      if (gasoilValido.length > 0)
        await supabase.from('viaje_gasoil').insert(gasoilValido.map((g, i) => ({ viaje_id: editViaje.id, ...g, orden: i + 1 })))

      // Actualizar incidentes
      await supabase.from('incidentes').delete().eq('viaje_id', editViaje.id)
      const incValidos = incidentes.filter(i => i.descripcion.trim())
      if (incValidos.length > 0)
        await supabase.from('incidentes').insert(incValidos.map(i => ({ viaje_id: editViaje.id, ...i })))

      toast.success('Viaje actualizado')
      setEditViaje(null)
      fetchViajes()
    } finally {
      setEditLoading(false)
    }
  }

  const exportarExcel = () => {
    const rows = filtered.map(v => ({
      'Planilla':        v.numero_planilla,
      'F. Carga':        v.fecha_carga || v.fecha,
      'F. Descarga':     v.fecha_descarga || '',
      'Matrícula':       v.matricula,
      'Zorra':           v.mat_zorra,
      'Chofer':          v.chofer_nombre,
      'Cliente':         v.cliente_nombre,
      'Origen':          v.origen,
      'Destino':         v.destino,
      'Mercadería':      v.mercaderia,
      'Remito Carga':    v.numero_remito_carga || v.numero_remito,
      'Remito Descarga': v.numero_remito_descarga,
      'Km':              v.km,
      'Kg Bruto':        v.kg_bruto,
      'Kg Tara':         v.kg_tara,
      'Kg Neto':         v.kg_neto,
      'Toneladas':       v.toneladas,
      'Tipo Precio':     v.tipo_precio,
      'P/Ton':           v.tarifa_aplicada,
      'Importe':         v.importe,
      'Gasoil ($)':      v.gasto_gasoil,
      'Litros':          v.litros_gasoil,
      'Comisión':        v.comision,
      'Peajes':          v.peajes,
      'Imprevistos':     v.imprevistos,
      'Beneficio':       (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0) - (v.imprevistos ?? 0),
      'Estado Cobro':    v.estado_cobro,
      'Medio Pago':      v.medio_pago || '',
      'Fecha Cobro':     v.fecha_cobro || '',
      'N° Factura':      v.numero_factura || '',
      'Notas':           v.notas || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Viajes')
    XLSX.writeFile(wb, `viajes_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${filtered.length} viajes exportados`)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-text-secondary">{filtered.length} de {viajes.length} registros</p>
        <div className="flex items-center gap-2">
          <button onClick={exportarExcel} className="btn-ghost flex items-center gap-2 text-xs">
            <Download size={13} /> Excel
          </button>
          <Link href="/viajes/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo Viaje
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <FilterGroup label="Matrícula">
            <select className="input text-xs" value={fMat} onChange={e => setFMat(e.target.value)}>
              <option value="">Todas</option>
              {matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FilterGroup>
          {isAdmin && (
            <FilterGroup label="Chofer">
              <select className="input text-xs" value={fCho} onChange={e => setFCho(e.target.value)}>
                <option value="">Todos</option>
                {choferes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterGroup>
          )}
          <FilterGroup label="Cliente">
            <select className="input text-xs" value={fCli} onChange={e => setFCli(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Mercadería">
            <select className="input text-xs" value={fMer} onChange={e => setFMer(e.target.value)}>
              <option value="">Todas</option>
              {mercaderias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Estado">
            <select className="input text-xs" value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="cobrado">Cobrado</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Desde">
            <input type="date" className="input text-xs" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          </FilterGroup>
          <FilterGroup label="Hasta">
            <input type="date" className="input text-xs" value={fTo} onChange={e => setFTo(e.target.value)} />
          </FilterGroup>
          <button className="btn-ghost text-xs self-end" onClick={clearFilters}>Limpiar</button>
        </div>
      </div>

      {/* Totales de la vista */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Ingresos', value: '$' + fmt(totales.importe), color: 'text-success' },
            { label: 'Gasoil',   value: '$' + fmt(totales.gasoil),  color: 'text-danger' },
            { label: 'Comisiones', value: '$' + fmt(totales.comision), color: 'text-warning' },
            { label: 'Peajes',   value: '$' + fmt(totales.peajes),  color: 'text-text-primary' },
            { label: 'Neto',     value: '$' + fmt(totalNeto),       color: totalNeto >= 0 ? 'text-accent-cyan' : 'text-danger' },
            { label: 'Toneladas', value: totales.toneladas.toFixed(2) + 't', color: 'text-accent-purple' },
          ].map(k => (
            <div key={k.label} className="bg-bg-secondary border border-border-color rounded-xl p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">{k.label}</p>
              <p className={`font-mono text-sm font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {['Planilla','F. Carga','F. Descarga','Matrícula','Zorra','Chofer','Cliente','Origen → Destino','Mercadería','Ton','Importe','Gasoil','Neto','Estado','Fotos','Acciones'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={16} className="py-10 text-center text-text-secondary">Sin viajes registrados</td></tr>
              ) : filtered.map(v => {
                const profit = (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0) - (v.imprevistos ?? 0)
                return (
                  <tr key={v.id} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell font-mono px-3 whitespace-nowrap">
                      {v.numero_planilla ? <span className="text-accent-cyan">{v.numero_planilla}</span> : <span className="text-text-secondary">—</span>}
                    </td>
                    <td className="table-cell font-mono whitespace-nowrap px-3">{v.fecha_carga || v.fecha}</td>
                    <td className="table-cell font-mono whitespace-nowrap px-3 text-text-secondary">{v.fecha_descarga || '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">{v.matricula}</span>
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap font-mono text-text-secondary">{v.mat_zorra || '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.chofer_nombre ?? '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.cliente_nombre ?? '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.origen || '—'} → {v.destino || '—'}</td>
                    <td className="table-cell px-3">{v.mercaderia ?? '—'}</td>
                    <td className="table-cell px-3 text-right font-mono">{(v.toneladas ?? 0).toFixed(2)}</td>
                    <td className="table-cell px-3 text-right font-mono whitespace-nowrap text-success">${fmt(v.importe ?? 0)}</td>
                    <td className="table-cell px-3 text-right font-mono text-danger whitespace-nowrap">${fmt(v.gasto_gasoil ?? 0)}</td>
                    <td className={`table-cell px-3 text-right font-mono font-semibold whitespace-nowrap ${profit >= 0 ? 'text-accent-cyan' : 'text-danger'}`}>
                      ${fmt(profit)}
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <button onClick={() => handleToggleCobro(v)} title="Click para cambiar estado">
                        <EstadoBadge estado={v.estado_cobro} />
                      </button>
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {v.foto_url && (
                          <a href={v.foto_url} target="_blank" rel="noreferrer" title="Foto remito carga"
                            className="p-1 rounded text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {v.foto_remito_descarga_url && (
                          <a href={v.foto_remito_descarga_url} target="_blank" rel="noreferrer" title="Foto remito descarga"
                            className="p-1 rounded text-text-secondary hover:text-success hover:bg-success/10 transition-all">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {!v.foto_url && !v.foto_remito_descarga_url && <span className="text-text-secondary">—</span>}
                      </div>
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(v)}
                          className="p-1.5 rounded text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all" title="Editar">
                          <Pencil size={13} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => setDeleteId(v.id)}
                            className="p-1.5 rounded text-text-secondary hover:text-danger hover:bg-danger/10 transition-all" title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar */}
      <Modal open={!!editViaje} onClose={() => setEditViaje(null)} title="Editar viaje" size="xl">
        {editViaje && (
          <ViajeForm
            initialData={editViaje as unknown as Record<string, unknown>}
            initialGasoil={editGasoil}
            initialIncidentes={editIncidentes}
            onSubmit={handleEdit}
            submitLabel="Actualizar viaje"
            loading={editLoading}
          />
        )}
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar eliminación" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar este viaje? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  )
}
