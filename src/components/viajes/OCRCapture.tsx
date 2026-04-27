'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Upload, Loader2, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'
import type { OCRResult } from '@/types'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface OCRCaptureProps {
  onResult: (result: OCRResult, fotoUrl: string) => void
  onSkip: () => void
}

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export function OCRCapture({ onResult, onSkip }: OCRCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const processImage = async (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setStatus('uploading')
    setErrorMsg('')

    try {
      // 1. Subir al storage de Supabase
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const ext = file.name.split('.').pop() ?? 'jpg'
      const fileName = `${user.id}/${Date.now()}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('remitos')
        .upload(fileName, file, { contentType: file.type, upsert: false })

      if (uploadError) throw new Error(`Error subiendo imagen: ${uploadError.message}`)

      const { data: { publicUrl } } = supabase.storage
        .from('remitos')
        .getPublicUrl(uploadData.path)

      // 2. Llamar al OCR
      setStatus('processing')
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Error procesando el remito')
      }

      setStatus('done')
      toast.success('¡Remito procesado correctamente!')
      onResult(json.data as OCRResult, publicUrl)
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMsg(msg)
      toast.error(msg)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImage(file)
  }

  const reset = () => {
    setStatus('idle')
    setPreview(null)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Vista según estado */}
      {status === 'idle' && (
        <div className="space-y-3">
          {/* Botón principal: cámara del celular */}
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full bg-accent-cyan/10 border-2 border-dashed border-accent-cyan/40
                       rounded-2xl p-8 flex flex-col items-center gap-3
                       hover:bg-accent-cyan/15 hover:border-accent-cyan/60
                       active:scale-[0.98] transition-all duration-200"
          >
            <div className="w-16 h-16 rounded-full bg-accent-cyan/20 flex items-center justify-center">
              <Camera size={32} className="text-accent-cyan" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-text-primary">Sacar foto del remito</p>
              <p className="text-xs text-text-secondary mt-1">Toca para abrir la cámara</p>
            </div>
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border-color" />
            <span className="text-xs text-text-secondary">o</span>
            <div className="flex-1 border-t border-border-color" />
          </div>

          <div className="flex gap-2">
            {/* Cargar desde galería */}
            <button
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.removeAttribute('capture')
                  inputRef.current.click()
                  setTimeout(() => inputRef.current?.setAttribute('capture', 'environment'), 500)
                }
              }}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              <Upload size={16} />
              Subir foto
            </button>
            {/* Saltar OCR */}
            <button
              onClick={onSkip}
              className="btn-ghost text-sm px-4"
            >
              Ingresar manual
            </button>
          </div>
        </div>
      )}

      {/* Estado: procesando */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="space-y-4">
          {preview && (
            <div className="relative w-full h-52 rounded-xl overflow-hidden border border-border-color">
              <Image src={preview} alt="Remito" fill className="object-contain" />
              <div className="absolute inset-0 bg-bg-primary/70 flex flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-accent-cyan" />
                <p className="text-sm font-medium text-text-primary">
                  {status === 'uploading' ? 'Subiendo imagen...' : 'Leyendo remito con IA...'}
                </p>
                <p className="text-xs text-text-secondary">Esto puede tardar unos segundos</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado: done */}
      {status === 'done' && preview && (
        <div className="space-y-3">
          <div className="relative w-full h-40 rounded-xl overflow-hidden border border-success/30">
            <Image src={preview} alt="Remito" fill className="object-contain" />
            <div className="absolute top-2 right-2 bg-success/20 border border-success/40 rounded-full px-3 py-1 flex items-center gap-1.5">
              <CheckCircle size={14} className="text-success" />
              <span className="text-xs text-success font-medium">Procesado</span>
            </div>
          </div>
        </div>
      )}

      {/* Estado: error */}
      {status === 'error' && (
        <div className="space-y-3">
          {preview && (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-danger/30">
              <Image src={preview} alt="Remito" fill className="object-contain" />
            </div>
          )}
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">Error al procesar</p>
              <p className="text-xs text-text-secondary mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
              <RotateCcw size={14} />
              Intentar de nuevo
            </button>
            <button onClick={onSkip} className="btn-ghost text-sm px-4">
              Ingresar manual
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
