'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Truck, AlertTriangle } from 'lucide-react'
import type { Camion, Zorra, Usuario } from '@/types'

const tooltipStyle = {
  contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9a9bb0' }, itemStyle: { color: '#e8e9f0' },
}

interface Row { matricula: string; importe: number; gasto_gasoil: number; litros_gasoil: number; comision: number; peajes: number; imprevistos: number; count: number }

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }
function fmtM(n: number) { if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(0)+'K'; return n.toFixed(0) }

interface CamionForm { matricula: string; remolque: string; estado: 'activo'|'taller'|'inactivo'; chofer_asignado_id: string; km_actual: number; km_mantenimiento: number; marca: string; modelo: string; anio: string; notas: string }
const defaultCamionForm: CamionForm = { matricula: '', remolque: '', estado: 'activo', chofer_asignado_id: '', km_actual: 0, km_mantenimiento: 0, marca: '', modelo: '', anio: '', notas: '' }

interface ZorraForm { matricula: string; estado: 'activo'|'taller'|'inactivo'; notas: string }
const defaultZorraForm: ZorraForm = { matricula: '', estado: 'activo', notas: '' }

const ESTADO_COLORS = { activo: 'text-success bg-success/10 border-success/20', taller: 'text-warning bg-warning/10 border-warning/20', inactivo: 'text-danger bg-danger/10 border-danger/20' }

