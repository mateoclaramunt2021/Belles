'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { OCRCapture } from '@/components/viajes/OCRCapture'
import { ViajeForm, defaultFormData, type ViajeFormData, type GasoilRow, type IncidenteRow } from '@/components/viajes/ViajeForm'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, FileText } from 'lucide-react'
import type { OCRResult } from '@/types'

type Step = 'capture' | 'form'

export default function NuevoViajePage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuth()

  const [step, setStep] = useState<Step>('capture')
  const [formInitialData, setFormInitialData] = useState<Partial<typeof defaultFormData>>({})
  const [saveLoading, setSaveLoading] = useState(false)

  const handleOCRResult = (result: OCRResult, fotoUrl: string) => {
    const mapped: Partial<typeof defaultFormData> = {
      foto_url:              fotoUrl,
      fecha:                 result.fecha ?? defaultFormData.fecha,
      fecha_carga:           result.fecha ?? defaultFormData.fecha_carga,
      numero_remito:         result.numero_remito ?? '',
      numero_remito_carga:   result.numero_remito ?? '',
      matricula:             result.matricula ?? '',
      mat_zorra:             result.mat_zorra ?? '',
      chofer_nombre:         result.chofer ?? '',
      destino:               result.destino ?? '',
      origen:                result.origen ?? '',
      toneladas:             result.toneladas ?? 0,
      kg_bruto:              result.kg_bruto ?? 0,
      kg_tara:               result.kg_tara ?? 0,
      kg_neto:               result.kg_neto ?? 0,
      cliente_nombre:        result.cliente ?? '',
      mercaderia:            result.mercaderia ?? '',
      km_carga:              result.km_carga ?? 0,
      km_descarga:           result.km_descarga ?? 0,
    }
    setFormInitialData(mapped)
    setStep('form')
  }

  const handleSkipOCR = () => {
    setFormInitialData({})
    setStep('form')
  }

  const handleSubmit = async (data: ViajeFormData, gasoil: GasoilRow[], incidentes: IncidenteRow[]) => {
    setSaveLoading(true)
    try {
      const { data: viajeCreado, error } = await supabase.from('viajes').insert({
        fecha:                     data.fecha_carga || data.fecha,
        fecha_carga:               data.fecha_carga || data.fecha,
        fecha_descarga:            data.fecha_descarga || null,
        hora_entrada_carga:        data.hora_entrada_carga || null,
        hora_salida_carga:         data.hora_salida_carga || null,
        hora_entrada_descarga:     data.hora_entrada_descarga || null,
        hora_salida_descarga:      data.hora_salida_descarga || null,
        numero_remito:             data.numero_remito_carga || data.numero_remito,
        numero_remito_carga:       data.numero_remito_carga,
        numero_remito_descarga:    data.numero_remito_descarga || '',
        numero_planilla:           data.numero_planilla || '',
        matricula:                 data.matricula,
        mat_zorra:                 data.mat_zorra || '',
        camion_id:                 data.camion_id || null,
        chofer_id:                 data.chofer_id || profile?.id || null,
        chofer_nombre:             data.chofer_nombre || profile?.nombre || '',
        cliente_id:                data.cliente_id || null,
        cliente_nombre:            data.cliente_nombre,
        origen:                    data.origen,
        destino:                   data.destino,
        mercaderia:                data.mercaderia,
        km:                        data.km || 0,
        km_carga:                  data.km_carga || 0,
        km_descarga:               data.km_descarga || 0,
        kg_bruto:                  data.kg_bruto || 0,
        kg_tara:                   data.kg_tara || 0,
        kg_neto:                   data.kg_neto || 0,
        toneladas:                 data.toneladas,
        tipo_precio:               data.tipo_precio,
        tarifa_aplicada:           data.tarifa_aplicada,
        precio_por_unidad:         data.precio_por_unidad || 0,
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
        created_by:                profile?.id ?? null,
      }).select('id').single()

      if (error) { toast.error(`Error: ${error.message}`); return }

      const viajeId = viajeCreado.id

      // Guardar registros de gasoil
      const gasoilValido = gasoil.filter(g => g.litros > 0 || g.importe > 0)
      if (gasoilValido.length > 0) {
        await supabase.from('viaje_gasoil').insert(
          gasoilValido.map((g, i) => ({ viaje_id: viajeId, ...g, orden: i + 1 }))
        )
      }

      // Guardar incidentes
      const incidentesValidos = incidentes.filter(i => i.descripcion.trim())
      if (incidentesValidos.length > 0) {
        await supabase.from('incidentes').insert(
          incidentesValidos.map(i => ({ viaje_id: viajeId, ...i }))
        )
      }

      toast.success('¡Viaje registrado correctamente!')
      router.push('/viajes')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === 'form' ? setStep('capture') : router.back()}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">Nuevo viaje</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {step === 'capture' ? 'Fotografía del remito' : 'Completar datos del viaje'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[
          { id: 'capture', icon: Camera, label: 'Foto remito' },
          { id: 'form', icon: FileText, label: 'Datos del viaje' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-8 ${step === 'form' ? 'bg-accent-cyan' : 'bg-border-color'}`} />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              step === s.id
                ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                : step === 'form' && s.id === 'capture' ? 'text-success' : 'text-text-secondary'
            }`}>
              <s.icon size={13} />
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        {step === 'capture' ? (
          <>
            <h2 className="text-base font-semibold text-text-primary mb-2">Sacar foto del remito</h2>
            <p className="text-text-secondary text-sm mb-5">
              Fotografiá el remito de carga. La IA extrae automáticamente todos los datos del formulario.
            </p>
            <OCRCapture onResult={handleOCRResult} onSkip={handleSkipOCR} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-text-primary flex-1">Datos del viaje</h2>
              {formInitialData.foto_url && (
                <span className="text-xs bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded-full">
                  Pre-llenado con OCR
                </span>
              )}
            </div>
            <ViajeForm
              initialData={formInitialData}
              onSubmit={handleSubmit}
              submitLabel="Guardar viaje"
              loading={saveLoading}
            />
          </>
        )}
      </div>
    </div>
  )
}
