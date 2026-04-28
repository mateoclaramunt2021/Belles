'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Building2, Phone, MapPin, Hash } from 'lucide-react'
import type { Cliente } from '@/types'

interface ClienteForm {
  nombre: string; rut: string; contacto: string
  direccion: string; email: string; ciudad: string; activo: boolean
}
const defaultForm: ClienteForm = { nombre: '', rut: '', contacto: '', direccion: '', email: '', ciudad: '', activo: true }

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ClienteForm>(defaultForm)
  const [search, setSearch] = useState('')

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  // Estadísticas de viajes por cliente
  const [stats, setStats] = useState<Record<string, { viajes: number; importe: number }>>({})
  useEffect(() => {
    const loadStats = async () => {
      const { data } = await supabase.from('viajes').select('cliente_id,importe')
      const m: Record<string, { viajes: number; importe: number }> = {}
      ;(data ?? []).forEach((v: any) => {
        if (!v.cliente_id) return
        if (!m[v.cliente_id]) m[v.cliente_id] = { viajes: 0, importe: 0 }
        m[v.cliente_id].viajes++
        m[v.cliente_id].importe += v.importe ?? 0
      })
      setStats(m)
    }
    loadStats()
  }, [supabase, clientes])

  const filtered = useMemo(() =>
    clientes.filter(c =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.rut ?? '').includes(search) ||
      (c.ciudad ?? '').toLowerCase().includes(search.toLowerCase())
    ), [clientes, search])

  const openCreate = () => { setForm(defaultForm); setEditId(null); setModalOpen(true) }
  const openEdit = (c: Cliente) => {
    setForm({ nombre: c.nombre, rut: c.rut ?? '', contacto: c.contacto ?? '', direccion: c.direccion ?? '', email: c.email ?? '', ciudad: c.ciudad ?? '', activo: c.activo })
    setEditId(c.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const payload = { nombre: form.nombre.trim(), rut: form.rut || null, contacto: form.contacto || null, direccion: form.direccion || null, email: form.email || null, ciudad: form.ciudad || null, activo: form.activo }
    const { error } = editId
      ? await supabase.from('clientes').update(payload).eq('id', editId)
      : await supabase.from('clientes').insert(payload)
    setSaving(false)
    if (error) toast.error('Error al guardar')
    else { toast.success(editId ? 'Cliente actualizado' : 'Cliente creado'); setModalOpen(false); fetchClientes() }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('clientes').delete().eq('id', deleteId)
    if (error) toast.error('No se puede eliminar (tiene viajes asociados)')
    else { toast.success('Cliente eliminado'); fetchClientes() }
    setDeleteId(null)
  }

  const fmt = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-secondary text-sm">{clientes.filter(c => c.activo).length} clientes activos</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" placeholder="Buscar cliente..." className="input text-xs w-48"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* Grid de clientes */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const s = stats[c.id] ?? { viajes: 0, importe: 0 }
            return (
              <div key={c.id} className={`card relative group ${!c.activo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-accent-cyan" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{c.nombre}</p>
                      {!c.activo && <span className="text-[10px] text-danger">Inactivo</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-text-secondary mb-3">
                  {c.rut && (
                    <div className="flex items-center gap-1.5">
                      <Hash size={11} className="flex-shrink-0" />
                      <span className="font-mono">{c.rut}</span>
                    </div>
                  )}
                  {c.contacto && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={11} className="flex-shrink-0" />
                      <span>{c.contacto}</span>
                    </div>
                  )}
                  {(c.ciudad || c.direccion) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="flex-shrink-0" />
                      <span>{[c.ciudad, c.direccion].filter(Boolean).join(' · ')}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-3 border-t border-border-color">
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-text-secondary uppercase tracking-wide">Viajes</p>
                    <p className="font-mono font-bold text-text-primary text-sm">{s.viajes}</p>
                  </div>
                  <div className="flex-1 text-center border-l border-border-color">
                    <p className="text-[10px] text-text-secondary uppercase tracking-wide">Ingresos</p>
                    <p className="font-mono font-bold text-success text-sm">${fmt(s.importe)}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-text-secondary">
              {search ? 'Sin resultados para la búsqueda' : 'No hay clientes registrados'}
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar cliente' : 'Nuevo cliente'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear cliente'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="label">Nombre *</label>
              <input type="text" className="input" placeholder="Ej: Urufor S.A." value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">RUT</label>
              <input type="text" className="input font-mono" placeholder="21 244598 0016" value={form.rut} onChange={e => setForm(p => ({ ...p, rut: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Ciudad</label>
              <input type="text" className="input" placeholder="Montevideo, Rivera..." value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Teléfono / Contacto</label>
              <input type="text" className="input" placeholder="098 000 000" value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="contacto@empresa.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group col-span-2">
              <label className="label">Dirección</label>
              <input type="text" className="input" placeholder="Ruta 5 Km 495" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <input type="checkbox" id="activo_cli" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 accent-accent-cyan" />
              <label htmlFor="activo_cli" className="text-sm text-text-primary">Cliente activo</label>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar cliente" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar este cliente? Si tiene viajes asociados no se podrá eliminar.</p>
      </Modal>
    </div>
  )
}
