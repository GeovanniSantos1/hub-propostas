#!/usr/bin/env tsx
/**
 * =============================================================================
 * Script de Importacao - Hub Propostas
 * =============================================================================
 *
 * Este script le todas as pastas de clientes do diretorio "Hub Propostas"
 * e importa os dados para o Supabase (clientes, propostas e arquivos).
 *
 * COMO EXECUTAR:
 *   npx tsx scripts/import-hub.ts
 *
 * VARIAVEIS DE AMBIENTE NECESSARIAS (definir no .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - HUB_PROPOSTAS_PATH (opcional, padrao: C:\Users\Geovanni Santos\Documents\Hub Propostas)
 *
 * COMPORTAMENTO:
 *   - Idempotente: verifica se o cliente ja existe pelo folder_name antes de inserir
 *   - Pula pastas _ARQUIVADO e .superpowers
 *   - Agrupa arquivos por numero de proposta (PropXXXX) quando possivel
 *   - Continua a execucao mesmo se um arquivo individual falhar
 *   - Faz upload dos arquivos para o bucket 'proposals' no Supabase Storage
 *
 * PADRAO DE NOMES DE ARQUIVO RECONHECIDO:
 *   YYYY_MM_DD_NomeCliente_PropXXXXx_Descricao.ext
 *   Exemplos:
 *     2024_03_15_Empresa_Prop0042_PropostaComercial.pdf
 *     2024_01_10_Cliente_Prop0100a_ApresentacaoServicos.pptx
 *
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Carregar variaveis de ambiente do .env.local (sem depender de dotenv)
// ---------------------------------------------------------------------------
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('[AVISO] Arquivo .env.local nao encontrado. Usando variaveis de ambiente do sistema.')
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
// Configuracao do Supabase com service role key (acesso admin)
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

// ---------------------------------------------------------------------------
// Caminho do diretorio Hub Propostas
// ---------------------------------------------------------------------------
const HUB_PATH = process.env.HUB_PROPOSTAS_PATH || 'C:\\Users\\Geovanni Santos\\Documents\\Hub Propostas'

// Pastas que devem ser ignoradas durante a importacao
const SKIP_FOLDERS = new Set(['_ARQUIVADO', '.superpowers', 'hub-propostas'])

// Extensoes de arquivo suportadas
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx'])

// Profundidade maxima de busca por arquivos dentro de cada pasta de cliente
const MAX_DEPTH = 2

// ---------------------------------------------------------------------------
// Regex para extrair metadados do nome do arquivo
// Padrao: YYYY_MM_DD_NomeCliente_PropXXXXx_Descricao.ext
// ---------------------------------------------------------------------------
const FILENAME_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(.+?)_Prop(\d{4}\w?)_(.+)$/i

/**
 * Extrai metadados de um nome de arquivo seguindo o padrao do Hub Propostas.
 *
 * @param filename - Nome do arquivo (sem extensao)
 * @returns Objeto com data, numero da proposta e descricao, ou null se nao casar
 */
