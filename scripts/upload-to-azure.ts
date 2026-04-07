#!/usr/bin/env tsx
/**
 * =============================================================================
 * Script de Upload para Azure Blob Storage - Hub Propostas
 * =============================================================================
 *
 * Faz upload de TODOS os arquivos (PDF, DOCX, PPTX, XLSX) das pastas de
 * clientes para o Azure Blob Storage e atualiza os registros no Supabase.
 *
 * COMO EXECUTAR:
 *   npx tsx scripts/upload-to-azure.ts
 *
 * VARIAVEIS DE AMBIENTE NECESSARIAS (definir no .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - AZURE_STORAGE_CONNECTION_STRING
 *   - AZURE_STORAGE_CONTAINER_NAME
 *   - HUB_PROPOSTAS_PATH
 *
 * COMPORTAMENTO:
 *   - Idempotente: verifica se o arquivo ja foi enviado pelo blob_path antes de upload
 *   - Cria registros de clientes e propostas quando necessario
 *   - Atualiza proposal_files.storage_path com o caminho do Azure Blob
 *   - Pula pastas _ARQUIVADO, .superpowers e hub-propostas
 *
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import { BlobServiceClient } from '@azure/storage-blob'
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
// Configuracao
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'hub-propostas'
const HUB_PATH = process.env.HUB_PROPOSTAS_PATH || 'C:\\Users\\Geovanni Santos\\Documents\\Hub Propostas'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERRO] NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.')
  process.exit(1)
}

if (!azureConnectionString || azureConnectionString === 'your_connection_string_here') {
  console.error('[ERRO] AZURE_STORAGE_CONNECTION_STRING e obrigatoria.')
  console.error('  Obtenha no Portal Azure > Storage Account > Access Keys > Connection string')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString)
const containerClient = blobServiceClient.getContainerClient(containerName)

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const SKIP_FOLDERS = new Set(['_ARQUIVADO', '.superpowers', 'hub-propostas'])
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx'])
const MAX_DEPTH = 3

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const FILENAME_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(.+?)_Prop(\d{4,5}\w?)_(.+)$/i

// ---------------------------------------------------------------------------
// Funcoes auxiliares
// ---------------------------------------------------------------------------

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

/**
 * Sanitiza o nome do blob para o Azure (remove caracteres problematicos)
 */
