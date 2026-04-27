'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ViajeForm } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Viaje } from '@/types'

export default function EditarViajePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [viaje, setViaje] = useState<Viaje | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('viajes')
        .select('*')
        .eq('id', id)
        .single()
      setViaje(data)
      setLoading(false)
    }
    fetch()
  }, [id, supabase])

  const handleSubmit = async (data: ReturnType<typeof Object.assign>) => {
    setSaving(true)
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
      .eq('id', id)

    setSaving(false)

    if (error) {
      toast.error(`Error al actualizar: ${error.message}`)
    } else {
      toast.success('Viaje actualizado correctamente')
      router.push('/viajes')
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
        <button onClick={() => router.back()} className="btn-secondary mt-4 text-sm">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">Editar viaje</h1>
          <p className="text-text-secondary text-sm mt-0.5 font-mono">Remito #{viaje.numero_remito}</p>
        </div>
      </div>

      <div className="card">
        <ViajeForm
          initialData={viaje as unknown as Record<string, unknown>}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
          loading={saving}
        />
      </div>
    </div>
  )
}
