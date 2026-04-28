'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import {
  Users, Pencil, Phone, FileText, Truck, AlertTriangle,
  CheckCircle2, XCircle, UserPlus, BarChart2, Hash, Calendar, StickyNote
} from 'lucide-react'
import type { Usuario, ChoferDetalle, Camion } from '@/types'

/* ─── Types ──────────────────────────────────────────────── */

interface ChoferConDetalle extends Usuario {
  detalle: ChoferDetalle | null
  camion: Camion | null
}

interface DetalleForm {
  nombre_completo: string
  telefono: string
  licencia: string
  cedula: string
  fecha_venc_licencia: string
  camion_asignado_id: string
  activo: boolean
  notas: string
}

const defaultForm: DetalleForm = {
  nombre_completo: '', telefono: '', licencia: '', cedula: '',
  fecha_venc_licencia: '', camion_asignado_id: '', activo: true, notas: '',
}

interface StatRow {
  chofer: string
  viajes: number
  ingresos: number
  gasoil: number
  litros: number
  km: number
  toneladas: number
  comisiones: number
}

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }

/* ─── Helpers ────────────────────────────────────────────── */

function licenciaEstado(fecha: string | null | undefined): 'ok' | 'pronto' | 'vencida' | null {
  if (!fecha) return null
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (dias < 0) return 'vencida'
  if (dias <= 30) return 'pronto'
  return 'ok'
}

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

/* ─── Page ───────────────────────────────────────────────── */