function sanitizeBlobName(name: string): string {
  return name
    .replace(/\\/g, '/')
    .replace(/[#?%]/g, '_')
}

async function findClientByFolderName(folderName: string): Promise<string | null> {
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('folder_name', folderName)
    .limit(1)
    .single()
  return data?.id ?? null
}

async function createClientRecord(folderName: string): Promise<string | null> {
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

  if (error) {
    console.error(`  [ERRO] Falha ao criar cliente "${folderName}":`, error.message)
    return null
  }
  return data?.id ?? null
}

async function findProposal(clientId: string, proposalNumber: string | null, title: string): Promise<string | null> {
  if (proposalNumber) {
    const { data } = await supabase
      .from('proposals')
      .select('id')
      .eq('client_id', clientId)
      .eq('proposal_number', proposalNumber)
      .limit(1)
      .single()
    if (data?.id) return data.id
  }

  const { data } = await supabase
    .from('proposals')
    .select('id')
    .eq('client_id', clientId)
    .eq('title', title)
    .limit(1)
    .single()
  return data?.id ?? null
}

async function createProposalRecord(params: {
  clientId: string
  title: string
  proposalNumber: string | null
  proposalDate: string | null
  originalFilename: string
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      client_id: params.clientId,
      title: params.title,
      proposal_number: params.proposalNumber,
      proposal_date: params.proposalDate,
      original_filename: params.originalFilename,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) {
    console.error(`  [ERRO] Falha ao criar proposta "${params.title}":`, error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Verifica se o arquivo ja existe no proposal_files pelo storage_path (Azure blob path).
 */
async function fileAlreadyUploaded(storagePath: string): Promise<boolean> {
  const { data } = await supabase
    .from('proposal_files')
    .select('id')
    .eq('storage_path', storagePath)
    .limit(1)
    .single()
  return !!data
}

/**
 * Upload de um arquivo para o Azure Blob Storage e cria registro no Supabase.
 */
async function uploadFileToAzure(params: {
  proposalId: string
  clientFolder: string
  filePath: string
  fileName: string
  relativePath: string
}): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(params.filePath)
    const fileSize = fs.statSync(params.filePath).size
    const fileExt = path.extname(params.fileName).toLowerCase()

    // Caminho no Azure: {pastaCliente}/{caminhoRelativo}/{nomeArquivo}
    const blobPath = sanitizeBlobName(
      `${params.clientFolder}/${params.relativePath}`
    )

    // Verificar se ja foi enviado
    if (await fileAlreadyUploaded(blobPath)) {
      console.log(`      [SKIP] Ja enviado: ${params.fileName}`)
      return true
    }

    // Upload para Azure Blob Storage
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: CONTENT_TYPES[fileExt] || 'application/octet-stream',
        blobContentDisposition: `inline; filename="${encodeURIComponent(params.fileName)}"`,
      },
    })

    // Criar registro na tabela proposal_files
    const { error: dbError } = await supabase.from('proposal_files').insert({
      proposal_id: params.proposalId,
      file_name: params.fileName,
      file_type: fileExt.replace('.', ''),
      file_size: fileSize,
      storage_path: blobPath,
    })

    if (dbError) {
      console.error(`    [ERRO] Registro do arquivo falhou "${params.fileName}":`, dbError.message)
      return false
    }

    return true
  } catch (error) {
    console.error(`    [ERRO] Upload falhou "${params.fileName}":`, error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(' UPLOAD PARA AZURE BLOB STORAGE')
  console.log('='.repeat(60))
  console.log(`Diretorio local: ${HUB_PATH}`)
  console.log(`Container Azure: ${containerName}`)
  console.log()

  // Verificar conexao com Azure
  try {
    const exists = await containerClient.exists()
    if (!exists) {
      console.log('Container nao existe. Criando...')
      await containerClient.create()
    }
    console.log('[OK] Conexao com Azure Blob Storage estabelecida.')
  } catch (error) {
    console.error('[ERRO] Falha ao conectar no Azure Blob Storage:', error)
    process.exit(1)
  }

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
  let filesUploaded = 0
  let filesSkipped = 0
  let filesErrors = 0

  for (let i = 0; i < clientFolders.length; i++) {
    const folderName = clientFolders[i]
    const folderPath = path.join(HUB_PATH, folderName)
    const progress = `[${i + 1}/${clientFolders.length}]`

    console.log(`${progress} Processando: ${folderName}`)

    // 1. Criar ou recuperar o cliente
    let clientId = await findClientByFolderName(folderName)

    if (clientId) {
      console.log(`  Cliente ja existe (ID: ${clientId.slice(0, 8)}...)`)
      clientsSkipped++
    } else {
      clientId = await createClientRecord(folderName)
      if (!clientId) {
        console.error(`  [ERRO] Nao foi possivel criar o cliente. Pulando.`)
        continue
      }
      console.log(`  Cliente criado (ID: ${clientId.slice(0, 8)}...)`)
      clientsCreated++
    }

    // 2. Escanear arquivos
    const files = scanFiles(folderPath)

    if (files.length === 0) {
      console.log('  Nenhum arquivo suportado encontrado.')
      continue
    }

    console.log(`  Arquivos encontrados: ${files.length}`)

    // 3. Agrupar por proposta
    const proposalGroups = new Map<string, string[]>()

    for (const filePath of files) {
      const fileName = path.basename(filePath)
      const parsed = parseFilename(fileName)
      const groupKey = parsed?.proposalNumber ?? `file:${fileName}`
      const existing = proposalGroups.get(groupKey) ?? []
      existing.push(filePath)
      proposalGroups.set(groupKey, existing)
    }

    // 4. Criar propostas e fazer upload
    for (const [, groupFiles] of proposalGroups) {
      const firstFile = groupFiles[0]
      const firstFileName = path.basename(firstFile)
      const parsed = parseFilename(firstFileName)

      const title = parsed
        ? `${parsed.proposalNumber} - ${parsed.description}`
        : firstFileName.replace(/\.\w+$/, '').replace(/_/g, ' ')

      const proposalNumber = parsed?.proposalNumber ?? null
      const proposalDate = parsed?.date ?? null

      let proposalId = await findProposal(clientId, proposalNumber, title)

      if (!proposalId) {
        proposalId = await createProposalRecord({
          clientId,
          title,
          proposalNumber,
          proposalDate,
          originalFilename: firstFileName,
        })

        if (!proposalId) {
          filesErrors += groupFiles.length
          continue
        }

        proposalsCreated++
        console.log(`    Proposta criada: ${title}`)
      } else {
        console.log(`    Proposta ja existe: ${title}`)
      }

      // Upload de cada arquivo
      for (const filePath of groupFiles) {
        const fileName = path.basename(filePath)
        // Caminho relativo a partir da pasta do cliente
        const relativePath = path.relative(folderPath, filePath).replace(/\\/g, '/')

        const success = await uploadFileToAzure({
          proposalId,
          clientFolder: folderName,
          filePath,
          fileName,
          relativePath,
        })

        if (success) {
          const wasSkipped = await fileAlreadyUploaded(
            sanitizeBlobName(`${folderName}/${relativePath}`)
          )
          if (wasSkipped) {
            filesSkipped++
          } else {
            filesUploaded++
          }
          console.log(`      Enviado: ${fileName}`)
        } else {
          filesErrors++
        }
      }
    }

    console.log()
  }

  console.log('='.repeat(60))
  console.log(' RELATORIO DE UPLOAD')
  console.log('='.repeat(60))
  console.log(`  Clientes criados:     ${clientsCreated}`)
  console.log(`  Clientes existentes:  ${clientsSkipped}`)
  console.log(`  Propostas criadas:    ${proposalsCreated}`)
  console.log(`  Arquivos enviados:    ${filesUploaded}`)
  console.log(`  Arquivos ja existiam: ${filesSkipped}`)
  console.log(`  Erros em arquivos:    ${filesErrors}`)
  console.log('='.repeat(60))
}

main().catch((error) => {
  console.error('[ERRO FATAL]', error)
  process.exit(1)
})
