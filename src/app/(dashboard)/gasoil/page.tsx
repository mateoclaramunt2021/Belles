'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { GasoilChart } from '@/components/ui/Chart'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Fuel, TrendingDown, Gauge } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface GasoilRegistro {
  id:         string
  fecha:      string
  matricula:  string
  litros:     number
  precio_litro: number
  total:      number
  kilometros?: number
  created_at: string
}

interface GasoilForm {
  fecha:        string
  matricula:    string
  litros:       number
  precio_litro: number
  kilometros:   number
}

const defaultForm: GasoilForm = {
  fecha:        new Date().toISOString().split('T')[0],
  matricula:    '',
  litros:       0,
  precio_litro: 0,
  kilometros:   0,
}

interface GasoilMensual {
  mes:    string
  litros: number
  gasto:  number
}

export default function GasoilPage() {
  const supabase = createClient()
  const [registros, setRegistros] = useState<GasoilRegistro[]>([])
  const [mensual, setMensual]     = useState<GasoilMensual[]>([])
  const [camiones, setCamiones]   = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [form, setForm]           = useState<GasoilForm>(defaultForm)
  const [saving, setSaving]       = useState(false)
  const [filtroMat, setFiltroMat] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Gasoil viene de viajes.gasto_gasoil en la tabla viajes
    // Para un registro independiente necesitaríamos tabla gasoil_registros
    // Acá vamos a usar los datos de viajes que tienen gasto_gasoil > 0
    const { data: viajesData } = await supabase
      .from('viajes')
      .select('id, fecha, matricula, gasto_gasoil, kilometros')
      .gt('gasto_gasoil', 0)
      .order('fecha', { ascending: false })

    const viajes = viajesData ?? []

    // Transformar viajes con gasoil en "registros" para visualizar
    // También intentamos cargar tabla gasoil_registros si existe
    const { data: gasData } = await supabase
      .from('gasoil_registros' as any)
      .select('*')
      .order('fecha', { ascending: false })

    let regs: GasoilRegistro[] = []
    if (gasData && Array.isArray(gasData) && gasData.length > 0) {
      regs = gasData as GasoilRegistro[]
    } else {
      // Fallback: construir desde viajes
      regs = viajes.map((v: any) => ({
        id:           v.id,
        fecha:        v.fecha,
        matricula:    v.matricula,
        litros:       0, // no tenemos litros granulares en viajes
        precio_litro: 0,
        total:        v.gasto_gasoil ?? 0,
        kilometros:   v.kilometros,
        created_at:   v.fecha,
      }))
    }

    // KPIs mensuales agrupados
    const mapa: Record<string, { litros: number; gasto: number }> = {}
    regs.forEach((r) => {
      const mes = r.fecha.substring(0, 7)
      if (!mapa[mes]) mapa[mes] = { litros: 0, gasto: 0 }
      mapa[mes].litros += r.litros
      mapa[mes].gasto  += r.total
    })

    const mensualArr: GasoilMensual[] = Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, v]) => ({ mes, ...v }))

    const matriculas = [...new Set(regs.map((r) => r.matricula).filter(Boolean))]

    setRegistros(regs)
    setMensual(mensualArr)
    setCamiones(matriculas)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const totalGasto  = registros.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalLitros = registros.reduce((s, r) => s + (r.litros ?? 0), 0)
  const precioPromedio = totalLitros > 0 ? totalGasto / totalLitros : 0

  const openCreate = () => { setForm(defaultForm); setEditId(null); setModalOpen(true) }
  const openEdit   = (r: GasoilRegistro) => {
    setForm({ fecha: r.fecha, matricula: r.matricula, litros: r.litros, precio_litro: r.precio_litro, kilometros: r.kilometros ?? 0 })
    setEditId(r.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.matricula) { toast.error('Ingresá la matrícula'); return }
    if (form.litros <= 0) { toast.error('Los litros deben ser mayores a 0'); return }
    setSaving(true)

    const payload = {
      fecha:        form.fecha,
      matricula:    form.matricula,
      litros:       form.litros,
      precio_litro: form.precio_litro,
      total:        form.litros * form.precio_litro,
      kilometros:   form.kilometros || null,
    }

    const { error } = editId
      ? await supabase.from('gasoil_registros' as any).update(payload).eq('id', editId)
      : await supabase.from('gasoil_registros' as any).insert(payload)

    setSaving(false)
    if (error) {
      toast.error('Para registrar gasoil individualmente, ejecutá el schema SQL de gasoil_registros primero.')
    } else {
      toast.success(editId ? 'Registro actualizado' : 'Registro creado')
      setModalOpen(false)
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await supabase.from('gasoil_registros' as any).delete().eq('id', deleteId)
    toast.success('Registro eliminado')
    setDeleteId(null)
    fetchData()
  }

  const filtrados = filtroMat ? registros.filter((r) => r.matricula === filtroMat) : registros

  const columns: Column<GasoilRegistro>[] = [
    { key: 'fecha', header: 'Fecha', render: (v) => <span className="font-data text-xs">{String(v)}</span> },
    { key: 'matricula', header: 'Matrícula', render: (v) => <span className="font-data text-sm text-accent-cyan font-medium">{String(v)}</span> },
    { key: 'litros', header: 'Litros', render: (v) => <span className="font-data text-sm">{Number(v).toLocaleString('es-UY', { maximumFractionDigits: 1 })} L</span> },
    { key: 'precio_litro', header: '$/L', className: 'hidden md:table-cell', render: (v) => <span className="font-data text-xs text-text-secondary">${Number(v).toLocaleString('es-UY')}</span> },
    { key: 'total', header: 'Total', render: (v) => <span className="font-data text-sm font-bold text-warning">${Number(v).toLocaleString('es-UY')}</span> },
    { key: 'kilometros', header: 'KM', className: 'hidden lg:table-cell', render: (v) => v ? <span className="font-data text-xs text-text-secondary">{Number(v).toLocaleString('es-UY')}</span> : <span className="text-text-secondary/40">—</span> },
  ]

  // Chart data format: { name, litros, gasto }
  const chartData = mensual.map((m) => ({ mes: m.mes.substring(5), litros: m.litros, gasto: m.gasto }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gasoil</h1>
          <p className="text-text-secondary text-sm mt-0.5">Control de consumo y gastos de combustible</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Registrar carga
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Gasto total" value={totalGasto} icon={Fuel} color="orange" isMoney />
        <KPICard title="Litros totales" value={totalLitros} icon={TrendingDown} color="cyan" subtitle="litros cargados" />
        <KPICard title="Precio promedio" value={precioPromedio} icon={Gauge} color="purple" isMoney subtitle="por litro" />
      </div>

      {/* Gráfico mensual */}
      <div className="card">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Consumo mensual</h2>
        <GasoilChart data={chartData} />
      </div>

      {/* Por camión */}
      {camiones.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Gasto por camión</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {camiones.map((mat) => {
              const regsC   = registros.filter((r) => r.matricula === mat)
              const gastoC  = regsC.reduce((s, r) => s + (r.total ?? 0), 0)
              const litrosC = regsC.reduce((s, r) => s + (r.litros ?? 0), 0)
              return (
                <div key={mat} className="bg-bg-primary rounded-xl p-3 border border-border-color text-center">
                  <p className="font-data font-bold text-accent-cyan text-sm">{mat}</p>
                  <p className="font-bold text-warning font-data mt-1">${gastoC.toLocaleString('es-UY')}</p>
                  {litrosC > 0 && <p className="text-xs text-text-secondary">{litrosC.toFixed(0)} L</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtro + Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary">Registros</h2>
          {camiones.length > 0 && (
            <select className="input w-auto text-sm" value={filtroMat} onChange={(e) => setFiltroMat(e.target.value)}>
              <option value="">Todos los camiones</option>
              {camiones.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
        <DataTable
          columns={columns}
          data={filtrados}
          keyField="id"
          loading={loading}
          emptyMessage="No hay registros de gasoil"
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar carga de gasoil' : 'Registrar carga de gasoil'}
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
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Matrícula *</label>
            <select className="input" value={form.matricula} onChange={(e) => setForm((p) => ({ ...p, matricula: e.target.value }))}>
              <option value="">Seleccionar camión</option>
              {camiones.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Litros *</label>
              <input type="number" step="0.1" min="0" className="input font-mono" placeholder="0" value={form.litros || ''} onChange={(e) => setForm((p) => ({ ...p, litros: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label className="label">Precio por litro</label>
              <input type="number" step="0.01" min="0" className="input font-mono" placeholder="0" value={form.precio_litro || ''} onChange={(e) => setForm((p) => ({ ...p, precio_litro: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          {form.litros > 0 && form.precio_litro > 0 && (
            <div className="bg-bg-primary rounded-xl p-3 text-center border border-border-color">
              <p className="text-xs text-text-secondary">Total</p>
              <p className="font-data font-bold text-warning text-lg">${(form.litros * form.precio_litro).toLocaleString('es-UY')}</p>
            </div>
          )}
          <div className="form-group">
            <label className="label">Kilometraje (opcional)</label>
            <input type="number" className="input font-mono" placeholder="KM actuales" value={form.kilometros || ''} onChange={(e) => setForm((p) => ({ ...p, kilometros: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar registro" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button>
          </>
        }
      >
        <p className="text-text-secondary text-sm">¿Eliminar este registro de gasoil?</p>
      </Modal>
    </div>
  )
}
