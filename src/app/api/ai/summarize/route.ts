/**
 * API Route - Sumarizacao de Proposta com IA
 *
 * POST /api/ai/summarize
 * Body: { proposalId: string }
 *
 * Busca os arquivos da proposta, extrai o texto do primeiro arquivo
 * legivel (PDF, DOCX ou PPTX), gera um resumo via Claude e atualiza
 * o campo description da proposta com ai_generated = true.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { summarizeProposal } from '@/lib/ai/summarize'
import { getContainerClient } from '@/lib/azure/storage'
// Imports dinâmicos dos parsers para evitar problemas no build
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
      throw new Error(`Tipo não suportado: ${type}`)
  }
}

// Tipos de arquivo dos quais conseguimos extrair texto
const PARSEABLE_TYPES = new Set(['pdf', 'docx', 'pptx'])

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

    // Validar body
    const body = await request.json()
    const { proposalId } = body as { proposalId?: string }

    if (!proposalId) {
      return Response.json(
        { error: 'Campo proposalId e obrigatorio.' },
        { status: 400 },
      )
    }

    // Buscar os arquivos da proposta
    const { data: files, error: filesError } = await supabase
      .from('proposal_files')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true })

    if (filesError) {
      return Response.json(
        { error: 'Erro ao buscar arquivos da proposta.' },
        { status: 500 },
      )
    }

    if (!files || files.length === 0) {
      return Response.json(
        { error: 'Nenhum arquivo encontrado para esta proposta.' },
        { status: 404 },
      )
    }

    // Encontrar o primeiro arquivo com tipo suportado para extracao
    const parseableFile = files.find(
      (f) => f.file_type && PARSEABLE_TYPES.has(f.file_type),
    )

    if (!parseableFile) {
      return Response.json(
        { error: 'Nenhum arquivo com formato suportado (PDF, DOCX, PPTX) encontrado.' },
        { status: 400 },
      )
    }

    // Baixar o arquivo do Azure Blob Storage (ou Supabase como fallback)
    let buffer: Buffer

    try {
      const containerClient = getContainerClient()
      const blobClient = containerClient.getBlockBlobClient(parseableFile.storage_path)
      const downloadResponse = await blobClient.download()
      const downloadBuffer = await blobClient.downloadToBuffer()
      buffer = downloadBuffer
    } catch {
      // Fallback: tentar Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('proposals')
        .download(parseableFile.storage_path)

      if (downloadError || !fileData) {
        return Response.json(
          { error: 'Erro ao baixar o arquivo do storage.' },
          { status: 500 },
        )
      }

      const arrayBuffer = await fileData.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    // Extrair texto conforme o tipo do arquivo
    let text = ''

    try {
      text = await extractText(buffer, parseableFile.file_type!)
    } catch {
      return Response.json(
        { error: `Tipo de arquivo nao suportado: ${parseableFile.file_type}` },
        { status: 400 },
      )
    }

    if (!text.trim()) {
      return Response.json(
        { error: 'Nao foi possivel extrair texto do arquivo.' },
        { status: 400 },
      )
    }

    // Gerar resumo com IA
    const summary = await summarizeProposal(text)

    // Atualizar a proposta com o resumo
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        description: summary,
        ai_generated: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      return Response.json(
        { error: 'Resumo gerado, mas falha ao salvar no banco.' },
        { status: 500 },
      )
    }

    return Response.json({ summary })
  } catch (error) {
    console.error('[API /ai/summarize] Erro:', error)
    return Response.json(
      { error: 'Erro interno ao processar a sumarizacao.' },
      { status: 500 },
    )
  }
}
