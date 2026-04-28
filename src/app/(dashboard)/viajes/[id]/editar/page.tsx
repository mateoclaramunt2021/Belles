'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ViajeForm, type ViajeFormData, type GasoilRow, type IncidenteRow } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Viaje, ViajeGasoil, Incidente } from '@/types'

export default function EditarViajePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [viaje, setViaje] = useState<Viaje | null>(null)
  const [gasoilRows, setGasoilRows] = useState<GasoilRow[]>([])
  const [incidenteRows, setIncidenteRows] = useState<IncidenteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const [{ data: v }, { data: g }, { data: inc }] = await Promise.all([
        supabase.from('viajes').select('*').eq('id', id).single(),
        supabase.from('viaje_gasoil').select('*').eq('viaje_id', id).order('orden'),
        supabase.from('incidentes').select('*').eq('viaje_id', id).order('created_at'),
      ])
      setViaje(v)
      setGasoilRows(
        (g ?? []).length > 0
          ? (g as ViajeGasoil[]).map(r => ({ litros: r.litros, km: r.km, estacion: r.estacion, importe: r.importe }))
          : [{ litros: v?.litros_gasoil ?? 0, km: 0, estacion: '', importe: v?.gasto_gasoil ?? 0 }]
      )
      setIncidenteRows(
        (inc as Incidente[] ?? []).map(i => ({ tipo: i.tipo, descripcion: i.descripcion, importe: i.importe }))
      )
      setLoading(false)
    }
    fetch()
  }, [id, supabase])

  const handleSubmit = async (data: ViajeFormData, gasoil: GasoilRow[], incidentes: IncidenteRow[]) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('viajes').update({
        fecha:                     data.fecha_carga || data.fecha,
        fecha_carga:               data.fecha_carga || data.fecha,
        fecha_descarga:            data.fecha_descarga || null,
        hora_entrada_carga:        data.hora_entrada_carga || null,
        hora_salida_carga:         data.hora_salida_carga || null,
        hora_entrada_descarga:     data.hora_entrada_descarga || null,
        hora_salida_descarga:      data.hora_salida_descarga || null,
        numero_remito:             data.numero_remito_carga || data.numero_remito,
        numero_remito_carga:       data.numero_remito_carga,
        numero_remito_descarga:    data.numero_remito_descarga,
        numero_planilla:           data.numero_planilla,
        matricula:                 data.matricula,
        mat_zorra:                 data.mat_zorra,
        camion_id:                 data.camion_id || null,
        chofer_id:                 data.chofer_id || null,
        chofer_nombre:             data.chofer_nombre,
        cliente_id:                data.cliente_id || null,
        cliente_nombre:            data.cliente_nombre,
        origen:                    data.origen,
        destino:                   data.destino,
        mercaderia:                data.mercaderia,
        km:                        data.km,
        km_carga:                  data.km_carga,
        km_descarga:               data.km_descarga,
        kg_bruto:                  data.kg_bruto,
        kg_tara:                   data.kg_tara,
        kg_neto:                   data.kg_neto,
        toneladas:                 data.toneladas,
        tipo_precio:               data.tipo_precio,
        tarifa_aplicada:           data.tarifa_aplicada,
        precio_por_unidad:         data.precio_por_unidad,
        importe:                   data.importe,
        gasto_gasoil:              data.gasto_gasoil,
        litros_gasoil:             data.litros_gasoil,
        comision:                  data.comision,
        peajes:                    data.peajes,
        imprevistos:               data.imprevistos,
        estado_cobro:              data.estado_cobro,
        medio_pago:                data.medio_pago || null,
        fecha_cobro:               data.fecha_cobro || null,
        numero_factura:            data.numero_factura || null,
        foto_url:                  data.foto_url || null,
        foto_remito_descarga_url:  data.foto_remito_descarga_url || null,
        notas:                     data.notas || null,
      }).eq('id', id)

      if (error) { toast.error(`Error: ${error.message}`); return }

      // Actualizar gasoil: borrar los existentes y re-insertar
      await supabase.from('viaje_gasoil').delete().eq('viaje_id', id)
      const gasoilValido = gasoil.filter(g => g.litros > 0 || g.importe > 0)
      if (gasoilValido.length > 0) {
        await supabase.from('viaje_gasoil').insert(
          gasoilValido.map((g, i) => ({ viaje_id: id, ...g, orden: i + 1 }))
        )
      }

      // Actualizar incidentes: borrar y re-insertar
      await supabase.from('incidentes').delete().eq('viaje_id', id)
      const incidentesValidos = incidentes.filter(i => i.descripcion.trim())
      if (incidentesValidos.length > 0) {
        await supabase.from('incidentes').insert(
          incidentesValidos.map(i => ({ viaje_id: id, ...i }))
        )
      }

      toast.success('Viaje actualizado correctamente')
      router.push('/viajes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-accent-cyan" />
      </div>
    )
  }

  if (!viaje) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary">Viaje no encontrado</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4 text-sm">Volver</button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">Editar viaje</h1>
          <p className="text-text-secondary text-sm mt-0.5 font-mono">
            Planilla #{viaje.numero_planilla || '—'} · Remito {viaje.numero_remito_carga || viaje.numero_remito}
          </p>
        </div>
      </div>

      <div className="card">
        <ViajeForm
          initialData={viaje as unknown as Record<string, unknown>}
          initialGasoil={gasoilRows}
          initialIncidentes={incidenteRows}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
          loading={saving}
        />
      </div>
    </div>
  )
}
