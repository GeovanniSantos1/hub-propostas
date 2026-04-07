/**
 * API Route - Importacao de Clientes do Hub Propostas
 *
 * POST /api/import
 * Body: { hubPath: string }
 *
 * Cria registros de clientes no Supabase a partir dos nomes das pastas
 * encontradas no diretorio Hub Propostas. Nao faz upload de arquivos
 * (para upload completo, usar o script scripts/import-hub.ts).
 *
 * Requer papel de administrador.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as fs from 'fs'
import * as path from 'path'

// Pastas que devem ser ignoradas durante a importacao
const SKIP_FOLDERS = new Set(['_ARQUIVADO', '.superpowers', 'hub-propostas'])

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // Autenticacao e autorizacao
    // -----------------------------------------------------------------------
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

    // Verificar se o usuario e admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return Response.json(
        { error: 'Acesso negado. Somente administradores podem importar dados.' },
        { status: 403 },
      )
    }

    // -----------------------------------------------------------------------
    // Validar body
    // -----------------------------------------------------------------------
    const body = await request.json()
    const { hubPath } = body as { hubPath?: string }

    if (!hubPath) {
      return Response.json(
        { error: 'Campo hubPath e obrigatorio.' },
        { status: 400 },
      )
    }

    // Verificar se o diretorio existe
    if (!fs.existsSync(hubPath)) {
      return Response.json(
        { error: `Diretorio nao encontrado: ${hubPath}` },
        { status: 400 },
      )
    }

    // -----------------------------------------------------------------------
    // Listar pastas de clientes
    // -----------------------------------------------------------------------
    const entries = fs.readdirSync(hubPath, { withFileTypes: true })
    const clientFolders = entries
      .filter((e) => e.isDirectory() && !SKIP_FOLDERS.has(e.name))
      .map((e) => e.name)
      .sort()

    // -----------------------------------------------------------------------
    // Criar clientes que ainda nao existem
    // -----------------------------------------------------------------------
    let created = 0
    let skipped = 0
    let errors = 0
    const details: Array<{ folder: string; status: string; id?: string }> = []

    for (const folderName of clientFolders) {
      // Verificar se ja existe um cliente com esse folder_name
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('folder_name', folderName)
        .limit(1)
        .single()

      if (existing) {
        skipped++
        details.push({ folder: folderName, status: 'existente', id: existing.id })
        continue
      }

      // Contar os arquivos na pasta para informacao
      const folderPath = path.join(hubPath, folderName)
      let fileCount = 0
      try {
        const files = fs.readdirSync(folderPath)
        fileCount = files.filter((f) => {
          const ext = path.extname(f).toLowerCase()
          return ['.pdf', '.docx', '.pptx', '.xlsx'].includes(ext)
        }).length
      } catch {
        // Se nao conseguir ler, tudo bem
      }

      // Criar o cliente
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          name: folderName.trim(),
          full_name: folderName.trim(),
          folder_name: folderName,
          status: 'active',
          notes: `Importado automaticamente. ${fileCount} arquivo(s) encontrado(s) na pasta.`,
        })
        .select('id')
        .single()

      if (insertError) {
        errors++
        details.push({ folder: folderName, status: `erro: ${insertError.message}` })
      } else {
        created++
        details.push({ folder: folderName, status: 'criado', id: newClient?.id })
      }
    }

    // -----------------------------------------------------------------------
    // Retornar resultado
    // -----------------------------------------------------------------------
    return Response.json({
      message: `Importacao concluida: ${created} criados, ${skipped} existentes, ${errors} erros.`,
      summary: {
        total_folders: clientFolders.length,
        created,
        skipped,
        errors,
      },
      details,
    })
  } catch (error) {
    console.error('[API /import] Erro:', error)
    return Response.json(
      { error: 'Erro interno ao processar a importacao.' },
      { status: 500 },
    )
  }
}
