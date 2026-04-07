/**
 * API Route - Upload Inteligente de Propostas
 *
 * POST /api/upload
 *
 * Recebe um ou mais arquivos via FormData, faz upload para o Azure Blob Storage,
 * cria/encontra o cliente e a proposta no Supabase, e retorna os dados criados.
 *
 * FormData fields:
 *   - files: File[]           (obrigatorio)
 *   - clientName: string      (opcional - override do nome detectado)
 *   - clientId: string        (opcional - se ja souber o cliente)
 *   - proposalTitle: string   (opcional - override do titulo)
 *   - proposalNumber: string  (opcional - override do numero)
 *   - proposalDate: string    (opcional - override da data, formato YYYY-MM-DD)
 *   - status: string          (opcional - draft|sent|negotiating|won|lost)
 *   - value: string           (opcional - valor em reais)
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getContainerClient } from '@/lib/azure/storage'
import {
  parseProposalFilename,
  buildProposalTitle,
  guessClientFromFilename,
} from '@/lib/parse-filename'
import { analyzeProposal, type ProposalAnalysis } from '@/lib/ai/analyze-proposal'

// Tipos de arquivo dos quais conseguimos extrair texto para analise IA
const PARSEABLE_TYPES = new Set(['pdf', 'docx', 'pptx'])

async function extractText(buffer: Buffer, type: string): Promise<string> {
  switch (type) {
    case 'pdf': {
      const { extractPdfText } = await import('@/lib/parsers/pdf')
      return extractPdfText(buffer)
    }
    case 'docx': {
      const { extractDocxText } = await import('@/lib/parsers/docx')
      return extractDocxText(buffer)
    }
    case 'pptx': {
      const { extractPptxText } = await import('@/lib/parsers/pptx')
      return extractPptxText(buffer)
    }
    default:
      return ''
  }
}

const CONTENT_TYPES: Record<string, string> = {
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function sanitizeBlobName(name: string): string {
  return name.replace(/\\/g, '/').replace(/[#?%]/g, '_')
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticacao
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { error: 'Nao autorizado. Faca login para continuar.' },
        { status: 401 },
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return Response.json(
        { error: 'Nenhum arquivo enviado.' },
        { status: 400 },
      )
    }

    // Campos opcionais do form
    const overrideClientName = formData.get('clientName') as string | null
    const overrideClientId = formData.get('clientId') as string | null
    const overrideTitle = formData.get('proposalTitle') as string | null
    const overrideNumber = formData.get('proposalNumber') as string | null
    const overrideDate = formData.get('proposalDate') as string | null
    const overrideStatus = (formData.get('status') as string) || 'draft'
    const overrideValue = formData.get('value') as string | null

    // Extrair metadados do primeiro arquivo
    const firstFile = files[0]
    const parsed = parseProposalFilename(firstFile.name)

    // -----------------------------------------------------------------------
    // 1. Resolver o cliente
    // -----------------------------------------------------------------------
    let clientId = overrideClientId || null

    if (!clientId) {
      const clientName = overrideClientName
        || parsed?.clientName
        || guessClientFromFilename(firstFile.name)

      if (!clientName) {
        return Response.json(
          { error: 'Nao foi possivel identificar o cliente pelo nome do arquivo. Informe o nome do cliente.' },
          { status: 400 },
        )
      }

      // Buscar cliente por nome (case-insensitive)
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', clientName)
        .limit(1)
        .single()

      if (existingClient) {
        clientId = existingClient.id
      } else {
        // Tentar busca parcial (o nome pode estar abreviado)
        const { data: partialClients } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', `%${clientName}%`)
          .limit(1)

        if (partialClients && partialClients.length > 0) {
          clientId = partialClients[0].id
        } else {
          // Criar novo cliente
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              name: clientName,
              full_name: clientName,
              folder_name: clientName,
              status: 'active',
              created_by: user.id,
            })
            .select('id')
            .single()

          if (clientError || !newClient) {
            return Response.json(
              { error: `Erro ao criar cliente: ${clientError?.message}` },
              { status: 500 },
            )
          }

          clientId = newClient.id
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. Criar a proposta
    // -----------------------------------------------------------------------
    const proposalTitle = overrideTitle
      || (parsed ? buildProposalTitle(parsed) : firstFile.name.replace(/\.\w+$/, '').replace(/_/g, ' '))

    const proposalNumber = overrideNumber || parsed?.proposalNumber || null
    const proposalDate = overrideDate || parsed?.date || null

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        client_id: clientId,
        title: proposalTitle,
        proposal_number: proposalNumber,
        proposal_date: proposalDate,
        status: overrideStatus,
        value: overrideValue ? parseFloat(overrideValue) : null,
        original_filename: firstFile.name,
        created_by: user.id,
      })
      .select('id, title')
      .single()

    if (proposalError || !proposal) {
      return Response.json(
        { error: `Erro ao criar proposta: ${proposalError?.message}` },
        { status: 500 },
      )
    }

    // -----------------------------------------------------------------------
    // 3. Upload dos arquivos para Azure e registro no banco
    // -----------------------------------------------------------------------
    const containerClient = getContainerClient()
    const uploadedFiles: { id: string; fileName: string }[] = []
    const errors: string[] = []

    // Buscar folder_name do cliente para organizar no Azure
    const { data: clientData } = await supabase
      .from('clients')
      .select('name, folder_name')
      .eq('id', clientId)
      .single()

    const folderName = clientData?.folder_name || clientData?.name || 'unknown'

    // Buffer do primeiro arquivo parseavel (para analise IA)
    let firstParseableBuffer: Buffer | null = null
    let firstParseableType = ''

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const blobPath = sanitizeBlobName(`${folderName}/${file.name}`)

        // Guardar o primeiro arquivo parseavel para analise IA
        if (!firstParseableBuffer && PARSEABLE_TYPES.has(ext)) {
          firstParseableBuffer = buffer
          firstParseableType = ext
        }

        // Upload para Azure
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
        await blockBlobClient.upload(buffer, buffer.length, {
          blobHTTPHeaders: {
            blobContentType: CONTENT_TYPES[ext] || 'application/octet-stream',
            blobContentDisposition: `inline; filename="${encodeURIComponent(file.name)}"`,
          },
        })

        // Registrar no banco
        const { data: fileRecord, error: fileError } = await supabase
          .from('proposal_files')
          .insert({
            proposal_id: proposal.id,
            file_name: file.name,
            file_type: ext,
            file_size: file.size,
            storage_path: blobPath,
          })
          .select('id')
          .single()

        if (fileError) {
          errors.push(`${file.name}: ${fileError.message}`)
        } else if (fileRecord) {
          uploadedFiles.push({ id: fileRecord.id, fileName: file.name })
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      }
    }

    // -----------------------------------------------------------------------
    // 4. Analise com IA (extrair texto e gerar resumo)
    // -----------------------------------------------------------------------
    let analysis: ProposalAnalysis | null = null

    if (firstParseableBuffer && process.env.OPENAI_API_KEY) {
      try {
        const text = await extractText(firstParseableBuffer, firstParseableType)

        if (text.trim()) {
          analysis = await analyzeProposal(text)

          // Atualizar proposta com resumo e valor extraido pela IA
          const updates: Record<string, unknown> = {
            description: analysis.summary,
            ai_generated: true,
          }

          // Se a IA encontrou valor e o usuario nao informou, usar o da IA
          if (analysis.value && !overrideValue) {
            updates.value = analysis.value
          }

          await supabase
            .from('proposals')
            .update(updates)
            .eq('id', proposal.id)
        }
      } catch (aiError) {
        console.error('[API /upload] Erro na analise IA:', aiError)
        // Nao falhar o upload por causa de erro na IA
      }
    }

    return Response.json({
      success: true,
      proposal: {
        id: proposal.id,
        title: proposal.title,
      },
      clientId,
      clientName: clientData?.name || overrideClientName,
      files: uploadedFiles,
      analysis: analysis || undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[API /upload] Erro:', error)
    return Response.json(
      { error: 'Erro interno ao processar o upload.' },
      { status: 500 },
    )
  }
}