export default function CamionesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [zorras, setZorras] = useState<Zorra[]>([])
  const [choferes, setChoferes] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'analytics'|'camiones'|'zorras'>('analytics')

  const [modalCamion, setModalCamion] = useState(false)
  const [modalZorra, setModalZorra] = useState(false)
  const [editCamionId, setEditCamionId] = useState<string|null>(null)
  const [editZorraId, setEditZorraId] = useState<string|null>(null)
  const [formCamion, setFormCamion] = useState<CamionForm>(defaultCamionForm)
  const [formZorra, setFormZorra] = useState<ZorraForm>(defaultZorraForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{id:string;tipo:'camion'|'zorra'}|null>(null)

  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: c }, { data: z }, { data: ch }] = await Promise.all([
      supabase.from('viajes').select('matricula,importe,gasto_gasoil,litros_gasoil,comision,peajes,imprevistos,fecha,fecha_carga'),
      supabase.from('camiones').select('*').order('matricula'),
      supabase.from('zorras').select('*').order('matricula'),
      supabase.from('usuarios').select('id,nombre').eq('rol','chofer').eq('activo',true).order('nombre'),
    ])
    const filtered = (v ?? []).filter((viaje: any) => {
      const f = viaje.fecha_carga || viaje.fecha
      if (fFrom && f < fFrom) return false
      if (fTo && f > fTo) return false
      return true
    })
    const m: Record<string,Row> = {}
    filtered.forEach((viaje: any) => {
      const k = viaje.matricula || 'Sin matrícula'
      if (!m[k]) m[k] = { matricula: k, importe: 0, gasto_gasoil: 0, litros_gasoil: 0, comision: 0, peajes: 0, imprevistos: 0, count: 0 }
      m[k].importe      += viaje.importe ?? 0
      m[k].gasto_gasoil += viaje.gasto_gasoil ?? 0
      m[k].litros_gasoil += viaje.litros_gasoil ?? 0
      m[k].comision     += viaje.comision ?? 0
      m[k].peajes       += viaje.peajes ?? 0
      m[k].imprevistos  += viaje.imprevistos ?? 0
      m[k].count++
    })
    setRows(Object.values(m).sort((a,b) => b.importe - a.importe))
    setCamiones(c ?? [])
    setZorras(z ?? [])
    setChoferes((ch ?? []) as unknown as Usuario[])
    setLoading(false)
  }, [supabase, fFrom, fTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  const topViajes = rows.reduce((b,r) => r.count > (b?.count??-1) ? r : b, rows[0])
  const topInc    = rows.reduce((b,r) => r.importe > (b?.importe??-1) ? r : b, rows[0])
  const topGas    = rows.reduce((b,r) => r.litros_gasoil > (b?.litros_gasoil??-1) ? r : b, rows[0])

  const openCreateCamion = () => { setFormCamion(defaultCamionForm); setEditCamionId(null); setModalCamion(true) }
  const openEditCamion = (c: Camion) => {
    setFormCamion({ matricula: c.matricula, remolque: c.remolque??'', estado: c.estado, chofer_asignado_id: c.chofer_asignado_id??'', km_actual: c.km_actual, km_mantenimiento: c.km_mantenimiento??0, marca: c.marca??'', modelo: c.modelo??'', anio: c.anio ? String(c.anio) : '', notas: c.notas??'' })
    setEditCamionId(c.id); setModalCamion(true)
  }

  const handleSaveCamion = async () => {
    if (!formCamion.matricula.trim()) { toast.error('La matrícula es obligatoria'); return }
    setSaving(true)
    const payload = { matricula: formCamion.matricula.trim().toUpperCase(), remolque: formCamion.remolque||null, estado: formCamion.estado, chofer_asignado_id: formCamion.chofer_asignado_id||null, km_actual: formCamion.km_actual, km_mantenimiento: formCamion.km_mantenimiento, marca: formCamion.marca||null, modelo: formCamion.modelo||null, anio: formCamion.anio ? parseInt(formCamion.anio) : null, notas: formCamion.notas||null }
    const { error } = editCamionId
      ? await supabase.from('camiones').update(payload).eq('id', editCamionId)
      : await supabase.from('camiones').insert(payload)
    setSaving(false)
    if (error) toast.error('Error: ' + error.message)
    else { toast.success(editCamionId ? 'Camión actualizado' : 'Camión agregado'); setModalCamion(false); fetchAll() }
  }

  const openCreateZorra = () => { setFormZorra(defaultZorraForm); setEditZorraId(null); setModalZorra(true) }
  const openEditZorra = (z: Zorra) => {
    setFormZorra({ matricula: z.matricula, estado: z.estado, notas: z.notas??'' })
    setEditZorraId(z.id); setModalZorra(true)
  }

  const handleSaveZorra = async () => {
    if (!formZorra.matricula.trim()) { toast.error('La matrícula es obligatoria'); return }
    setSaving(true)
    const { error } = editZorraId
      ? await supabase.from('zorras').update({ ...formZorra, matricula: formZorra.matricula.toUpperCase() }).eq('id', editZorraId)
      : await supabase.from('zorras').insert({ ...formZorra, matricula: formZorra.matricula.toUpperCase() })
    setSaving(false)
    if (error) toast.error('Error: ' + error.message)
    else { toast.success(editZorraId ? 'Zorra actualizada' : 'Zorra agregada'); setModalZorra(false); fetchAll() }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = deleteTarget.tipo === 'camion'
      ? await supabase.from('camiones').delete().eq('id', deleteTarget.id)
      : await supabase.from('zorras').delete().eq('id', deleteTarget.id)
    if (error) toast.error('No se puede eliminar')
    else { toast.success('Eliminado'); fetchAll() }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary border border-border-color rounded-xl p-1">
        {[
          { id: 'analytics', label: 'Rendimiento' },
          { id: 'camiones',  label: 'Gestión Camiones' },
          { id: 'zorras',    label: 'Gestión Zorras' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-accent-cyan text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: ANALYTICS */}
      {tab === 'analytics' && (
        <>
          {/* Filtro de fechas */}
          <div className="card">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary uppercase tracking-wide">Desde</label>
                <input type="date" className="input text-xs" value={fFrom} onChange={e => setFFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary uppercase tracking-wide">Hasta</label>
                <input type="date" className="input text-xs" value={fTo} onChange={e => setFTo(e.target.value)} />
              </div>
              <button className="btn-ghost text-xs self-end" onClick={() => { setFFrom(''); setFTo('') }}>Todo</button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Camiones', value: String(rows.length), color: 'linear-gradient(135deg,#00d4ff,#7c5fff)' },
              { label: 'Más Viajes', value: topViajes?.matricula ?? '—', color: 'linear-gradient(135deg,#ffa502,#ff4757)' },
              { label: 'Mayor Ingreso', value: topInc?.matricula ?? '—', color: 'linear-gradient(135deg,#00e89d,#00d4ff)' },
              { label: 'Mayor Consumo', value: topGas?.matricula ?? '—', color: 'linear-gradient(135deg,#7c5fff,#ff6b9d)' },
            ].map(k => (
              <div key={k.label} className="relative bg-bg-secondary border border-border-color rounded-xl p-5 overflow-hidden">
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: k.color }} />
                <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">{k.label}</p>
                <p className="font-mono text-xl font-bold text-text-primary">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-4 text-text-primary">Ingresos por Camión</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rows} layout="vertical" barCategoryGap="25%">
                  <defs><linearGradient id="incBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#7c5fff"/></linearGradient></defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="matricula" tick={{ fill:'#9a9bb0', fontSize:9 }} width={70} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => '$'+fmtM(v)} {...tooltipStyle} />
                  <Bar dataKey="importe" fill="url(#incBar)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-4 text-text-primary">Litros Gasoil por Camión</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rows} layout="vertical" barCategoryGap="25%">
                  <defs><linearGradient id="gasBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff4757"/><stop offset="100%" stopColor="#ff6b9d"/></linearGradient></defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="matricula" tick={{ fill:'#9a9bb0', fontSize:9 }} width={70} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fmt(v)+' lt'} {...tooltipStyle} />
                  <Bar dataKey="litros_gasoil" fill="url(#gasBar)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla detalle */}
          <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-color">
              <h3 className="text-sm font-semibold text-text-primary">Detalle por Camión</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr>
                  {['Matrícula','Viajes','Ingresos','Gasoil','Litros','Comis.','Peajes','Imprevistos','Beneficio','Margen'].map(h => (
                    <th key={h} className="table-header text-left whitespace-nowrap px-4 py-2.5">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rows.map(r => {
                    const profit = r.importe - r.gasto_gasoil - r.comision - r.peajes - r.imprevistos
                    const margin = r.importe > 0 ? ((profit/r.importe)*100).toFixed(1) : '0'
                    return (
                      <tr key={r.matricula} className="table-row-hover border-b border-border-color/50">
                        <td className="table-cell px-4"><span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">{r.matricula}</span></td>
                        <td className="table-cell px-4 font-mono text-right">{r.count}</td>
                        <td className="table-cell px-4 font-mono text-right text-success">${fmt(r.importe)}</td>
                        <td className="table-cell px-4 font-mono text-right text-danger">${fmt(r.gasto_gasoil)}</td>
                        <td className="table-cell px-4 font-mono text-right">{fmt(r.litros_gasoil)} lt</td>
                        <td className="table-cell px-4 font-mono text-right">${fmt(r.comision)}</td>
                        <td className="table-cell px-4 font-mono text-right">${fmt(r.peajes)}</td>
                        <td className="table-cell px-4 font-mono text-right text-warning">${fmt(r.imprevistos)}</td>
                        <td className={`table-cell px-4 font-mono text-right font-semibold ${profit>=0?'text-accent-cyan':'text-danger'}`}>${fmt(profit)}</td>
                        <td className={`table-cell px-4 font-mono text-right ${Number(margin)>=0?'text-success':'text-danger'}`}>{margin}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB: GESTIÓN CAMIONES */}
      {tab === 'camiones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateCamion} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Agregar camión
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {camiones.map(c => {
              const chofer = choferes.find(ch => ch.id === c.chofer_asignado_id)
              const alertaMant = c.km_mantenimiento > 0 && c.km_actual >= c.km_mantenimiento
              return (
                <div key={c.id} className="card relative group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-bg-tertiary border border-border-color flex items-center justify-center">
                        <Truck size={16} className="text-accent-cyan" />
                      </div>
                      <div>
                        <p className="font-mono font-bold text-accent-cyan">{c.matricula}</p>
                        {c.marca && <p className="text-xs text-text-secondary">{c.marca} {c.modelo} {c.anio}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLORS[c.estado]}`}>{c.estado}</span>
                    </div>
                  </div>
                  {alertaMant && (
                    <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-3">
                      <AlertTriangle size={12} /> Mantenimiento requerido ({fmt(c.km_actual)} km)
                    </div>
                  )}
                  <div className="space-y-1 text-xs text-text-secondary mb-3">
                    <p>Km actual: <span className="font-mono text-text-primary">{fmt(c.km_actual)}</span></p>
                    {c.remolque && <p>Remolque: <span className="text-text-primary">{c.remolque}</span></p>}
                    {chofer && <p>Chofer: <span className="text-text-primary">{chofer.nombre}</span></p>}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditCamion(c)} className="btn-ghost text-xs flex items-center gap-1 flex-1 justify-center">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setDeleteTarget({id:c.id,tipo:'camion'})} className="text-xs text-danger hover:bg-danger/10 rounded-lg px-3 py-1.5 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB: GESTIÓN ZORRAS */}
      {tab === 'zorras' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateZorra} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Agregar zorra
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {zorras.map(z => (
              <div key={z.id} className="card relative group">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono font-bold text-text-primary">{z.matricula}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLORS[z.estado]}`}>{z.estado}</span>
                </div>
                {z.notas && <p className="text-xs text-text-secondary mb-2">{z.notas}</p>}
                <div className="flex gap-2 pt-2 border-t border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditZorra(z)} className="btn-ghost text-xs flex items-center gap-1 flex-1 justify-center">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => setDeleteTarget({id:z.id,tipo:'zorra'})} className="text-xs text-danger hover:bg-danger/10 rounded-lg px-3 py-1.5 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {zorras.length === 0 && <p className="col-span-4 text-center py-12 text-text-secondary">Sin zorras registradas</p>}
          </div>
        </div>
      )}

      {/* Modal Camión */}
      <Modal open={modalCamion} onClose={() => setModalCamion(false)} title={editCamionId ? 'Editar camión' : 'Nuevo camión'}
        footer={<><button onClick={() => setModalCamion(false)} className="btn-secondary text-sm">Cancelar</button><button onClick={handleSaveCamion} disabled={saving} className="btn-primary text-sm">{saving ? 'Guardando...' : editCamionId ? 'Actualizar' : 'Agregar'}</button></>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group"><label className="label">Matrícula *</label><input type="text" className="input font-mono uppercase" placeholder="FTP2637" value={formCamion.matricula} onChange={e => setFormCamion(p=>({...p,matricula:e.target.value}))} /></div>
          <div className="form-group"><label className="label">Remolque/Zorra</label><input type="text" className="input font-mono" placeholder="FTP2562" value={formCamion.remolque} onChange={e => setFormCamion(p=>({...p,remolque:e.target.value}))} /></div>
          <div className="form-group"><label className="label">Estado</label>
            <select className="input" value={formCamion.estado} onChange={e => setFormCamion(p=>({...p,estado:e.target.value as any}))}>
              <option value="activo">Activo</option><option value="taller">En taller</option><option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="form-group"><label className="label">Chofer asignado</label>
            <select className="input" value={formCamion.chofer_asignado_id} onChange={e => setFormCamion(p=>({...p,chofer_asignado_id:e.target.value}))}>
              <option value="">Sin asignar</option>{choferes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="label">Km actual</label><input type="number" className="input font-mono" value={formCamion.km_actual||''} onChange={e => setFormCamion(p=>({...p,km_actual:parseFloat(e.target.value)||0}))} /></div>
          <div className="form-group"><label className="label">Km próx. mantenimiento</label><input type="number" className="input font-mono" placeholder="0 = sin alerta" value={formCamion.km_mantenimiento||''} onChange={e => setFormCamion(p=>({...p,km_mantenimiento:parseFloat(e.target.value)||0}))} /></div>
          <div className="form-group"><label className="label">Marca</label><input type="text" className="input" placeholder="Scania, Volvo..." value={formCamion.marca} onChange={e => setFormCamion(p=>({...p,marca:e.target.value}))} /></div>
          <div className="form-group"><label className="label">Modelo</label><input type="text" className="input" value={formCamion.modelo} onChange={e => setFormCamion(p=>({...p,modelo:e.target.value}))} /></div>
          <div className="form-group"><label className="label">Año</label><input type="number" className="input font-mono" placeholder="2020" value={formCamion.anio} onChange={e => setFormCamion(p=>({...p,anio:e.target.value}))} /></div>
          <div className="form-group col-span-2"><label className="label">Notas</label><textarea className="input resize-none" rows={2} value={formCamion.notas} onChange={e => setFormCamion(p=>({...p,notas:e.target.value}))} /></div>
        </div>
      </Modal>

      {/* Modal Zorra */}
      <Modal open={modalZorra} onClose={() => setModalZorra(false)} title={editZorraId ? 'Editar zorra' : 'Nueva zorra'}
        footer={<><button onClick={() => setModalZorra(false)} className="btn-secondary text-sm">Cancelar</button><button onClick={handleSaveZorra} disabled={saving} className="btn-primary text-sm">{saving?'Guardando...':editZorraId?'Actualizar':'Agregar'}</button></>}
      >
        <div className="space-y-4">
          <div className="form-group"><label className="label">Matrícula *</label><input type="text" className="input font-mono uppercase" placeholder="FTP2562" value={formZorra.matricula} onChange={e => setFormZorra(p=>({...p,matricula:e.target.value}))} /></div>
          <div className="form-group"><label className="label">Estado</label>
            <select className="input" value={formZorra.estado} onChange={e => setFormZorra(p=>({...p,estado:e.target.value as any}))}>
              <option value="activo">Activo</option><option value="taller">En taller</option><option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="form-group"><label className="label">Notas</label><textarea className="input resize-none" rows={2} value={formZorra.notas} onChange={e => setFormZorra(p=>({...p,notas:e.target.value}))} /></div>
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar eliminación" size="sm"
        footer={<><button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">Cancelar</button><button onClick={handleDelete} className="btn-danger text-sm">Eliminar</button></>}
      >
        <p className="text-text-secondary text-sm">¿Eliminar este vehículo? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  )
}