export default function ChoferesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'rendimiento' | 'personal'>('rendimiento')

  /* ── Personal state ── */
  const [choferes, setChoferes] = useState<ChoferConDetalle[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [loadingPersonal, setLoadingPersonal] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ChoferConDetalle | null>(null)
  const [form, setForm] = useState<DetalleForm>(defaultForm)
  const [search, setSearch] = useState('')

  /* ── Rendimiento state ── */
  const [stats, setStats] = useState<StatRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [desde, setDesde] = useState(monthStart())
  const [hasta, setHasta] = useState(today())

  /* ── Load personal ── */
  const fetchPersonal = useCallback(async () => {
    setLoadingPersonal(true)
    const [{ data: usuarios }, { data: detalles }, { data: cams }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('rol', 'chofer').order('nombre'),
      supabase.from('choferes_detalle').select('*, camion:camiones(*)'),
      supabase.from('camiones').select('*').eq('estado', 'activo').order('matricula'),
    ])
    const detalleMap: Record<string, ChoferDetalle & { camion?: Camion }> = {}
    ;(detalles ?? []).forEach((d: any) => { detalleMap[d.usuario_id] = d })
    const merged: ChoferConDetalle[] = (usuarios ?? []).map((u: Usuario) => ({
      ...u,
      detalle: detalleMap[u.id] ?? null,
      camion: detalleMap[u.id]?.camion ?? null,
    }))
    setChoferes(merged)
    setCamiones(cams ?? [])
    setLoadingPersonal(false)
  }, [supabase])

  /* ── Load rendimiento ── */
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    const { data } = await supabase
      .from('viajes')
      .select('chofer_nombre,importe,gasto_gasoil,litros_gasoil,km,toneladas,comision')
      .gte('fecha', desde)
      .lte('fecha', hasta)
    const m: Record<string, StatRow> = {}
    ;(data ?? []).forEach((v: any) => {
      const k = v.chofer_nombre || 'Sin asignar'
      if (!m[k]) m[k] = { chofer: k, viajes: 0, ingresos: 0, gasoil: 0, litros: 0, km: 0, toneladas: 0, comisiones: 0 }
      m[k].viajes++
      m[k].ingresos += v.importe ?? 0
      m[k].gasoil += v.gasto_gasoil ?? 0
      m[k].litros += v.litros_gasoil ?? 0
      m[k].km += v.km ?? 0
      m[k].toneladas += v.toneladas ?? 0
      m[k].comisiones += v.comision ?? 0
    })
    setStats(Object.values(m).sort((a, b) => b.ingresos - a.ingresos))
    setLoadingStats(false)
  }, [supabase, desde, hasta])

  useEffect(() => { fetchPersonal() }, [fetchPersonal])
  useEffect(() => { fetchStats() }, [fetchStats])

  /* ── Modal helpers ── */
  const openModal = (c: ChoferConDetalle) => {
    setSelectedUser(c)
    setForm(c.detalle ? {
      nombre_completo: c.detalle.nombre_completo,
      telefono: c.detalle.telefono ?? '',
      licencia: c.detalle.licencia ?? '',
      cedula: c.detalle.cedula ?? '',
      fecha_venc_licencia: c.detalle.fecha_venc_licencia ?? '',
      camion_asignado_id: c.detalle.camion_asignado_id ?? '',
      activo: c.detalle.activo,
      notas: c.detalle.notas ?? '',
    } : { ...defaultForm, nombre_completo: c.nombre })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!selectedUser) return
    if (!form.nombre_completo.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const payload = {
      usuario_id: selectedUser.id,
      nombre_completo: form.nombre_completo.trim(),
      telefono: form.telefono || '',
      licencia: form.licencia || '',
      cedula: form.cedula || null,
      fecha_venc_licencia: form.fecha_venc_licencia || null,
      camion_asignado_id: form.camion_asignado_id || null,
      activo: form.activo,
      notas: form.notas || null,
    }
    const { error } = selectedUser.detalle
      ? await supabase.from('choferes_detalle').update(payload).eq('id', selectedUser.detalle.id)
      : await supabase.from('choferes_detalle').insert(payload)
    setSaving(false)
    if (error) toast.error('Error al guardar: ' + error.message)
    else { toast.success('Perfil actualizado'); setModalOpen(false); fetchPersonal() }
  }

  const filtered = useMemo(() =>
    choferes.filter(c =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.detalle?.telefono ?? '').includes(search) ||
      (c.detalle?.cedula ?? '').includes(search)
    ), [choferes, search])

  /* ── Totals for rendimiento ── */
  const totales = useMemo(() => stats.reduce(
    (acc, r) => ({
      viajes: acc.viajes + r.viajes,
      ingresos: acc.ingresos + r.ingresos,
      gasoil: acc.gasoil + r.gasoil,
      km: acc.km + r.km,
      toneladas: acc.toneladas + r.toneladas,
      comisiones: acc.comisiones + r.comisiones,
    }),
    { viajes: 0, ingresos: 0, gasoil: 0, km: 0, toneladas: 0, comisiones: 0 }
  ), [stats])

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary border border-border-color rounded-xl p-1 w-fit">
        {([
          { id: 'rendimiento', icon: BarChart2, label: 'Rendimiento' },
          { id: 'personal',    icon: Users,     label: 'Gestión Personal' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-accent-cyan text-bg-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Rendimiento ── */}
      {tab === 'rendimiento' && (
        <div className="space-y-4">
          {/* Date filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-bg-secondary border border-border-color rounded-xl px-3 py-2">
              <Calendar size={13} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">Desde</span>
              <input type="date" className="bg-transparent text-xs text-text-primary outline-none"
                value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 bg-bg-secondary border border-border-color rounded-xl px-3 py-2">
              <Calendar size={13} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">Hasta</span>
              <input type="date" className="bg-transparent text-xs text-text-primary outline-none"
                value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>

          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Choferes', value: stats.length.toString(), color: 'text-accent-cyan' },
              { label: 'Viajes', value: fmt(totales.viajes), color: 'text-text-primary' },
              { label: 'Ingresos', value: `$${fmt(totales.ingresos)}`, color: 'text-success' },
              { label: 'Gasoil', value: `$${fmt(totales.gasoil)}`, color: 'text-warning' },
              { label: 'Km totales', value: `${fmt(totales.km)} km`, color: 'text-text-primary' },
              { label: 'Comisiones', value: `$${fmt(totales.comisiones)}`, color: 'text-warning' },
            ].map(k => (
              <div key={k.label} className="card py-3 px-4 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`font-mono font-bold text-sm ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-color">
              <h3 className="text-sm font-semibold text-text-primary">Rendimiento por Chofer</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {['#','Chofer','Viajes','Ingresos','Gasoil','Litros','Km','Toneladas','Comisiones','Prom/Viaje'].map(h => (
                      <th key={h} className="table-header text-left whitespace-nowrap px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingStats ? (
                    <tr><td colSpan={10} className="py-10 text-center">
                      <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
                    </td></tr>
                  ) : stats.length === 0 ? (
                    <tr><td colSpan={10} className="py-10 text-center text-text-secondary">Sin datos en el período</td></tr>
                  ) : stats.map((r, i) => (
                    <tr key={r.chofer} className="table-row-hover border-b border-border-color/50">
                      <td className="table-cell px-4 text-text-secondary font-mono">{i + 1}</td>
                      <td className="table-cell px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: `hsl(${(i * 47) % 360}, 60%, 40%)`, color: '#fff' }}>
                            {r.chofer.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-text-primary whitespace-nowrap">{r.chofer}</span>
                        </div>
                      </td>
                      <td className="table-cell px-4 font-mono text-right">{r.viajes}</td>
                      <td className="table-cell px-4 font-mono text-right text-success">${fmt(r.ingresos)}</td>
                      <td className="table-cell px-4 font-mono text-right text-danger">${fmt(r.gasoil)}</td>
                      <td className="table-cell px-4 font-mono text-right">{fmt(r.litros)} lt</td>
                      <td className="table-cell px-4 font-mono text-right">{fmt(r.km)} km</td>
                      <td className="table-cell px-4 font-mono text-right">{r.toneladas.toFixed(1)} t</td>
                      <td className="table-cell px-4 font-mono text-right">${fmt(r.comisiones)}</td>
                      <td className="table-cell px-4 font-mono text-right text-accent-cyan">
                        ${fmt(r.viajes > 0 ? Math.round(r.ingresos / r.viajes) : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Gestión Personal ── */}
      {tab === 'personal' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-text-secondary text-sm">
              {choferes.filter(c => c.activo).length} choferes activos · {choferes.filter(c => c.detalle).length} con perfil completo
            </p>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Buscar chofer..." className="input text-xs w-48"
                value={search} onChange={e => setSearch(e.target.value)} />
              <a
                href="https://supabase.com/dashboard"
                target="_blank" rel="noreferrer"
                className="btn-secondary flex items-center gap-2 text-xs"
                title="Crear nuevo usuario chofer en Supabase Dashboard"
              >
                <UserPlus size={13} /> Nuevo usuario
              </a>
            </div>
          </div>

          {/* Note */}
          <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl px-4 py-3 text-xs text-text-secondary">
            Para agregar un nuevo chofer, creá el usuario en el Dashboard de Supabase con rol <span className="font-mono text-accent-cyan">chofer</span>, luego aparecerá aquí para configurar su perfil.
          </div>

          {/* Cards */}
          {loadingPersonal ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((c, i) => {
                const d = c.detalle
                const licEst = licenciaEstado(d?.fecha_venc_licencia)
                return (
                  <div key={c.id} className={`card relative group ${!c.activo ? 'opacity-60' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: `hsl(${(i * 47) % 360}, 55%, 38%)`, color: '#fff' }}>
                          {(d?.nombre_completo || c.nombre).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary text-sm">{d?.nombre_completo || c.nombre}</p>
                          <p className="text-[10px] text-text-secondary">{c.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {d ? (
                          d.activo
                            ? <span className="text-[10px] bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded-full">Activo</span>
                            : <span className="text-[10px] bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded-full">Inactivo</span>
                        ) : (
                          <span className="text-[10px] bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded-full">Sin perfil</span>
                        )}
                        <button onClick={() => openModal(c)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all">
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-text-secondary mb-3">
                      {d?.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={11} className="flex-shrink-0" />
                          <span>{d.telefono}</span>
                        </div>
                      )}
                      {d?.cedula && (
                        <div className="flex items-center gap-1.5">
                          <Hash size={11} className="flex-shrink-0" />
                          <span className="font-mono">{d.cedula}</span>
                        </div>
                      )}
                      {d?.licencia && (
                        <div className="flex items-center gap-1.5">
                          <FileText size={11} className="flex-shrink-0" />
                          <span className="font-mono">{d.licencia}</span>
                          {licEst === 'vencida' && (
                            <span className="flex items-center gap-0.5 text-danger font-medium">
                              <AlertTriangle size={10} /> Vencida
                            </span>
                          )}
                          {licEst === 'pronto' && (
                            <span className="flex items-center gap-0.5 text-warning font-medium">
                              <AlertTriangle size={10} /> Vence pronto
                            </span>
                          )}
                          {licEst === 'ok' && (
                            <CheckCircle2 size={10} className="text-success" />
                          )}
                        </div>
                      )}
                      {d?.fecha_venc_licencia && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="flex-shrink-0" />
                          <span>Vence: <span className={`font-mono ${licEst === 'vencida' ? 'text-danger' : licEst === 'pronto' ? 'text-warning' : 'text-text-primary'}`}>{d.fecha_venc_licencia}</span></span>
                        </div>
                      )}
                      {c.camion && (
                        <div className="flex items-center gap-1.5">
                          <Truck size={11} className="flex-shrink-0" />
                          <span className="font-mono text-text-primary">{c.camion.matricula}</span>
                        </div>
                      )}
                      {!d && (
                        <p className="italic text-text-secondary/60">Perfil pendiente de configurar</p>
                      )}
                    </div>

                    {/* Footer */}
                    {d?.notas && (
                      <div className="pt-3 border-t border-border-color flex items-start gap-1.5 text-xs text-text-secondary">
                        <StickyNote size={11} className="flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{d.notas}</span>
                      </div>
                    )}
                    {!d?.notas && (
                      <div className="pt-3 border-t border-border-color flex items-center justify-between">
                        {d ? (
                          <div className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 size={11} />
                            <span>Perfil completo</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-warning">
                            <XCircle size={11} />
                            <span>Completar perfil</span>
                          </div>
                        )}
                        <button onClick={() => openModal(c)}
                          className="text-xs text-accent-cyan hover:underline">
                          {d ? 'Editar' : 'Configurar'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && !loadingPersonal && (
                <div className="col-span-3 py-16 text-center text-text-secondary">
                  {search ? 'Sin resultados' : 'No hay choferes registrados en el sistema'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal editar/crear perfil ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedUser?.detalle ? `Editar perfil — ${selectedUser.nombre}` : `Crear perfil — ${selectedUser?.nombre}`}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : selectedUser?.detalle ? 'Actualizar' : 'Crear perfil'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="label">Nombre completo *</label>
              <input type="text" className="input" placeholder="Juan Pérez"
                value={form.nombre_completo} onChange={e => setForm(p => ({ ...p, nombre_completo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Teléfono</label>
              <input type="text" className="input" placeholder="098 000 000"
                value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Cédula</label>
              <input type="text" className="input font-mono" placeholder="1.234.567-8"
                value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">N° Licencia</label>
              <input type="text" className="input font-mono" placeholder="LIC-12345"
                value={form.licencia} onChange={e => setForm(p => ({ ...p, licencia: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Vencimiento licencia</label>
              <input type="date" className="input"
                value={form.fecha_venc_licencia} onChange={e => setForm(p => ({ ...p, fecha_venc_licencia: e.target.value }))} />
            </div>
            <div className="form-group col-span-2">
              <label className="label">Camión asignado</label>
              <select className="input" value={form.camion_asignado_id}
                onChange={e => setForm(p => ({ ...p, camion_asignado_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {camiones.map(cam => (
                  <option key={cam.id} value={cam.id}>{cam.matricula}{cam.marca ? ` — ${cam.marca} ${cam.modelo ?? ''}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group col-span-2">
              <label className="label">Notas internas</label>
              <textarea className="input min-h-[64px] resize-none" placeholder="Observaciones sobre el chofer..."
                value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <input type="checkbox" id="activo_cho" checked={form.activo}
                onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
                className="w-4 h-4 accent-accent-cyan" />
              <label htmlFor="activo_cho" className="text-sm text-text-primary">Chofer activo</label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
