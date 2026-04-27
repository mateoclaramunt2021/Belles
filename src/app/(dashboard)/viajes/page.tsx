'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EstadoCobro } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ViajeForm, defaultFormData } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Filter, X } from 'lucide-react'
import type { Viaje } from '@/types'

export default function ViajesPage() {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  const [viajes, setViajes] = useState<Viaje[]>([])
  const [loading, setLoading] = useState(true)
  const [editViaje, setEditViaje] = useState<Viaje | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filtros
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchViajes = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('viajes')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (!isAdmin && profile?.id) q = q.eq('chofer_id', profile.id)
    if (filtroFechaDesde) q = q.gte('fecha', filtroFechaDesde)
    if (filtroFechaHasta) q = q.lte('fecha', filtroFechaHasta)
    if (filtroMatricula)  q = q.ilike('matricula', `%${filtroMatricula}%`)
    if (filtroEstado)     q = q.eq('estado_cobro', filtroEstado)

    const { data } = await q
    setViajes((data as Viaje[]) ?? [])
    setLoading(false)
  }, [supabase, isAdmin, profile?.id, filtroFechaDesde, filtroFechaHasta, filtroMatricula, filtroEstado])

  useEffect(() => { fetchViajes() }, [fetchViajes])

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('viajes').delete().eq('id', deleteId)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Viaje eliminado')
      setDeleteId(null)
      fetchViajes()
    }
  }

  const handleEdit = async (data: typeof defaultFormData) => {
    if (!editViaje) return
    setEditLoading(true)
    const { error } = await supabase
      .from('viajes')
      .update({
        fecha:           data.fecha,
        numero_remito:   data.numero_remito,
        matricula:       data.matricula,
        camion_id:       data.camion_id || null,
        chofer_id:       data.chofer_id || null,
        chofer_nombre:   data.chofer_nombre,
        cliente_id:      data.cliente_id || null,
        cliente_nombre:  data.cliente_nombre,
        origen:          data.origen,
        destino:         data.destino,
        mercaderia:      data.mercaderia,
        km:              data.km,
        toneladas:       data.toneladas,
        tarifa_aplicada: data.tarifa_aplicada,
        importe:         data.importe,
        gasto_gasoil:    data.gasto_gasoil,
        litros_gasoil:   data.litros_gasoil,
        comision:        data.comision,
        peajes:          data.peajes,
        estado_cobro:    data.estado_cobro,
        notas:           data.notas || null,
      })
      .eq('id', editViaje.id)

    setEditLoading(false)
    if (error) {
      toast.error('Error al actualizar')
    } else {
      toast.success('Viaje actualizado')
      setEditViaje(null)
      fetchViajes()
    }
  }

  const clearFilters = () => {
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
    setFiltroMatricula('')
    setFiltroEstado('')
  }

  const activeFilters = [filtroFechaDesde, filtroFechaHasta, filtroMatricula, filtroEstado].filter(Boolean).length

  const columns: Column<Viaje>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (v) => <span className="font-data text-xs">{String(v)}</span>,
    },
    {
      key: 'numero_remito',
      header: 'Remito',
      render: (v) => <span className="font-data text-xs text-accent-cyan">{String(v)}</span>,
    },
    {
      key: 'matricula',
      header: 'Matrícula',
      render: (v) => <span className="font-data text-xs font-semibold">{String(v)}</span>,
    },
    ...(isAdmin ? [{
      key: 'chofer_nombre',
      header: 'Chofer',
      className: 'hidden md:table-cell',
      render: (v: unknown) => <span className="text-text-secondary">{String(v)}</span>,
    }] as Column<Viaje>[] : []),
    {
      key: 'destino',
      header: 'Destino',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'toneladas',
      header: 'Toneladas',
      className: 'hidden md:table-cell',
      render: (v) => <span className="font-data text-xs">{Number(v).toFixed(3)}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      render: (v) => (
        <span className="font-data text-xs font-semibold text-success">
          ${Number(v).toLocaleString('es-UY')}
        </span>
      ),
    },
    {
      key: 'estado_cobro',
      header: 'Estado',
      render: (v) => <EstadoCobro estado={v as 'pendiente' | 'cobrado'} />,
    },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{isAdmin ? 'Viajes' : 'Mis Viajes'}</h1>
          <p className="text-text-secondary text-sm mt-0.5">{viajes.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm relative ${showFilters ? 'border-accent-cyan/50 text-accent-cyan' : ''}`}
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent-cyan text-bg-primary text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </button>
          <Link href="/viajes/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} />
            <span className="hidden sm:inline">Nuevo</span>
          </Link>
        </div>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-text-primary">Filtros</p>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="text-xs text-text-secondary hover:text-danger flex items-center gap-1">
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="form-group">
              <label className="label">Desde</label>
              <input type="date" className="input text-sm" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Hasta</label>
              <input type="date" className="input text-sm" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Matrícula</label>
              <input type="text" className="input text-sm font-mono" placeholder="FTP..." value={filtroMatricula} onChange={(e) => setFiltroMatricula(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Estado cobro</label>
              <select className="input text-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="cobrado">Cobrado</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={viajes}
          keyField="id"
          loading={loading}
          searchable
          searchPlaceholder="Buscar por remito, matrícula, destino..."
          searchFields={['numero_remito', 'matricula', 'destino', 'chofer_nombre', 'cliente_nombre']}
          emptyMessage="No hay viajes registrados"
          actions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setEditViaje(row)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setDeleteId(row.id)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* Modal editar */}
      <Modal
        open={!!editViaje}
        onClose={() => setEditViaje(null)}
        title="Editar viaje"
        size="xl"
      >
        {editViaje && (
          <ViajeForm
            initialData={editViaje as unknown as Record<string, unknown>}
            onSubmit={handleEdit}
            submitLabel="Actualizar viaje"
            loading={editLoading}
          />
        )}
      </Modal>

      {/* Modal confirmar eliminación */}
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
        <p className="text-text-secondary text-sm">
          ¿Estás seguro de que querés eliminar este viaje? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
