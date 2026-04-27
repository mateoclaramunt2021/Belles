'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EstadoCamion } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { KPICard } from '@/components/ui/KPICard'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Truck } from 'lucide-react'
import type { Camion, Usuario } from '@/types'

interface CamionForm {
  matricula: string
  remolque: string
  estado: 'activo' | 'taller' | 'inactivo'
  chofer_asignado_id: string
  km_actual: number
  notas: string
}

const defaultForm: CamionForm = {
  matricula: '', remolque: '', estado: 'activo',
  chofer_asignado_id: '', km_actual: 0, notas: '',
}

interface CamionStats {
  id: string
  viajes: number
  ingresos: number
  gasoil: number
}

export default function CamionesPage() {
  const supabase = createClient()
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [choferes, setChoferes] = useState<Usuario[]>([])
  const [stats, setStats] = useState<CamionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<CamionForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [c, ch, v] = await Promise.all([
      supabase.from('camiones').select('*').order('matricula'),
      supabase.from('usuarios').select('id, nombre').eq('activo', true).eq('rol', 'chofer'),
      supabase.from('viajes').select('camion_id, importe, gasto_gasoil'),
    ])
    setCamiones((c.data ?? []) as Camion[])
    setChoferes((ch.data ?? []) as Usuario[])

    // Calcular stats por camión
    const statsMap: Record<string, CamionStats> = {}
    for (const row of (v.data ?? [])) {
      if (!row.camion_id) continue
      if (!statsMap[row.camion_id]) statsMap[row.camion_id] = { id: row.camion_id, viajes: 0, ingresos: 0, gasoil: 0 }
      statsMap[row.camion_id].viajes   += 1
      statsMap[row.camion_id].ingresos += row.importe ?? 0
      statsMap[row.camion_id].gasoil   += row.gasto_gasoil ?? 0
    }
    setStats(Object.values(statsMap))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setForm(defaultForm)
    setEditId(null)
    setModalOpen(true)
  }

  const openEdit = (c: Camion) => {
    setForm({
      matricula:          c.matricula,
      remolque:           c.remolque ?? '',
      estado:             c.estado,
      chofer_asignado_id: c.chofer_asignado_id ?? '',
      km_actual:          c.km_actual,
      notas:              c.notas ?? '',
    })
    setEditId(c.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.matricula.trim()) { toast.error('La matrícula es obligatoria'); return }
    setSaving(true)
    const payload = {
      matricula:          form.matricula.toUpperCase(),
      remolque:           form.remolque || null,
      estado:             form.estado,
      chofer_asignado_id: form.chofer_asignado_id || null,
      km_actual:          form.km_actual,
      notas:              form.notas || null,
    }

    const { error } = editId
      ? await supabase.from('camiones').update(payload).eq('id', editId)
      : await supabase.from('camiones').insert(payload)

    setSaving(false)
    if (error) {
      toast.error(error.message.includes('unique') ? 'Esa matrícula ya existe' : 'Error al guardar')
    } else {
      toast.success(editId ? 'Camión actualizado' : 'Camión agregado')
      setModalOpen(false)
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('camiones').delete().eq('id', deleteId)
    if (error) toast.error('Error al eliminar')
    else { toast.success('Camión eliminado'); fetchData() }
    setDeleteId(null)
  }

  // KPIs totales
  const totalViajes   = stats.reduce((s, c) => s + c.viajes,   0)
  const totalIngresos = stats.reduce((s, c) => s + c.ingresos, 0)
  const totalGasoil   = stats.reduce((s, c) => s + c.gasoil,   0)

  const getStats = (id: string) => stats.find((s) => s.id === id) ?? { viajes: 0, ingresos: 0, gasoil: 0, id }

  const columns: Column<Camion>[] = [
    { key: 'matricula', header: 'Matrícula', render: (v) => <span className="font-data font-bold text-accent-cyan">{String(v)}</span> },
    { key: 'remolque', header: 'Remolque', render: (v) => <span className="font-data text-xs text-text-secondary">{v ? String(v) : '—'}</span> },
    { key: 'estado', header: 'Estado', render: (v) => <EstadoCamion estado={v as 'activo' | 'taller' | 'inactivo'} /> },
    { key: 'km_actual', header: 'KM actual', className: 'hidden md:table-cell', render: (v) => <span className="font-data text-xs">{Number(v).toLocaleString('es-UY')}</span> },
    {
      key: 'id',
      header: 'Viajes',
      className: 'hidden lg:table-cell',
      render: (_v, row) => <span className="font-data text-xs">{getStats(row.id).viajes}</span>,
    },
    {
      key: 'id',
      header: 'Ingresos',
      className: 'hidden lg:table-cell',
      render: (_v, row) => <span className="font-data text-xs text-success">${getStats(row.id).ingresos.toLocaleString('es-UY')}</span>,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Camiones</h1>
          <p className="text-text-secondary text-sm mt-0.5">{camiones.length} camiones en la flota</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Agregar camión
        </button>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard title="Total viajes" value={totalViajes} icon={Truck} color="cyan" />
        <KPICard title="Ingresos totales" value={totalIngresos} icon={Truck} color="green" isMoney />
        <KPICard title="Gasto gasoil" value={totalGasoil} icon={Truck} color="orange" isMoney />
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={camiones}
          keyField="id"
          loading={loading}
          searchable
          searchPlaceholder="Buscar por matrícula..."
          searchFields={['matricula']}
          emptyMessage="No hay camiones registrados"
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

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar camión' : 'Nuevo camión'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Matrícula *</label>
            <input type="text" className="input font-mono uppercase" placeholder="FTP0000" value={form.matricula} onChange={(e) => setForm((p) => ({ ...p, matricula: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Remolque</label>
            <input type="text" className="input font-mono" placeholder="Matrícula del remolque" value={form.remolque} onChange={(e) => setForm((p) => ({ ...p, remolque: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as 'activo' | 'taller' | 'inactivo' }))}>
              <option value="activo">Activo</option>
              <option value="taller">En taller</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Chofer asignado</label>
            <select className="input" value={form.chofer_asignado_id} onChange={(e) => setForm((p) => ({ ...p, chofer_asignado_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">KM actual</label>
            <input type="number" className="input font-mono" min="0" value={form.km_actual} onChange={(e) => setForm((p) => ({ ...p, km_actual: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} placeholder="Observaciones..." value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        title="Eliminar camión" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar este camión? Los viajes asociados no se borrarán.</p>
      </Modal>
    </div>
  )
}
