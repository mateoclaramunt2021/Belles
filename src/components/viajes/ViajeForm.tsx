'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Camera } from 'lucide-react'
import type { Cliente, Camion, Tarifa, Usuario, Zorra, ViajeGasoil, Incidente, TipoPrecio, IncidenteTipo } from '@/types'
import toast from 'react-hot-toast'

export interface ViajeFormData {
  // Identificación
  numero_planilla: string
  numero_remito: string
  numero_remito_carga: string
  numero_remito_descarga: string
  // Fechas
  fecha: string
  fecha_carga: string
  fecha_descarga: string
  hora_entrada_carga: string
  hora_salida_carga: string
  hora_entrada_descarga: string
  hora_salida_descarga: string
  // Flota
  camion_id: string
  matricula: string
  mat_zorra: string
  chofer_id: string
  chofer_nombre: string
  // Km odómetro
  km_carga: number
  km_descarga: number
  km: number
  // Carga y destino
  cliente_id: string
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  // Pesos
  kg_bruto: number
  kg_tara: number
  kg_neto: number
  toneladas: number
  // Facturación
  tipo_precio: TipoPrecio
  tarifa_aplicada: number
  precio_por_unidad: number
  importe: number
  // Gastos fijos
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  imprevistos: number
  // Cobro
  estado_cobro: 'pendiente' | 'cobrado'
  medio_pago: string
  fecha_cobro: string
  numero_factura: string
  // Fotos
  foto_url: string
  foto_remito_descarga_url: string
  notas: string
}

export interface GasoilRow { litros: number; km: number; estacion: string; importe: number }
export interface IncidenteRow { tipo: IncidenteTipo; descripcion: string; importe: number }

export const defaultFormData: ViajeFormData = {
  numero_planilla: '', numero_remito: '', numero_remito_carga: '', numero_remito_descarga: '',
  fecha: new Date().toISOString().split('T')[0],
  fecha_carga: new Date().toISOString().split('T')[0],
  fecha_descarga: '',
  hora_entrada_carga: '', hora_salida_carga: '', hora_entrada_descarga: '', hora_salida_descarga: '',
  camion_id: '', matricula: '', mat_zorra: '', chofer_id: '', chofer_nombre: '',
  km_carga: 0, km_descarga: 0, km: 0,
  cliente_id: '', cliente_nombre: '', origen: '', destino: '', mercaderia: '',
  kg_bruto: 0, kg_tara: 0, kg_neto: 0, toneladas: 0,
  tipo_precio: 'tonelada', tarifa_aplicada: 0, precio_por_unidad: 0, importe: 0,
  gasto_gasoil: 0, litros_gasoil: 0, comision: 0, peajes: 0, imprevistos: 0,
  estado_cobro: 'pendiente', medio_pago: '', fecha_cobro: '', numero_factura: '',
  foto_url: '', foto_remito_descarga_url: '', notas: '',
}

interface ViajeFormProps {
  initialData?: Partial<Record<string, unknown>>
  initialGasoil?: GasoilRow[]
  initialIncidentes?: IncidenteRow[]
  onSubmit: (data: ViajeFormData, gasoil: GasoilRow[], incidentes: IncidenteRow[]) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-border-color rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {open ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
      </button>
      {open && <div className="p-4 bg-bg-primary space-y-4">{children}</div>}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="label">{label}{required && <span className="text-danger ml-1">*</span>}</label>
      {children}
    </div>
  )
}

