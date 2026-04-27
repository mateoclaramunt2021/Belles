'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Tarifa, Cliente } from '@/types'

interface TarifaForm {
  cliente_id: string
  destino: string
  precio_por_tonelada: number
  vigente_desde: string
  activo: boolean
}

const defaultForm: TarifaForm = {
  cliente_id: '', destino: '', precio_por_tonelada: 0,
  vigente_desde: new Date().toISOString().split('T')[0], activo: true,
}

interface TarifaConCliente extends Tarifa {
  cliente: Cliente
}

export default function TarifasPage() {
  const supabase = createClient()
  const [tarifas, setTarifas] = useState<TarifaConCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<TarifaForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [t, c] = await Promise.all([
      supabase.from('tarifas').select('*, cliente:clientes(*)').order('activo', { ascending: false }).order('vigente_desde', { ascending: false }),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    ])
    setTarifas((t.data ?? []) as TarifaConCliente[])
    setClientes((c.data ?? []) as Cliente[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setForm(defaultForm)
    setEditId(null)
    setModalOpen(true)
  }

  const openEdit = (t: TarifaConCliente) => {
    setForm({
      cliente_id:          t.cliente_id,
      destino:             t.destino,
      precio_por_tonelada: t.precio_por_tonelada,
      vigente_desde:       t.vigente_desde,
      activo:              t.activo,
    })
    setEditId(t.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.cliente_id)         { toast.error('Seleccioná un cliente'); return }
    if (!form.destino.trim())     { toast.error('El destino es obligatorio'); return }
    if (form.precio_por_tonelada <= 0) { toast.error('El precio debe ser mayor a 0'); return }
    setSaving(true)

    const payload = {
      cliente_id:          form.cliente_id,
      destino:             form.destino,
      precio_por_tonelada: form.precio_por_tonelada,
      vigente_desde:       form.vigente_desde,
      activo:              form.activo,
    }

    const { error } = editId
      ? await supabase.from('tarifas').update(payload).eq('id', editId)
      : await supabase.from('tarifas').insert(payload)

    setSaving(false)
    if (error) toast.error('Error al guardar')
    else { toast.success(editId ? 'Tarifa actualizada' : 'Tarifa creada'); setModalOpen(false); fetchData() }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('tarifas').delete().eq('id', deleteId)
    if (error) toast.error('Error al eliminar')
    else { toast.success('Tarifa eliminada'); fetchData() }
    setDeleteId(null)
  }

  // Agrupar por cliente
  const clientesConTarifas = clientes.filter((c) => tarifas.some((t) => t.cliente_id === c.id))

  const columns: Column<TarifaConCliente>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (_v, row) => <span className="font-medium text-text-primary">{row.cliente?.nombre}</span>,
    },
    { key: 'destino', header: 'Destino', render: (v) => <span className="text-accent-cyan">{String(v)}</span> },
    {
      key: 'precio_por_tonelada',
      header: '$/tonelada',
      render: (v) => <span className="font-data text-sm font-bold text-success">${Number(v).toLocaleString('es-UY')}</span>,
    },
    { key: 'vigente_desde', header: 'Vigente desde', className: 'hidden md:table-cell', render: (v) => <span className="font-data text-xs text-text-secondary">{String(v)}</span> },
    { key: 'activo', header: 'Estado', render: (v) => <Badge variant={v ? 'success' : 'neutral'} dot>{v ? 'Activa' : 'Inactiva'}</Badge> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tarifas</h1>
          <p className="text-text-secondary text-sm mt-0.5">{tarifas.length} tarifas configuradas</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nueva tarifa
        </button>
      </div>

      {/* Vista agrupada por cliente */}
      {clientesConTarifas.map((cliente) => {
        const clienteTarifas = tarifas.filter((t) => t.cliente_id === cliente.id)
        return (
          <div key={cliente.id} className="card">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-text-primary">{cliente.nombre}</h2>
              <span className="text-xs text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded-full">
                {clienteTarifas.length} {clienteTarifas.length === 1 ? 'tarifa' : 'tarifas'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {clienteTarifas.map((t) => (
                <div key={t.id} className={`rounded-xl border p-4 relative group ${t.activo ? 'border-border-color bg-bg-tertiary' : 'border-border-color/40 bg-bg-primary opacity-60'}`}>
                  <p className="text-xs text-text-secondary mb-1">{t.destino}</p>
                  <p className="text-xl font-bold font-data text-success">
                    ${t.precio_por_tonelada.toLocaleString('es-UY')}
                    <span className="text-xs font-normal text-text-secondary ml-1">/ton</span>
                  </p>
                  <p className="text-xs text-text-secondary mt-1">desde {t.vigente_desde}</p>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(t)} className="p-1 rounded bg-bg-secondary text-text-secondary hover:text-accent-cyan">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setDeleteId(t.id)} className="p-1 rounded bg-bg-secondary text-text-secondary hover:text-danger">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Tabla completa */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color">
          <h2 className="text-base font-semibold text-text-primary">Todas las tarifas</h2>
        </div>
        <DataTable
          columns={columns}
          data={tarifas}
          keyField="id"
          loading={loading}
          emptyMessage="No hay tarifas configuradas"
          actions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all">
                <Pencil size={14} />
              </button>
              <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar tarifa' : 'Nueva tarifa'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear tarifa'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Cliente *</label>
            <select className="input" value={form.cliente_id} onChange={(e) => setForm((p) => ({ ...p, cliente_id: e.target.value }))}>
              <option value="">Seleccionar cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Destino *</label>
            <input type="text" className="input" placeholder="Ej: Tecomar, Durazno, La Punta" value={form.destino} onChange={(e) => setForm((p) => ({ ...p, destino: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Precio por tonelada ($ UYU) *</label>
            <input type="number" step="0.01" min="0" className="input font-mono" placeholder="0" value={form.precio_por_tonelada || ''} onChange={(e) => setForm((p) => ({ ...p, precio_por_tonelada: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label className="label">Vigente desde</label>
            <input type="date" className="input" value={form.vigente_desde} onChange={(e) => setForm((p) => ({ ...p, vigente_desde: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="activo_tarifa" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 accent-accent-cyan" />
            <label htmlFor="activo_tarifa" className="text-sm text-text-primary">Tarifa activa</label>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar tarifa" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar esta tarifa?</p>
      </Modal>
    </div>
  )
}
