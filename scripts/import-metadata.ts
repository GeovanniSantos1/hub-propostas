#!/usr/bin/env tsx
/**
 * =============================================================================
 * Script de Importacao de Metadados - Hub Propostas
 * =============================================================================
 *
 * Importa APENAS os metadados (clientes + propostas) a partir dos nomes
 * das pastas e arquivos, SEM fazer upload dos arquivos para o Storage.
 *
 * COMO EXECUTAR:
 *   npx tsx scripts/import-metadata.ts
 *
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Carregar variaveis de ambiente do .env.local
// ---------------------------------------------------------------------------
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('[AVISO] Arquivo .env.local nao encontrado.')
    return
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile()

// ---------------------------------------------------------------------------
// Configuracao do Supabase
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERRO] Variaveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

const HUB_PATH = process.env.HUB_PROPOSTAS_PATH || 'C:\\Users\\Geovanni Santos\\Documents\\Hub Propostas'
const SKIP_FOLDERS = new Set(['_ARQUIVADO', '.superpowers', 'hub-propostas'])
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx'])
const MAX_DEPTH = 2

// Regex: YYYY_MM_DD_NomeCliente_PropXXXXx_Descricao.ext
const FILENAME_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(.+?)_Prop(\d{4}\w?)_(.+)$/i

function parseFilename(filename: string) {
  const nameWithoutExt = filename.replace(/\.\w+$/, '')
  const match = nameWithoutExt.match(FILENAME_PATTERN)
  if (!match) return null
  const [, year, month, day, clientName, propNumber, description] = match
  return {
    date: `${year}-${month}-${day}`,
    proposalNumber: `Prop${propNumber}`,
    description: description.replace(/_/g, ' '),
    clientName: clientName.replace(/_/g, ' '),
  }
}

function scanFiles(dirPath: string, currentDepth = 0): string[] {
  if (currentDepth > MAX_DEPTH) return []
  const files: string[] = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        files.push(...scanFiles(fullPath, currentDepth + 1))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.warn(`  [AVISO] Erro ao ler pasta ${dirPath}:`, error)
  }
  return files
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(' IMPORTACAO DE METADADOS - Hub Propostas')
  console.log('='.repeat(60))
  console.log(`Diretorio: ${HUB_PATH}`)
  console.log()

  if (!fs.existsSync(HUB_PATH)) {
    console.error(`[ERRO] Diretorio nao encontrado: ${HUB_PATH}`)
    process.exit(1)
  }

  const entries = fs.readdirSync(HUB_PATH, { withFileTypes: true })
  const clientFolders = entries
    .filter((e) => e.isDirectory() && !SKIP_FOLDERS.has(e.name))
    .map((e) => e.name)
    .sort()

  console.log(`Pastas de clientes encontradas: ${clientFolders.length}`)
  console.log()

  let clientsCreated = 0
  let clientsSkipped = 0
  let proposalsCreated = 0
  let proposalsSkipped = 0
  let filesRegistered = 0

  for (let i = 0; i < clientFolders.length; i++) {
    const folderName = clientFolders[i]
    const folderPath = path.join(HUB_PATH, folderName)
    const progress = `[${i + 1}/${clientFolders.length}]`

    process.stdout.write(`${progress} ${folderName}...`)

    // 1. Criar ou recuperar o cliente
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('folder_name', folderName)
      .limit(1)
      .single()

    let clientId: string

    if (existingClient?.id) {
      clientId = existingClient.id
      clientsSkipped++
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: folderName.trim(),
          full_name: folderName.trim(),
          folder_name: folderName,
          status: 'active',
        })
        .select('id')
        .single()

      if (error || !data) {
        console.log(` ERRO: ${error?.message}`)
        continue
      }
      clientId = data.id
      clientsCreated++
    }

    // 2. Escanear arquivos
    const files = scanFiles(folderPath)

    if (files.length === 0) {
      console.log(` 0 arquivos`)
      continue
    }

    // 3. Agrupar por numero de proposta
    const proposalGroups = new Map<string, string[]>()
    for (const filePath of files) {
      const fileName = path.basename(filePath)
      const parsed = parseFilename(fileName)
      const groupKey = parsed?.proposalNumber ?? `file:${fileName}`
      const existing = proposalGroups.get(groupKey) ?? []
      existing.push(filePath)
      proposalGroups.set(groupKey, existing)
    }

    // 4. Criar propostas e registrar arquivos (sem upload)
    let proposalsForClient = 0
    let filesForClient = 0

    for (const [, groupFiles] of proposalGroups) {
      const firstFile = groupFiles[0]
      const firstFileName = path.basename(firstFile)
      const parsed = parseFilename(firstFileName)

      const title = parsed
        ? `${parsed.proposalNumber} - ${parsed.description}`
        : firstFileName.replace(/\.\w+$/, '').replace(/_/g, ' ')

      const proposalNumber = parsed?.proposalNumber ?? null
      const proposalDate = parsed?.date ?? null

      // Verificar se ja existe
      let proposalId: string | null = null

      if (proposalNumber) {
        const { data } = await supabase
          .from('proposals')
          .select('id')
          .eq('client_id', clientId)
          .eq('proposal_number', proposalNumber)
          .limit(1)
          .single()
        proposalId = data?.id ?? null
      }

      if (!proposalId) {
        const { data: existingByTitle } = await supabase
          .from('proposals')
          .select('id')
          .eq('client_id', clientId)
          .eq('title', title)
          .limit(1)
          .single()
        proposalId = existingByTitle?.id ?? null
      }

      if (proposalId) {
        proposalsSkipped++
      } else {
        const { data, error } = await supabase
          .from('proposals')
          .insert({
            client_id: clientId,
            title,
            proposal_number: proposalNumber,
            proposal_date: proposalDate,
            original_filename: firstFileName,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error || !data) continue
        proposalId = data.id
        proposalsCreated++
        proposalsForClient++
      }

      // Registrar os arquivos (sem upload, apenas metadata)
      for (const filePath of groupFiles) {
        const fileName = path.basename(filePath)
        const fileSize = fs.statSync(filePath).size
        const fileExt = path.extname(fileName).toLowerCase().replace('.', '')

        // Caminho local como referencia (nao e URL do storage)
        const storagePath = `local://${filePath.replace(/\\/g, '/')}`

        const { error } = await supabase.from('proposal_files').insert({
          proposal_id: proposalId,
          file_name: fileName,
          file_type: fileExt,
          file_size: fileSize,
          storage_path: storagePath,
        })

        if (!error) {
          filesRegistered++
          filesForClient++
        }
      }
    }

    console.log(` ${proposalsForClient} propostas, ${filesForClient} arquivos`)
  }

  // Relatorio final
  console.log()
  console.log('='.repeat(60))
  console.log(' RELATORIO DE IMPORTACAO')
  console.log('='.repeat(60))
  console.log(`  Clientes criados:       ${clientsCreated}`)
  console.log(`  Clientes ja existentes: ${clientsSkipped}`)
  console.log(`  Propostas criadas:      ${proposalsCreated}`)
  console.log(`  Propostas ja existentes:${proposalsSkipped}`)
  console.log(`  Arquivos registrados:   ${filesRegistered}`)
  console.log('='.repeat(60))
  console.log()
  console.log('Importacao concluida! Acesse http://localhost:3000 para ver os dados.')
}

main().catch((error) => {
  console.error('[ERRO FATAL]', error)
  process.exit(1)
})