function parseFilename(filename: string): {
  date: string
  proposalNumber: string
  description: string
  clientName: string
} | null {
  // Remover a extensao antes de aplicar o regex
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

/**
 * Busca recursivamente por arquivos suportados dentro de uma pasta,
 * respeitando a profundidade maxima configurada.
 *
 * @param dirPath - Caminho da pasta a ser escaneada
 * @param currentDepth - Profundidade atual da recursao
 * @returns Lista de caminhos absolutos dos arquivos encontrados
 */
function scanFiles(dirPath: string, currentDepth = 0): string[] {
  if (currentDepth > MAX_DEPTH) return []

  const files: string[] = []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Recursao para subpastas (respeitando profundidade maxima)
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
 * Verifica se um cliente ja existe no Supabase pelo folder_name.
 * Retorna o ID existente ou null.
 */
async function findClientByFolderName(folderName: string): Promise<string | null> {
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('folder_name', folderName)
    .limit(1)
    .single()

  return data?.id ?? null
}

/**
 * Cria um novo cliente no Supabase.
 * O nome do cliente e derivado do nome da pasta.
 */
async function createClientRecord(folderName: string): Promise<string | null> {
  // Converter nome da pasta em nome legivel
  // Ex: "Empresa ABC" -> "Empresa ABC"
  const displayName = folderName.trim()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: displayName,
      full_name: displayName,
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

/**
 * Verifica se ja existe uma proposta com o mesmo numero para o cliente.
 */
async function findProposal(
  clientId: string,
  proposalNumber: string | null,
  title: string,
): Promise<string | null> {
  // Se temos numero de proposta, buscar por ele
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

  // Senao, buscar por titulo exato
  const { data } = await supabase
    .from('proposals')
    .select('id')
    .eq('client_id', clientId)
    .eq('title', title)
    .limit(1)
    .single()

  return data?.id ?? null
}

/**
 * Cria um registro de proposta no Supabase.
 */
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
 * Faz upload de um arquivo para o Supabase Storage e cria o registro
 * na tabela proposal_files.
 */
async function uploadAndCreateFile(params: {
  proposalId: string
  clientFolder: string
  filePath: string
  fileName: string
}): Promise<boolean> {
  try {
    // Ler o arquivo do disco
    const fileBuffer = fs.readFileSync(params.filePath)
    const fileSize = fs.statSync(params.filePath).size
    const fileExt = path.extname(params.fileName).toLowerCase()

    // Caminho no storage: clients/{pastaCliente}/{nomeArquivo}
    const storagePath = `clients/${params.clientFolder}/${params.fileName}`

    // Determinar o content type
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    // Upload para o Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(storagePath, fileBuffer, {
        contentType: contentTypes[fileExt] || 'application/octet-stream',
        upsert: true, // Sobrescrever se ja existir
      })

    if (uploadError) {
      console.error(`    [ERRO] Upload falhou para "${params.fileName}":`, uploadError.message)
      return false
    }

    // Criar registro na tabela proposal_files
    const { error: dbError } = await supabase.from('proposal_files').insert({
      proposal_id: params.proposalId,
      file_name: params.fileName,
      file_type: fileExt.replace('.', ''),
      file_size: fileSize,
      storage_path: storagePath,
    })

    if (dbError) {
      console.error(`    [ERRO] Registro do arquivo falhou "${params.fileName}":`, dbError.message)
      return false
    }

    return true
  } catch (error) {
    console.error(`    [ERRO] Falha ao processar arquivo "${params.fileName}":`, error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Funcao principal de importacao
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(' IMPORTACAO HUB PROPOSTAS')
  console.log('='.repeat(60))
  console.log(`Diretorio: ${HUB_PATH}`)
  console.log()

  // Verificar se o diretorio existe
  if (!fs.existsSync(HUB_PATH)) {
    console.error(`[ERRO] Diretorio nao encontrado: ${HUB_PATH}`)
    process.exit(1)
  }

  // Listar todas as pastas de clientes
  const entries = fs.readdirSync(HUB_PATH, { withFileTypes: true })
  const clientFolders = entries
    .filter((e) => e.isDirectory() && !SKIP_FOLDERS.has(e.name))
    .map((e) => e.name)
    .sort()

  console.log(`Pastas de clientes encontradas: ${clientFolders.length}`)
  console.log()

  // Contadores para o relatorio final
  let clientsCreated = 0
  let clientsSkipped = 0
  let proposalsCreated = 0
  let filesUploaded = 0
  let filesErrors = 0

  // Processar cada pasta de cliente
  for (let i = 0; i < clientFolders.length; i++) {
    const folderName = clientFolders[i]
    const folderPath = path.join(HUB_PATH, folderName)
    const progress = `[${i + 1}/${clientFolders.length}]`

    console.log(`${progress} Processando: ${folderName}`)

    // -----------------------------------------------------------------------
    // 1. Criar ou recuperar o cliente
    // -----------------------------------------------------------------------
    let clientId = await findClientByFolderName(folderName)

    if (clientId) {
      console.log(`  Cliente ja existe (ID: ${clientId})`)
      clientsSkipped++
    } else {
      clientId = await createClientRecord(folderName)
      if (!clientId) {
        console.error(`  [ERRO] Nao foi possivel criar o cliente. Pulando pasta.`)
        continue
      }
      console.log(`  Cliente criado (ID: ${clientId})`)
      clientsCreated++
    }

    // -----------------------------------------------------------------------
    // 2. Escanear arquivos na pasta do cliente
    // -----------------------------------------------------------------------
    const files = scanFiles(folderPath)

    if (files.length === 0) {
      console.log('  Nenhum arquivo suportado encontrado.')
      continue
    }

    console.log(`  Arquivos encontrados: ${files.length}`)

    // -----------------------------------------------------------------------
    // 3. Agrupar arquivos por numero de proposta
    //    Arquivos com o mesmo PropXXXX serao vinculados a mesma proposta
    // -----------------------------------------------------------------------
    const proposalGroups = new Map<string, string[]>()

    for (const filePath of files) {
      const fileName = path.basename(filePath)
      const parsed = parseFilename(fileName)

      // Chave de agrupamento: numero da proposta ou nome do arquivo
      const groupKey = parsed?.proposalNumber ?? `file:${fileName}`
      const existing = proposalGroups.get(groupKey) ?? []
      existing.push(filePath)
      proposalGroups.set(groupKey, existing)
    }

    // -----------------------------------------------------------------------
    // 4. Criar propostas e fazer upload dos arquivos
    // -----------------------------------------------------------------------
    for (const [groupKey, groupFiles] of proposalGroups) {
      // Usar o primeiro arquivo do grupo para extrair metadados
      const firstFile = groupFiles[0]
      const firstFileName = path.basename(firstFile)
      const parsed = parseFilename(firstFileName)

      const title = parsed
        ? `${parsed.proposalNumber} - ${parsed.description}`
        : firstFileName.replace(/\.\w+$/, '').replace(/_/g, ' ')

      const proposalNumber = parsed?.proposalNumber ?? null
      const proposalDate = parsed?.date ?? null

      // Verificar se a proposta ja existe (idempotencia)
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

      // Upload de cada arquivo do grupo
      for (const filePath of groupFiles) {
        const fileName = path.basename(filePath)
        const success = await uploadAndCreateFile({
          proposalId,
          clientFolder: folderName,
          filePath,
          fileName,
        })

        if (success) {
          filesUploaded++
          console.log(`      Arquivo enviado: ${fileName}`)
        } else {
          filesErrors++
        }
      }
    }

    console.log()
  }

  // ---------------------------------------------------------------------------
  // Relatorio final
  // ---------------------------------------------------------------------------
  console.log('='.repeat(60))
  console.log(' RELATORIO DE IMPORTACAO')
  console.log('='.repeat(60))
  console.log(`  Clientes criados:     ${clientsCreated}`)
  console.log(`  Clientes existentes:  ${clientsSkipped}`)
  console.log(`  Propostas criadas:    ${proposalsCreated}`)
  console.log(`  Arquivos enviados:    ${filesUploaded}`)
  console.log(`  Erros em arquivos:    ${filesErrors}`)
  console.log('='.repeat(60))
}

// Executar
main().catch((error) => {
  console.error('[ERRO FATAL]', error)
  process.exit(1)
})
