'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Calculator } from 'lucide-react'
import type { Viaje, Cliente, Camion, Tarifa, Usuario } from '@/types'

interface ViajeFormData {
  fecha: string
  numero_remito: string
  matricula: string
  camion_id: string
  chofer_id: string
  chofer_nombre: string
  cliente_id: string
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  km: number
  toneladas: number
  tarifa_aplicada: number
  importe: number
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  estado_cobro: 'pendiente' | 'cobrado'
  notas: string
  foto_url: string
}

export const defaultFormData: ViajeFormData = {
  fecha: new Date().toISOString().split('T')[0],
  numero_remito: '',
  matricula: '',
  camion_id: '',
  chofer_id: '',
  chofer_nombre: '',
  cliente_id: '',
  cliente_nombre: '',
  origen: '',
  destino: '',
  mercaderia: '',
  km: 0,
  toneladas: 0,
  tarifa_aplicada: 0,
  importe: 0,
  gasto_gasoil: 0,
  litros_gasoil: 0,
  comision: 0,
  peajes: 0,
  estado_cobro: 'pendiente',
  notas: '',
  foto_url: '',
}

interface ViajeFormProps {
  initialData?: Partial<Record<string, unknown>>
  onSubmit: (data: ViajeFormData) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

export function ViajeForm({ initialData = {}, onSubmit, submitLabel = 'Guardar viaje', loading = false }: ViajeFormProps) {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  // Strip null → undefined so it doesn't overwrite defaultFormData defaults
  const cleanedInitial = Object.fromEntries(
    Object.entries(initialData).map(([k, v]) => [k, v === null ? undefined : v])
  ) as Partial<ViajeFormData>

  const [form, setForm] = useState<ViajeFormData>({ ...defaultFormData, ...cleanedInitial })
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [choferes, setChoferes] = useState<Usuario[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Cargar datos de referencia
  useEffect(() => {
    const load = async () => {
      const [c, cam, t, ch] = await Promise.all([
        supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
        supabase.from('camiones').select('*').eq('estado', 'activo').order('matricula'),
        supabase.from('tarifas').select('*, cliente:clientes(nombre)').eq('activo', true),
        isAdmin
          ? supabase.from('usuarios').select('*').eq('activo', true).eq('rol', 'chofer').order('nombre')
          : Promise.resolve({ data: [] }),
      ])
      setClientes(c.data ?? [])
      setCamiones(cam.data ?? [])
      setTarifas(t.data ?? [])
      setChoferes(ch.data ?? [])
      setLoadingData(false)
    }
    load()
  }, [isAdmin, supabase])

  // Si es chofer, pre-llenar sus datos
  useEffect(() => {
    if (!isAdmin && profile) {
      setForm((prev) => ({
        ...prev,
        chofer_id: profile.id,
        chofer_nombre: profile.nombre,
      }))
    }
  }, [isAdmin, profile])

  // Auto-calcular tarifa e importe cuando cambian cliente, destino o toneladas
  useEffect(() => {
    if (form.cliente_id && form.destino && form.toneladas > 0) {
      const tarifa = tarifas.find(
        (t) => t.cliente_id === form.cliente_id &&
               t.destino.toLowerCase() === form.destino.toLowerCase() &&
               t.activo
      )
      if (tarifa) {
        const importe = tarifa.precio_por_tonelada * form.toneladas
        setForm((prev) => ({
          ...prev,
          tarifa_aplicada: tarifa.precio_por_tonelada,
          importe: Math.round(importe * 100) / 100,
        }))
      }
    }
  }, [form.cliente_id, form.destino, form.toneladas, tarifas])

  // Cuando cambia el camión, actualizar matrícula
  useEffect(() => {
    if (form.camion_id) {
      const cam = camiones.find((c) => c.id === form.camion_id)
      if (cam) setForm((prev) => ({ ...prev, matricula: cam.matricula }))
    }
  }, [form.camion_id, camiones])

  // Cuando cambia el cliente, actualizar nombre
  useEffect(() => {
    if (form.cliente_id) {
      const cli = clientes.find((c) => c.id === form.cliente_id)
      if (cli) setForm((prev) => ({ ...prev, cliente_nombre: cli.nombre }))
    }
  }, [form.cliente_id, clientes])

  // Cuando cambia el chofer (admin), actualizar nombre
  useEffect(() => {
    if (form.chofer_id && isAdmin) {
      const ch = choferes.find((c) => c.id === form.chofer_id)
      if (ch) setForm((prev) => ({ ...prev, chofer_nombre: ch.nombre }))
    }
  }, [form.chofer_id, choferes, isAdmin])

  const set = (field: keyof ViajeFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-accent-cyan" />
      </div>
    )
  }

  // Destinos únicos de las tarifas del cliente seleccionado
  const destinosDisponibles = form.cliente_id
    ? [...new Set(tarifas.filter((t) => t.cliente_id === form.cliente_id).map((t) => t.destino))]
    : [...new Set(tarifas.map((t) => t.destino))]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sección 1: Info básica */}
      <div>
        <p className="section-title mb-3">Información del viaje</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Fecha *</label>
            <input
              type="date"
              className="input"
              value={form.fecha}
              onChange={(e) => set('fecha', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Número de remito *</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="Ej: 000123"
              value={form.numero_remito}
              onChange={(e) => set('numero_remito', e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Sección 2: Camión y Chofer */}
      <div>
        <p className="section-title mb-3">Camión y chofer</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Camión (matrícula) *</label>
            <select
              className="input"
              value={form.camion_id}
              onChange={(e) => set('camion_id', e.target.value)}
              required
            >
              <option value="">Seleccionar camión</option>
              {camiones.map((c) => (
                <option key={c.id} value={c.id}>{c.matricula}</option>
              ))}
            </select>
          </div>
          {isAdmin ? (
            <div className="form-group">
              <label className="label">Chofer *</label>
              <select
                className="input"
                value={form.chofer_id}
                onChange={(e) => set('chofer_id', e.target.value)}
                required
              >
                <option value="">Seleccionar chofer</option>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="label">Chofer</label>
              <input
                type="text"
                className="input bg-bg-primary"
                value={form.chofer_nombre}
                readOnly
              />
            </div>
          )}
        </div>
      </div>

      {/* Sección 3: Cliente, origen y destino */}
      <div>
        <p className="section-title mb-3">Carga y destino</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Cliente *</label>
            <select
              className="input"
              value={form.cliente_id}
              onChange={(e) => set('cliente_id', e.target.value)}
              required
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Destino *</label>
            {destinosDisponibles.length > 0 ? (
              <select
                className="input"
                value={form.destino}
                onChange={(e) => set('destino', e.target.value)}
                required
              >
                <option value="">Seleccionar destino</option>
                {destinosDisponibles.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="__otro__">Otro...</option>
              </select>
            ) : (
              <input
                type="text"
                className="input"
                placeholder="Ej: Tecomar"
                value={form.destino}
                onChange={(e) => set('destino', e.target.value)}
                required
              />
            )}
          </div>
          <div className="form-group">
            <label className="label">Origen</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Planta Urufor"
              value={form.origen}
              onChange={(e) => set('origen', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="label">Mercadería</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Tablas, Pinos, Madera"
              value={form.mercaderia}
              onChange={(e) => set('mercaderia', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sección 4: Peso y tarifa */}
      <div>
        <p className="section-title mb-3">Peso y facturación</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="form-group">
            <label className="label">Toneladas *</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input font-mono"
              placeholder="0.000"
              value={form.toneladas || ''}
              onChange={(e) => set('toneladas', parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Tarifa ($/ton)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input font-mono pr-8"
                placeholder="0.00"
                value={form.tarifa_aplicada || ''}
                onChange={(e) => {
                  const tar = parseFloat(e.target.value) || 0
                  set('tarifa_aplicada', tar)
                  set('importe', Math.round(tar * form.toneladas * 100) / 100)
                }}
              />
              <Calculator size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Importe total</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input font-mono font-semibold text-success"
              placeholder="0.00"
              value={form.importe || ''}
              onChange={(e) => set('importe', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Sección 5: Gastos */}
      <div>
        <p className="section-title mb-3">Gastos del viaje</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="form-group">
            <label className="label">Gasoil ($)</label>
            <input
              type="number" step="0.01" min="0"
              className="input font-mono"
              placeholder="0"
              value={form.gasto_gasoil || ''}
              onChange={(e) => set('gasto_gasoil', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="label">Litros gasoil</label>
            <input
              type="number" step="0.1" min="0"
              className="input font-mono"
              placeholder="0"
              value={form.litros_gasoil || ''}
              onChange={(e) => set('litros_gasoil', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="label">Comisión ($)</label>
            <input
              type="number" step="0.01" min="0"
              className="input font-mono"
              placeholder="0"
              value={form.comision || ''}
              onChange={(e) => set('comision', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="label">Peajes ($)</label>
            <input
              type="number" step="0.01" min="0"
              className="input font-mono"
              placeholder="0"
              value={form.peajes || ''}
              onChange={(e) => set('peajes', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Sección 6: Extras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">KM recorridos</label>
          <input
            type="number" step="1" min="0"
            className="input font-mono"
            placeholder="0"
            value={form.km || ''}
            onChange={(e) => set('km', parseFloat(e.target.value) || 0)}
          />
        </div>
        {isAdmin && (
          <div className="form-group">
            <label className="label">Estado de cobro</label>
            <select
              className="input"
              value={form.estado_cobro}
              onChange={(e) => set('estado_cobro', e.target.value as 'pendiente' | 'cobrado')}
            >
              <option value="pendiente">Pendiente</option>
              <option value="cobrado">Cobrado</option>
            </select>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">Notas</label>
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Observaciones adicionales..."
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
        />
      </div>

      {/* Resumen */}
      {(form.importe > 0 || form.gasto_gasoil > 0) && (
        <div className="bg-bg-primary border border-border-color rounded-xl p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-text-secondary">Importe</p>
            <p className="text-lg font-bold font-data text-success">
              ${form.importe.toLocaleString('es-UY')}
            </p>
          </div>
          <div className="text-center border-x border-border-color">
            <p className="text-xs text-text-secondary">Gastos</p>
            <p className="text-lg font-bold font-data text-danger">
              ${(form.gasto_gasoil + form.comision + form.peajes).toLocaleString('es-UY')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-secondary">Neto</p>
            <p className={`text-lg font-bold font-data ${
              form.importe - form.gasto_gasoil - form.comision - form.peajes >= 0
                ? 'text-accent-cyan'
                : 'text-danger'
            }`}>
              ${(form.importe - form.gasto_gasoil - form.comision - form.peajes).toLocaleString('es-UY')}
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Guardando...
          </>
        ) : submitLabel}
      </button>
    </form>
  )
}
