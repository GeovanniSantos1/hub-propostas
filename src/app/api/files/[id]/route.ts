/**
 * API Route - Acesso a arquivos do Azure Blob Storage
 *
 * GET /api/files/:id
 *
 * Busca o registro do arquivo no Supabase, gera uma URL assinada (SAS)
 * temporaria do Azure Blob Storage e redireciona o usuario para o arquivo.
 *
 * Query params opcionais:
 *   - download=true  -> forca download ao inves de abrir inline
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBlobSasUrl } from '@/lib/azure/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

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

    // Buscar o arquivo no banco
    const { data: file, error: fileError } = await supabase
      .from('proposal_files')
      .select('*')
      .eq('id', id)
      .single()

    if (fileError || !file) {
      return Response.json(
        { error: 'Arquivo nao encontrado.' },
        { status: 404 },
      )
    }

    // Gerar URL assinada com validade de 60 minutos
    const sasUrl = generateBlobSasUrl(file.storage_path, 60)

    // Redirecionar para a URL assinada do Azure
    return Response.redirect(sasUrl, 302)
  } catch (error) {
    console.error('[API /files/:id] Erro:', error)
    return Response.json(
      { error: 'Erro interno ao acessar o arquivo.' },
      { status: 500 },
    )
  }
}
