import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const OCR_PROMPT = `Analiza esta foto de un remito de transporte de Urufor S.A. (Uruguay).
Extrae los siguientes datos y devuélvelos SOLO como JSON válido sin explicaciones ni texto extra:

{
  "fecha": "YYYY-MM-DD",
  "numero_remito": "número del remito",
  "matricula": "matrícula completa del camión (ej: FTP3448)",
  "chofer": "nombre completo del conductor",
  "destino": "depósito de descarga (ej: Tecomar, Durazno, La Punta, Schandy)",
  "toneladas": número decimal del peso neto en toneladas,
  "cliente": "nombre del cliente/destinatario (ej: Urufor SA)",
  "mercaderia": "tipo de mercadería (ej: Tablas, Pinos, Madera)"
}

Instrucciones importantes:
- El remito tiene dos partes: ticket de balanza (térmico) con pesos bruto/tara/neto, y documento de salida de mercadería.
- El peso neto está en kg — convertirlo a toneladas dividiendo por 1000.
- Buscar "Dep. Descarga" o "Destino" para obtener el destino.
- La matrícula puede estar en campo "Matrícula" o "Truck#" — si solo aparece el número, agregar prefijo FTP.
- Si no podés leer algún campo claramente, usar null para ese campo.
- Devolver SOLO el JSON, sin ningún texto adicional.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    // Validar tipo y tamaño
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
    if (!allowedTypes.includes(file.type) && !file.type.includes('image')) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen supera el tamaño máximo de 10MB' }, { status: 400 })
    }

    // Convertir a base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Determinar media type para Anthropic
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
    if (file.type === 'image/png') mediaType = 'image/png'
    else if (file.type === 'image/webp') mediaType = 'image/webp'
    else if (file.type === 'image/gif') mediaType = 'image/gif'

    // Llamar a Claude Vision
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: OCR_PROMPT,
            },
          ],
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extraer JSON de la respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'No se pudo extraer datos del remito', raw: responseText },
        { status: 422 }
      )
    }

    const extracted = JSON.parse(jsonMatch[0])

    return NextResponse.json({ success: true, data: extracted })
  } catch (error) {
    console.error('Error en OCR:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Error de API: ${error.message}` },
        { status: error.status ?? 500 }
      )
    }

    return NextResponse.json(
      { error: 'Error procesando la imagen' },
      { status: 500 }
    )
  }
}
