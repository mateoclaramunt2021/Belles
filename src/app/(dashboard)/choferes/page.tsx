'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, User } from 'lucide-react'
import type { ChoferDetalle, Camion } from '@/types'

interface ChoferForm {
  email: string
  nombre_completo: string
  telefono: string
  licencia: string
  camion_asignado_id: string
  activo: boolean
}

const defaultForm: ChoferForm = {
  email: '', nombre_completo: '', telefono: '', licencia: '',
  camion_asignado_id: '', activo: true,
}

interface ChoferConStats extends ChoferDetalle {
  viajes_count: number
  ingresos_total: number
  promedio_por_viaje: number
}

export default function ChoferesPage() {
  const supabase = createClient()
  const [choferes, setChoferes] = useState<ChoferConStats[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ChoferForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [cd, cam, viajes] = await Promise.all([
      supabase.from('choferes_detalle').select('*, usuario:usuarios(id, email, nombre, rol, activo), camion:camiones(matricula)').order('nombre_completo'),
      supabase.from('camiones').select('id, matricula').eq('estado', 'activo'),
      supabase.from('viajes').select('chofer_id, importe'),
    ])

    const viajesMap: Record<string, { count: number; ingresos: number }> = {}
    for (const v of (viajes.data ?? [])) {
      if (!v.chofer_id) continue
      if (!viajesMap[v.chofer_id]) viajesMap[v.chofer_id] = { count: 0, ingresos: 0 }
      viajesMap[v.chofer_id].count   += 1
      viajesMap[v.chofer_id].ingresos += v.importe ?? 0
    }

    const withStats = ((cd.data ?? []) as ChoferDetalle[]).map((c) => {
      const s = viajesMap[c.usuario_id] ?? { count: 0, ingresos: 0 }
      return {
        ...c,
        viajes_count:        s.count,
        ingresos_total:      s.ingresos,
        promedio_por_viaje:  s.count > 0 ? s.ingresos / s.count : 0,
      }
    })

    setChoferes(withStats as ChoferConStats[])
    setCamiones((cam.data ?? []) as Camion[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const openEdit = (c: ChoferConStats) => {
    setForm({
      email:              (c.usuario as { email: string })?.email ?? '',
      nombre_completo:    c.nombre_completo,
      telefono:           c.telefono,
      licencia:           c.licencia,
      camion_asignado_id: c.camion_asignado_id ?? '',
      activo:             c.activo,
    })
    setEditId(c.id)
    setModalOpen(true)
  }

  const openCreate = () => {
    setForm(defaultForm)
    setEditId(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre_completo.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)

    const payload = {
      nombre_completo:    form.nombre_completo,
      telefono:           form.telefono,
      licencia:           form.licencia,
      camion_asignado_id: form.camion_asignado_id || null,
      activo:             form.activo,
    }

    if (editId) {
      const { error } = await supabase.from('choferes_detalle').update(payload).eq('id', editId)
      if (error) toast.error('Error al actualizar')
      else { toast.success('Chofer actualizado'); setModalOpen(false); fetchData() }
    } else {
      // Para crear un chofer nuevo hay que crearlo primero en Auth
      // Aquí simplemente mostramos instrucciones
      toast.error('Para agregar choferes, créalos primero en el panel de Supabase Auth, luego aparecen automáticamente aquí.')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('choferes_detalle').delete().eq('id', deleteId)
    if (error) toast.error('Error al eliminar')
    else { toast.success('Chofer eliminado'); fetchData() }
    setDeleteId(null)
  }

  const columns: Column<ChoferConStats>[] = [
    {
      key: 'nombre_completo',
      header: 'Nombre',
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-accent-purple">{String(v).charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-medium text-text-primary text-sm">{String(v)}</p>
            <p className="text-xs text-text-secondary">{(row.usuario as { email: string })?.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'telefono', header: 'Teléfono', className: 'hidden md:table-cell', render: (v) => <span className="font-data text-xs">{String(v) || '—'}</span> },
    {
      key: 'camion_asignado_id',
      header: 'Camión',
      render: (_v, row) => {
        const cam = row.camion as { matricula: string } | null
        return cam ? <span className="font-data text-xs text-accent-cyan">{cam.matricula}</span> : <span className="text-text-secondary text-xs">Sin asignar</span>
      },
    },
    { key: 'viajes_count', header: 'Viajes', render: (v) => <span className="font-data text-xs">{Number(v)}</span> },
    { key: 'ingresos_total', header: 'Ingresos', className: 'hidden lg:table-cell', render: (v) => <span className="font-data text-xs text-success">${Number(v).toLocaleString('es-UY')}</span> },
    { key: 'promedio_por_viaje', header: 'Prom/viaje', className: 'hidden xl:table-cell', render: (v) => <span className="font-data text-xs text-accent-cyan">${Number(v).toFixed(0)}</span> },
    {
      key: 'activo',
      header: 'Estado',
      render: (v) => <Badge variant={v ? 'success' : 'danger'} dot>{v ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Choferes</h1>
          <p className="text-text-secondary text-sm mt-0.5">{choferes.length} choferes registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} />
          <span className="hidden sm:inline">Agregar chofer</span>
        </button>
      </div>

      {/* Info */}
      <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl p-4 flex items-start gap-3">
        <User size={18} className="text-accent-cyan flex-shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary">
          <span className="text-text-primary font-medium">Para agregar un chofer:</span> Creá el usuario en{' '}
          <span className="text-accent-cyan">Supabase Dashboard → Authentication → Users</span>, ingresá el email y contraseña, y el chofer aparecerá automáticamente aquí.
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={choferes}
          keyField="id"
          loading={loading}
          searchable
          searchPlaceholder="Buscar chofer..."
          searchFields={['nombre_completo']}
          emptyMessage="No hay choferes registrados"
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

      {/* Modal editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar chofer' : 'Nuevo chofer'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre completo *</label>
            <input type="text" className="input" placeholder="Juan Pérez" value={form.nombre_completo} onChange={(e) => setForm((p) => ({ ...p, nombre_completo: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Teléfono</label>
            <input type="tel" className="input font-mono" placeholder="+598 99 123 456" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Licencia</label>
            <input type="text" className="input font-mono" placeholder="Número de licencia" value={form.licencia} onChange={(e) => setForm((p) => ({ ...p, licencia: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Camión asignado</label>
            <select className="input" value={form.camion_asignado_id} onChange={(e) => setForm((p) => ({ ...p, camion_asignado_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {camiones.map((c) => <option key={c.id} value={c.id}>{c.matricula}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="activo" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 accent-accent-cyan" />
            <label htmlFor="activo" className="text-sm text-text-primary">Chofer activo</label>
          </div>
        </div>
      </Modal>

      {/* Eliminar */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar chofer" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar este chofer? Sus viajes no se borrarán.</p>
      </Modal>
    </div>
  )
}
