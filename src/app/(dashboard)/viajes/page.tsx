'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Modal } from '@/components/ui/Modal'
import { ViajeForm, defaultFormData } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Viaje } from '@/types'

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

export default function ViajesPage() {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  const [viajes, setViajes] = useState<Viaje[]>([])
  const [loading, setLoading] = useState(true)
  const [editViaje, setEditViaje] = useState<Viaje | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [fMat, setFMat] = useState('')
  const [fCho, setFCho] = useState('')
  const [fCli, setFCli] = useState('')
  const [fMer, setFMer] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const fetchViajes = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('viajes')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (!isAdmin && profile?.id) q = (q as any).eq('chofer_id', profile.id)
    const { data } = await q
    setViajes((data as Viaje[]) ?? [])
    setLoading(false)
  }, [supabase, isAdmin, profile?.id])

  useEffect(() => { fetchViajes() }, [fetchViajes])

  const matriculas  = useMemo(() => [...new Set(viajes.map(v => v.matricula))].sort(), [viajes])
  const choferes    = useMemo(() => [...new Set(viajes.map(v => v.chofer_nombre).filter(Boolean))].sort(), [viajes])
  const clientes    = useMemo(() => [...new Set(viajes.map(v => v.cliente_nombre).filter(Boolean))].sort(), [viajes])
  const mercaderias = useMemo(() => [...new Set(viajes.map(v => v.mercaderia).filter(Boolean))].sort(), [viajes])

  const filtered = useMemo(() => viajes.filter(v => {
    if (fMat && v.matricula !== fMat) return false
    if (fCho && v.chofer_nombre !== fCho) return false
    if (fCli && v.cliente_nombre !== fCli) return false
    if (fMer && v.mercaderia !== fMer) return false
    if (fFrom && v.fecha < fFrom) return false
    if (fTo && v.fecha > fTo) return false
    return true
  }), [viajes, fMat, fCho, fCli, fMer, fFrom, fTo])

  const clearFilters = () => { setFMat(''); setFCho(''); setFCli(''); setFMer(''); setFFrom(''); setFTo('') }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('viajes').delete().eq('id', deleteId)
    if (error) { toast.error('Error al eliminar') }
    else { toast.success('Viaje eliminado'); setDeleteId(null); fetchViajes() }
  }

  const handleEdit = async (data: typeof defaultFormData) => {
    if (!editViaje) return
    setEditLoading(true)
    const { error } = await supabase.from('viajes').update({
      fecha: data.fecha, numero_remito: data.numero_remito, matricula: data.matricula,
      camion_id: data.camion_id || null, chofer_id: data.chofer_id || null,
      chofer_nombre: data.chofer_nombre, cliente_id: data.cliente_id || null,
      cliente_nombre: data.cliente_nombre, origen: data.origen, destino: data.destino,
      mercaderia: data.mercaderia, km: data.km, toneladas: data.toneladas,
      tarifa_aplicada: data.tarifa_aplicada, importe: data.importe,
      gasto_gasoil: data.gasto_gasoil, litros_gasoil: data.litros_gasoil,
      comision: data.comision, peajes: data.peajes, estado_cobro: data.estado_cobro,
      notas: data.notas || null,
    }).eq('id', editViaje.id)
    setEditLoading(false)
    if (error) { toast.error('Error al actualizar') }
    else { toast.success('Viaje actualizado'); setEditViaje(null); fetchViajes() }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-text-secondary">{filtered.length} de {viajes.length} registros</p>
        <Link href="/viajes/nuevo" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} />
          Nuevo Viaje
        </Link>
      </div>

      {/* Inline Filters */}
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
          <FilterGroup label="Desde">
            <input type="date" className="input text-xs" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          </FilterGroup>
          <FilterGroup label="Hasta">
            <input type="date" className="input text-xs" value={fTo} onChange={e => setFTo(e.target.value)} />
          </FilterGroup>
          <button className="btn-ghost text-xs self-end" onClick={clearFilters}>Limpiar</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {['Fecha','Matrícula','Chofer','Cliente','Origen','Destino','Mercadería','Km','Tons','Importe','Gasoil','Comisión','Peajes','Beneficio','Acciones'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-10 text-center text-text-secondary">Sin viajes registrados</td>
                </tr>
              ) : filtered.map(v => {
                const profit = (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0)
                return (
                  <tr key={v.id} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell font-mono whitespace-nowrap px-3">{v.fecha}</td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">{v.matricula}</span>
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.chofer_nombre ?? '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.cliente_nombre ?? '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.origen ?? '—'}</td>
                    <td className="table-cell px-3 whitespace-nowrap">{v.destino ?? '—'}</td>
                    <td className="table-cell px-3">{v.mercaderia ?? '—'}</td>
                    <td className="table-cell px-3 text-right font-mono">{fmt(v.km ?? 0)}</td>
                    <td className="table-cell px-3 text-right font-mono">{(v.toneladas ?? 0).toFixed(2)}</td>
                    <td className="table-cell px-3 text-right font-mono whitespace-nowrap">${fmt(v.importe ?? 0)}</td>
                    <td className="table-cell px-3 text-right font-mono text-danger whitespace-nowrap">${fmt(v.gasto_gasoil ?? 0)}</td>
                    <td className="table-cell px-3 text-right font-mono whitespace-nowrap">${fmt(v.comision ?? 0)}</td>
                    <td className="table-cell px-3 text-right font-mono whitespace-nowrap">${fmt(v.peajes ?? 0)}</td>
                    <td className={`table-cell px-3 text-right font-mono font-semibold whitespace-nowrap ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${fmt(profit)}
                    </td>
                    <td className="table-cell px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditViaje(v)}
                          className="p-1.5 rounded text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteId(v.id)}
                            className="p-1.5 rounded text-text-secondary hover:text-danger hover:bg-danger/10 transition-all"
                            title="Eliminar"
                          >
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
            onSubmit={handleEdit}
            submitLabel="Actualizar viaje"
            loading={editLoading}
          />
        )}
      </Modal>

      {/* Modal eliminar */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirmar eliminación"
        size="sm"
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