export function ViajeForm({
  initialData = {}, initialGasoil, initialIncidentes,
  onSubmit, submitLabel = 'Guardar viaje', loading = false
}: ViajeFormProps) {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  const clean = Object.fromEntries(
    Object.entries(initialData).map(([k, v]) => [k, v === null ? undefined : v])
  ) as Partial<ViajeFormData>

  const [form, setForm] = useState<ViajeFormData>({ ...defaultFormData, ...clean })
  const [gasoil, setGasoil] = useState<GasoilRow[]>(
    initialGasoil ?? [{ litros: 0, km: 0, estacion: '', importe: 0 }]
  )
  const [incidentes, setIncidentes] = useState<IncidenteRow[]>(initialIncidentes ?? [])

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [zorras, setZorras] = useState<Zorra[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [choferes, setChoferes] = useState<Usuario[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Sections open state
  const [sections, setSections] = useState({
    identificacion: true, fechas: true, flota: true,
    carga: true, pesos: true, facturacion: true,
    gasoil: true, gastos: false, cobro: false, fotos: false, notas: false,
  })
  const toggleSection = (s: keyof typeof sections) =>
    setSections(p => ({ ...p, [s]: !p[s] }))

  useEffect(() => {
    const load = async () => {
      const [c, cam, z, t, ch] = await Promise.all([
        supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
        supabase.from('camiones').select('*').eq('estado', 'activo').order('matricula'),
        supabase.from('zorras').select('*').eq('estado', 'activo').order('matricula'),
        supabase.from('tarifas').select('*, cliente:clientes(nombre)').eq('activo', true),
        isAdmin
          ? supabase.from('usuarios').select('*').eq('activo', true).eq('rol', 'chofer').order('nombre')
          : Promise.resolve({ data: [] }),
      ])
      setClientes(c.data ?? [])
      setCamiones(cam.data ?? [])
      setZorras(z.data ?? [])
      setTarifas(t.data ?? [])
      setChoferes(ch.data ?? [])
      setLoadingData(false)
    }
    load()
  }, [isAdmin, supabase])

  useEffect(() => {
    if (!isAdmin && profile) {
      set('chofer_id', profile.id)
      set('chofer_nombre', profile.nombre)
    }
  }, [isAdmin, profile])

  // Auto-calcular tarifa cuando cambian cliente, destino, toneladas
  useEffect(() => {
    if (form.tipo_precio === 'tonelada' && form.cliente_id && form.destino && form.toneladas > 0) {
      const tarifa = tarifas.find(
        t => t.cliente_id === form.cliente_id &&
             t.destino.toLowerCase() === form.destino.toLowerCase() && t.activo
      )
      if (tarifa) {
        const imp = tarifa.precio_por_tonelada * form.toneladas
        setForm(p => ({ ...p, tarifa_aplicada: tarifa.precio_por_tonelada, importe: Math.round(imp * 100) / 100 }))
      }
    }
  }, [form.tipo_precio, form.cliente_id, form.destino, form.toneladas, tarifas])

  // Auto-calcular kg_neto
  useEffect(() => {
    if (form.kg_bruto > 0 || form.kg_tara > 0) {
      const neto = Math.max(0, form.kg_bruto - form.kg_tara)
      setForm(p => ({ ...p, kg_neto: neto }))
    }
  }, [form.kg_bruto, form.kg_tara])

  // Auto-calcular km viaje
  useEffect(() => {
    if (form.km_carga > 0 && form.km_descarga > form.km_carga) {
      setForm(p => ({ ...p, km: form.km_descarga - form.km_carga }))
    }
  }, [form.km_carga, form.km_descarga])

  // Auto-calcular totales de gasoil
  useEffect(() => {
    const totalLitros = gasoil.reduce((s, g) => s + (g.litros || 0), 0)
    const totalImporte = gasoil.reduce((s, g) => s + (g.importe || 0), 0)
    setForm(p => ({ ...p, litros_gasoil: totalLitros, gasto_gasoil: totalImporte }))
  }, [gasoil])

  // Auto-calcular imprevistos totales
  useEffect(() => {
    const total = incidentes.reduce((s, i) => s + (i.importe || 0), 0)
    setForm(p => ({ ...p, imprevistos: total }))
  }, [incidentes])

  // Cuando cambia camión, actualizar matrícula
  useEffect(() => {
    if (form.camion_id) {
      const cam = camiones.find(c => c.id === form.camion_id)
      if (cam) setForm(p => ({ ...p, matricula: cam.matricula }))
    }
  }, [form.camion_id, camiones])

  // Cuando cambia cliente, actualizar nombre
  useEffect(() => {
    if (form.cliente_id) {
      const cli = clientes.find(c => c.id === form.cliente_id)
      if (cli) setForm(p => ({ ...p, cliente_nombre: cli.nombre }))
    }
  }, [form.cliente_id, clientes])

  // Cuando cambia chofer (admin), actualizar nombre
  useEffect(() => {
    if (form.chofer_id && isAdmin) {
      const ch = choferes.find(c => c.id === form.chofer_id)
      if (ch) setForm(p => ({ ...p, chofer_nombre: ch.nombre }))
    }
  }, [form.chofer_id, choferes, isAdmin])

  const set = (field: keyof ViajeFormData, value: unknown) =>
    setForm(p => ({ ...p, [field]: value }))

  // Gasoil helpers
  const addGasoil = () => setGasoil(p => [...p, { litros: 0, km: 0, estacion: '', importe: 0 }])
  const removeGasoil = (i: number) => setGasoil(p => p.filter((_, idx) => idx !== i))
  const setGasoilRow = (i: number, field: keyof GasoilRow, value: unknown) =>
    setGasoil(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  // Incidentes helpers
  const addIncidente = () => setIncidentes(p => [...p, { tipo: 'otro', descripcion: '', importe: 0 }])
  const removeIncidente = (i: number) => setIncidentes(p => p.filter((_, idx) => idx !== i))
  const setIncidenteRow = (i: number, field: keyof IncidenteRow, value: unknown) =>
    setIncidentes(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  const handleFotoUpload = async (file: File, field: 'foto_url' | 'foto_remito_descarga_url') => {
    if (!file) return
    setUploadingFoto(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `remitos/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('viajes-fotos').upload(path, file)
      if (error) { toast.error('Error al subir foto'); return }
      const { data } = supabase.storage.from('viajes-fotos').getPublicUrl(path)
      set(field, data.publicUrl)
      toast.success('Foto subida correctamente')
    } finally {
      setUploadingFoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fecha_carga) { toast.error('La fecha de carga es obligatoria'); return }
    if (!form.matricula && !form.camion_id) { toast.error('Seleccioná un camión'); return }
    if (!form.toneladas && form.tipo_precio === 'tonelada') { toast.error('Las toneladas son obligatorias'); return }
    await onSubmit(form, gasoil, incidentes)
  }

  const destinosDisponibles = form.cliente_id
    ? [...new Set(tarifas.filter(t => t.cliente_id === form.cliente_id).map(t => t.destino))]
    : [...new Set(tarifas.map(t => t.destino))]

  const totalGastos = (form.gasto_gasoil || 0) + (form.comision || 0) + (form.peajes || 0) + (form.imprevistos || 0)
  const neto = (form.importe || 0) - totalGastos

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-accent-cyan" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* SECCIÓN 1 — Identificación */}
      <Section title="📋  Identificación del viaje" open={sections.identificacion} onToggle={() => toggleSection('identificacion')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="N° Planilla">
            <input type="text" className="input font-mono" placeholder="18320"
              value={form.numero_planilla} onChange={e => set('numero_planilla', e.target.value)} />
          </Field>
          <Field label="Remito Carga">
            <input type="text" className="input font-mono" placeholder="49882"
              value={form.numero_remito_carga}
              onChange={e => { set('numero_remito_carga', e.target.value); set('numero_remito', e.target.value) }} />
          </Field>
          <Field label="Remito Descarga">
            <input type="text" className="input font-mono" placeholder="49703"
              value={form.numero_remito_descarga} onChange={e => set('numero_remito_descarga', e.target.value)} />
          </Field>
          <Field label="Estado cobro">
            {isAdmin ? (
              <select className="input" value={form.estado_cobro} onChange={e => set('estado_cobro', e.target.value as 'pendiente' | 'cobrado')}>
                <option value="pendiente">Pendiente</option>
                <option value="cobrado">Cobrado</option>
              </select>
            ) : (
              <input type="text" className="input bg-bg-primary text-text-secondary" value="Pendiente" readOnly />
            )}
          </Field>
        </div>
      </Section>

      {/* SECCIÓN 2 — Fechas */}
      <Section title="📅  Fechas y horarios" open={sections.fechas} onToggle={() => toggleSection('fechas')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Fecha carga" required>
            <input type="date" className="input"
              value={form.fecha_carga} onChange={e => { set('fecha_carga', e.target.value); set('fecha', e.target.value) }} required />
          </Field>
          <Field label="Fecha descarga">
            <input type="date" className="input"
              value={form.fecha_descarga} onChange={e => set('fecha_descarga', e.target.value)} />
          </Field>
          <Field label="Hora entrada carga">
            <input type="time" className="input font-mono"
              value={form.hora_entrada_carga} onChange={e => set('hora_entrada_carga', e.target.value)} />
          </Field>
          <Field label="Hora salida carga">
            <input type="time" className="input font-mono"
              value={form.hora_salida_carga} onChange={e => set('hora_salida_carga', e.target.value)} />
          </Field>
          <Field label="Hora entrada descarga">
            <input type="time" className="input font-mono"
              value={form.hora_entrada_descarga} onChange={e => set('hora_entrada_descarga', e.target.value)} />
          </Field>
          <Field label="Hora salida descarga">
            <input type="time" className="input font-mono"
              value={form.hora_salida_descarga} onChange={e => set('hora_salida_descarga', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* SECCIÓN 3 — Flota */}
      <Section title="🚛  Flota y conductor" open={sections.flota} onToggle={() => toggleSection('flota')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Camión" required>
            {camiones.length > 0 ? (
              <select className="input" value={form.camion_id}
                onChange={e => set('camion_id', e.target.value)}>
                <option value="">Seleccionar</option>
                {camiones.map(c => <option key={c.id} value={c.id}>{c.matricula}</option>)}
              </select>
            ) : (
              <input type="text" className="input font-mono" placeholder="FTP2637"
                value={form.matricula} onChange={e => set('matricula', e.target.value)} />
            )}
          </Field>
          <Field label="Zorra / Semi-remolque">
            {zorras.length > 0 ? (
              <select className="input" value={form.mat_zorra}
                onChange={e => set('mat_zorra', e.target.value)}>
                <option value="">Sin zorra</option>
                {zorras.map(z => <option key={z.id} value={z.matricula}>{z.matricula}</option>)}
              </select>
            ) : (
              <input type="text" className="input font-mono" placeholder="FTP2562"
                value={form.mat_zorra} onChange={e => set('mat_zorra', e.target.value)} />
            )}
          </Field>
          {isAdmin ? (
            <Field label="Conductor">
              <select className="input" value={form.chofer_id}
                onChange={e => set('chofer_id', e.target.value)}>
                <option value="">Seleccionar</option>
                {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Conductor">
              <input type="text" className="input bg-bg-secondary" value={form.chofer_nombre} readOnly />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2 col-span-1">
            <Field label="Km carga">
              <input type="number" className="input font-mono" placeholder="185576"
                value={form.km_carga || ''} onChange={e => set('km_carga', parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Km descarga">
              <input type="number" className="input font-mono" placeholder="186121"
                value={form.km_descarga || ''} onChange={e => set('km_descarga', parseFloat(e.target.value) || 0)} />
            </Field>
          </div>
        </div>
        {form.km > 0 && (
          <p className="text-xs text-accent-cyan font-mono">
            → KM del viaje calculados: <strong>{form.km.toLocaleString('es-UY')}</strong>
          </p>
        )}
      </Section>

      {/* SECCIÓN 4 — Carga y destino */}
      <Section title="📦  Cliente y destino" open={sections.carga} onToggle={() => toggleSection('carga')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cliente" required>
            <select className="input" value={form.cliente_id}
              onChange={e => set('cliente_id', e.target.value)} required>
              <option value="">Seleccionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field label="Destino" required>
            {destinosDisponibles.length > 0 ? (
              <select className="input" value={form.destino}
                onChange={e => set('destino', e.target.value)} required>
                <option value="">Seleccionar destino</option>
                {destinosDisponibles.map(d => <option key={d} value={d}>{d}</option>)}
                <option value="__otro__">Otro...</option>
              </select>
            ) : (
              <input type="text" className="input" placeholder="Tecomar, Durazno..."
                value={form.destino} onChange={e => set('destino', e.target.value)} required />
            )}
          </Field>
          <Field label="Origen / Lugar de carga">
            <input type="text" className="input" placeholder="Ej: Planta Urufor, Rivera"
              value={form.origen} onChange={e => set('origen', e.target.value)} />
          </Field>
          <Field label="Mercadería">
            <input type="text" className="input" placeholder="Tablas, Marcos, Autos..."
              value={form.mercaderia} onChange={e => set('mercaderia', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* SECCIÓN 5 — Pesos */}
      <Section title="⚖️  Pesos (kg)" open={sections.pesos} onToggle={() => toggleSection('pesos')}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kg Bruto">
            <input type="number" step="0.01" className="input font-mono" placeholder="45920"
              value={form.kg_bruto || ''} onChange={e => set('kg_bruto', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Kg Tara">
            <input type="number" step="0.01" className="input font-mono" placeholder="13950"
              value={form.kg_tara || ''} onChange={e => set('kg_tara', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Kg Neto (auto)">
            <input type="number" step="0.01" className="input font-mono text-success font-semibold"
              placeholder="31970" value={form.kg_neto || ''}
              onChange={e => set('kg_neto', parseFloat(e.target.value) || 0)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Toneladas" required>
            <input type="number" step="0.001" min="0" className="input font-mono" placeholder="31.97"
              value={form.toneladas || ''}
              onChange={e => {
                const t = parseFloat(e.target.value) || 0
                set('toneladas', t)
                if (form.tipo_precio === 'tonelada' && form.tarifa_aplicada > 0)
                  set('importe', Math.round(form.tarifa_aplicada * t * 100) / 100)
              }} required />
          </Field>
          <Field label="Tipo de precio">
            <select className="input" value={form.tipo_precio}
              onChange={e => set('tipo_precio', e.target.value as TipoPrecio)}>
              <option value="tonelada">Por tonelada</option>
              <option value="unidad">Por unidad</option>
              <option value="viaje">Por viaje (fijo)</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* SECCIÓN 6 — Facturación */}
      <Section title="💰  Facturación" open={sections.facturacion} onToggle={() => toggleSection('facturacion')}>
        <div className="grid grid-cols-3 gap-3">
          {form.tipo_precio === 'tonelada' && (
            <Field label="Precio / ton">
              <input type="number" step="0.01" min="0" className="input font-mono" placeholder="1050"
                value={form.tarifa_aplicada || ''}
                onChange={e => {
                  const p = parseFloat(e.target.value) || 0
                  set('tarifa_aplicada', p)
                  set('importe', Math.round(p * form.toneladas * 100) / 100)
                }} />
            </Field>
          )}
          {form.tipo_precio === 'unidad' && (
            <Field label="Precio / unidad">
              <input type="number" step="0.01" min="0" className="input font-mono" placeholder="0"
                value={form.precio_por_unidad || ''}
                onChange={e => set('precio_por_unidad', parseFloat(e.target.value) || 0)} />
            </Field>
          )}
          <Field label="Importe total ($)" required>
            <input type="number" step="0.01" min="0" className="input font-mono text-success font-bold" placeholder="0"
              value={form.importe || ''}
              onChange={e => set('importe', parseFloat(e.target.value) || 0)} required />
          </Field>
        </div>
        {/* Resumen financiero */}
        {form.importe > 0 && (
          <div className="grid grid-cols-4 gap-3 bg-bg-secondary rounded-xl p-3 mt-2">
            <div className="text-center">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Importe</p>
              <p className="font-mono font-bold text-success text-sm">${form.importe.toLocaleString('es-UY')}</p>
            </div>
            <div className="text-center border-x border-border-color">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Gastos</p>
              <p className="font-mono font-bold text-danger text-sm">${totalGastos.toLocaleString('es-UY')}</p>
            </div>
            <div className="text-center border-r border-border-color">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Neto</p>
              <p className={`font-mono font-bold text-sm ${neto >= 0 ? 'text-accent-cyan' : 'text-danger'}`}>
                ${neto.toLocaleString('es-UY')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Margen</p>
              <p className={`font-mono font-bold text-sm ${neto >= 0 ? 'text-success' : 'text-danger'}`}>
                {form.importe > 0 ? ((neto / form.importe) * 100).toFixed(1) : '0'}%
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* SECCIÓN 7 — Gasoil (múltiples cargas) */}
      <Section title="⛽  Gasoil" open={sections.gasoil} onToggle={() => toggleSection('gasoil')}>
        <div className="space-y-3">
          {gasoil.map((row, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end p-3 bg-bg-secondary rounded-xl">
              <div className="form-group">
                <label className="label">Litros</label>
                <input type="number" step="0.1" className="input font-mono text-xs" placeholder="454"
                  value={row.litros || ''}
                  onChange={e => setGasoilRow(i, 'litros', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="label">Km odómetro</label>
                <input type="number" className="input font-mono text-xs" placeholder="186936"
                  value={row.km || ''}
                  onChange={e => setGasoilRow(i, 'km', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="label">Estación</label>
                <input type="text" className="input text-xs" placeholder="B. Unión, Durazno..."
                  value={row.estacion}
                  onChange={e => setGasoilRow(i, 'estacion', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Importe ($)</label>
                <input type="number" step="0.01" className="input font-mono text-xs" placeholder="0"
                  value={row.importe || ''}
                  onChange={e => setGasoilRow(i, 'importe', parseFloat(e.target.value) || 0)} />
              </div>
              <button type="button" onClick={() => removeGasoil(i)}
                className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors self-end"
                disabled={gasoil.length === 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addGasoil}
            className="flex items-center gap-2 text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors">
            <Plus size={14} /> Agregar carga de gasoil
          </button>
          {gasoil.length > 0 && (
            <p className="text-xs text-text-secondary font-mono">
              Total: <span className="text-text-primary font-semibold">{form.litros_gasoil.toFixed(1)} litros</span>
              {' · '}
              <span className="text-danger font-semibold">${form.gasto_gasoil.toLocaleString('es-UY')}</span>
            </p>
          )}
        </div>
      </Section>

      {/* SECCIÓN 8 — Gastos fijos */}
      <Section title="📊  Otros gastos" open={sections.gastos} onToggle={() => toggleSection('gastos')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Comisión ($)">
            <input type="number" step="0.01" min="0" className="input font-mono" placeholder="0"
              value={form.comision || ''} onChange={e => set('comision', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Peajes ($)">
            <input type="number" step="0.01" min="0" className="input font-mono" placeholder="0"
              value={form.peajes || ''} onChange={e => set('peajes', parseFloat(e.target.value) || 0)} />
          </Field>
        </div>

        {/* Incidentes/Imprevistos */}
        <div className="mt-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Imprevistos / Incidentes</p>
          <div className="space-y-2">
            {incidentes.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-3 bg-bg-secondary rounded-xl">
                <div className="form-group">
                  <label className="label">Tipo</label>
                  <select className="input text-xs" value={row.tipo}
                    onChange={e => setIncidenteRow(i, 'tipo', e.target.value)}>
                    <option value="averia">Avería</option>
                    <option value="accidente">Accidente</option>
                    <option value="demora">Demora</option>
                    <option value="gasto_extra">Gasto extra</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group sm:col-span-2">
                  <label className="label">Descripción</label>
                  <input type="text" className="input text-xs" placeholder="Descripción del incidente"
                    value={row.descripcion} onChange={e => setIncidenteRow(i, 'descripcion', e.target.value)} />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="form-group flex-1">
                    <label className="label">Importe ($)</label>
                    <input type="number" step="0.01" className="input font-mono text-xs" placeholder="0"
                      value={row.importe || ''} onChange={e => setIncidenteRow(i, 'importe', parseFloat(e.target.value) || 0)} />
                  </div>
                  <button type="button" onClick={() => removeIncidente(i)}
                    className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors mb-0.5">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addIncidente}
            className="mt-2 flex items-center gap-2 text-xs text-warning hover:text-warning/80 transition-colors">
            <Plus size={14} /> Agregar imprevisto
          </button>
          {incidentes.length > 0 && (
            <p className="text-xs text-text-secondary font-mono mt-1">
              Total imprevistos: <span className="text-warning font-semibold">${form.imprevistos.toLocaleString('es-UY')}</span>
            </p>
          )}
        </div>
      </Section>

      {/* SECCIÓN 9 — Cobro */}
      {isAdmin && (
        <Section title="💳  Cobro y factura" open={sections.cobro} onToggle={() => toggleSection('cobro')}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Medio de pago">
              <select className="input" value={form.medio_pago}
                onChange={e => set('medio_pago', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </Field>
            <Field label="Fecha cobro">
              <input type="date" className="input" value={form.fecha_cobro}
                onChange={e => set('fecha_cobro', e.target.value)} />
            </Field>
            <Field label="N° Factura">
              <input type="text" className="input font-mono" placeholder="F001-000123"
                value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} />
            </Field>
          </div>
        </Section>
      )}

      {/* SECCIÓN 10 — Fotos */}
      <Section title="📷  Fotos de remitos" open={sections.fotos} onToggle={() => toggleSection('fotos')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="label mb-2">Foto remito carga</p>
            {form.foto_url ? (
              <div className="relative">
                <img src={form.foto_url} alt="Remito carga" className="w-full h-32 object-cover rounded-xl border border-border-color" />
                <button type="button" onClick={() => set('foto_url', '')}
                  className="absolute top-2 right-2 p-1 bg-danger rounded text-white hover:bg-danger/80">
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border-color rounded-xl cursor-pointer hover:border-accent-cyan/50 transition-colors">
                <Camera size={20} className="text-text-secondary mb-1" />
                <span className="text-xs text-text-secondary">Subir foto</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFotoUpload(e.target.files[0], 'foto_url')} />
              </label>
            )}
          </div>
          <div>
            <p className="label mb-2">Foto remito descarga</p>
            {form.foto_remito_descarga_url ? (
              <div className="relative">
                <img src={form.foto_remito_descarga_url} alt="Remito descarga" className="w-full h-32 object-cover rounded-xl border border-border-color" />
                <button type="button" onClick={() => set('foto_remito_descarga_url', '')}
                  className="absolute top-2 right-2 p-1 bg-danger rounded text-white">
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border-color rounded-xl cursor-pointer hover:border-accent-cyan/50 transition-colors">
                <Camera size={20} className="text-text-secondary mb-1" />
                <span className="text-xs text-text-secondary">Subir foto</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFotoUpload(e.target.files[0], 'foto_remito_descarga_url')} />
              </label>
            )}
          </div>
        </div>
        {uploadingFoto && (
          <div className="flex items-center gap-2 text-xs text-accent-cyan">
            <Loader2 size={12} className="animate-spin" /> Subiendo foto...
          </div>
        )}
      </Section>

      {/* SECCIÓN 11 — Notas */}
      <Section title="📝  Notas" open={sections.notas} onToggle={() => toggleSection('notas')}>
        <Field label="Observaciones">
          <textarea className="input resize-none" rows={3} placeholder="Observaciones del viaje..."
            value={form.notas} onChange={e => set('notas', e.target.value)} />
        </Field>
      </Section>

      {/* SUBMIT */}
      <button type="submit" disabled={loading || uploadingFoto}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : submitLabel}
      </button>
    </form>
  )
}
