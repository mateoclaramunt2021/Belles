'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { OCRCapture } from '@/components/viajes/OCRCapture'
import { ViajeForm, defaultFormData } from '@/components/viajes/ViajeForm'
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
    // Mapear resultado OCR a campos del formulario
    const mapped: Partial<typeof defaultFormData> = {
      foto_url:       fotoUrl,
      fecha:          result.fecha ?? defaultFormData.fecha,
      numero_remito:  result.numero_remito ?? '',
      matricula:      result.matricula ?? '',
      chofer_nombre:  result.chofer ?? '',
      destino:        result.destino ?? '',
      toneladas:      result.toneladas ?? 0,
      cliente_nombre: result.cliente ?? '',
      mercaderia:     result.mercaderia ?? '',
    }
    setFormInitialData(mapped)
    setStep('form')
  }

  const handleSkipOCR = () => {
    setFormInitialData({})
    setStep('form')
  }

  const handleSubmit = async (data: typeof defaultFormData) => {
    setSaveLoading(true)
    const { error } = await supabase.from('viajes').insert({
      fecha:           data.fecha,
      numero_remito:   data.numero_remito,
      matricula:       data.matricula,
      camion_id:       data.camion_id || null,
      chofer_id:       data.chofer_id || profile?.id || null,
      chofer_nombre:   data.chofer_nombre || profile?.nombre || '',
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
      foto_url:        data.foto_url || null,
      notas:           data.notas || null,
      created_by:      profile?.id ?? null,
    })

    setSaveLoading(false)

    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
      return
    }

    toast.success('¡Viaje registrado correctamente!')
    router.push('/viajes')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
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
            {step === 'capture' ? 'Fotografía del remito' : 'Confirmación de datos'}
          </p>
        </div>
      </div>

      {/* Pasos */}
      <div className="flex items-center gap-2">
        {[
          { id: 'capture', icon: Camera, label: 'Foto' },
          { id: 'form',    icon: FileText, label: 'Datos' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px flex-1 w-8 ${step === 'form' ? 'bg-accent-cyan' : 'bg-border-color'}`} />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              step === s.id
                ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                : step === 'form' && s.id === 'capture'
                ? 'text-success'
                : 'text-text-secondary'
            }`}>
              <s.icon size={13} />
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Contenido */}
      <div className="card">
        {step === 'capture' ? (
          <>
            <h2 className="text-base font-semibold text-text-primary mb-4">
              Sacar foto del remito
            </h2>
            <p className="text-text-secondary text-sm mb-5">
              Fotografiá el remito de carga. La IA va a extraer automáticamente todos los datos.
            </p>
            <OCRCapture
              onResult={handleOCRResult}
              onSkip={handleSkipOCR}
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-text-primary flex-1">
                Confirmar datos del viaje
              </h2>
              {formInitialData.foto_url && (
                <span className="text-xs bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded-full">
                  Datos del remito
                </span>
              )}
            </div>
            <ViajeForm
              initialData={formInitialData}
              onSubmit={handleSubmit}
              submitLabel="Confirmar y guardar viaje"
              loading={saveLoading}
            />
          </>
        )}
      </div>
    </div>
  )
}
