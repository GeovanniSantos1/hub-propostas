#!/usr/bin/env tsx
/**
 * =============================================================================
 * Script de Geracao de Resumos - Hub Propostas
 * =============================================================================
 *
 * Le os arquivos PDF/DOCX/PPTX do disco local, extrai o texto
 * e gera um resumo automatico baseado nas primeiras frases relevantes.
 *
 * COMO EXECUTAR:
 *   npx tsx scripts/generate-summaries.ts
 *
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Carregar variaveis de ambiente
// ---------------------------------------------------------------------------
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('[ERRO] Variaveis de ambiente nao configuradas.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

// ---------------------------------------------------------------------------
// Extratores de texto
// ---------------------------------------------------------------------------

async function extractPdf(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath)
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch {
    return ''
  }
}

async function extractDocx(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath)
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch {
    return ''
  }
}

async function extractPptx(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath)
    const JSZip = require('jszip')
    const zip = await JSZip.loadAsync(buffer)
    let allText = ''

    const slideFiles = Object.keys(zip.files)
      .filter((name: string) => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort()

    for (const slideFile of slideFiles) {
      const content = await zip.files[slideFile].async('text')
      // Extrair texto dos nodes XML
      const texts = content.match(/<a:t>([^<]*)<\/a:t>/g)
      if (texts) {
        for (const t of texts) {
          const clean = t.replace(/<\/?a:t>/g, '').trim()
          if (clean) allText += clean + ' '
        }
        allText += '\n'
      }
    }
    return allText
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Gerador de resumo baseado em texto extraido
// ---------------------------------------------------------------------------

function generateSummary(text: string, title: string): string {
  // Limpar o texto
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 50) {
    return `Proposta comercial: ${title}.`
  }

  // Remover cabecalhos/rodapes comuns e lixo
  const linesToSkip = [
    /confidencial/i,
    /www\./i,
    /http/i,
    /todos os direitos/i,
    /^\d+$/,
    /^página \d+/i,
    /^page \d+/i,
    /ivory/i,
    /^mip\s/i,
    /^\s*$/,
    /proposta comercial/i,
    /^\s*\d+\s*\/\s*\d+\s*$/,
  ]

  // Dividir em paragrafos e filtrar
  const paragraphs = cleaned
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 30)
    .filter(p => !linesToSkip.some(r => r.test(p)))

  if (paragraphs.length === 0) {
    return `Proposta comercial: ${title}.`
  }

  // Procurar paragrafos que descrevam o escopo/objetivo
  const keywords = [
    'objetivo', 'escopo', 'proposta', 'projeto', 'solução', 'desenvolvimento',
    'implementação', 'sistema', 'plataforma', 'aplicativo', 'portal',
    'serviço', 'consultoria', 'treinamento', 'suporte', 'migração',
    'integração', 'automação', 'gestão', 'controle',
    'scope', 'objective', 'solution', 'project',
  ]

  // Priorizar paragrafos com palavras-chave relevantes
  const scoredParagraphs = paragraphs.map(p => {
    const lower = p.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 2
    }
    // Paragrafos mais longos tendem a ser mais descritivos
    if (p.length > 100) score += 1
    if (p.length > 200) score += 1
    // Penalizar paragrafos muito curtos
    if (p.length < 50) score -= 2
    return { text: p, score }
  })

  // Ordenar por score e pegar os melhores
  scoredParagraphs.sort((a, b) => b.score - a.score)

  const bestParagraphs = scoredParagraphs
    .slice(0, 3)
    .filter(p => p.score > 0)
    .map(p => p.text)

  if (bestParagraphs.length === 0) {
    // Fallback: pegar os primeiros paragrafos significativos
    const firstGood = paragraphs.slice(0, 3)
    return truncate(firstGood.join(' '), 300)
  }

  return truncate(bestParagraphs.join(' '), 300)
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  // Cortar na ultima frase completa antes do limite
  const cut = text.slice(0, maxLen)
  const lastPeriod = cut.lastIndexOf('.')
  if (lastPeriod > maxLen * 0.5) {
    return cut.slice(0, lastPeriod + 1)
  }
  return cut.trim() + '...'
}

// ---------------------------------------------------------------------------
// Resolver caminho local do arquivo a partir do storage_path
// ---------------------------------------------------------------------------

function resolveFilePath(storagePath: string): string | null {
  // O storage_path foi salvo como "local://C:/Users/..."
  if (storagePath.startsWith('local://')) {
    const localPath = storagePath.replace('local://', '').replace(/\//g, '\\')
    if (fs.existsSync(localPath)) return localPath
    // Tentar com barras normais (Git Bash)
    const altPath = storagePath.replace('local://', '')
    if (fs.existsSync(altPath)) return altPath
  }
  return null
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(' GERACAO DE RESUMOS - Hub Propostas')
  console.log('='.repeat(60))
  console.log()

  // Buscar propostas sem descricao
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, title, client_id')
    .or('description.is.null,description.eq.')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[ERRO] Falha ao buscar propostas:', error.message)
    process.exit(1)
  }

  console.log(`Propostas sem resumo: ${proposals?.length || 0}`)
  console.log()

  if (!proposals || proposals.length === 0) {
    console.log('Todas as propostas ja possuem resumo!')
    return
  }

  let updated = 0
  let failed = 0
  let noFile = 0

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i]
    const progress = `[${i + 1}/${proposals.length}]`

    // Buscar arquivos da proposta
    const { data: files } = await supabase
      .from('proposal_files')
      .select('file_name, file_type, storage_path')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: true })

    if (!files || files.length === 0) {
      noFile++
      continue
    }

    // Priorizar: PDF > DOCX > PPTX (PDFs geralmente tem mais conteudo textual)
    const priority = ['pdf', 'docx', 'pptx']
    const sortedFiles = [...files].sort((a, b) => {
      const aIdx = priority.indexOf(a.file_type || '')
      const bIdx = priority.indexOf(b.file_type || '')
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    })

    // Tentar extrair texto do primeiro arquivo legivel
    let text = ''
    let usedFile = ''

    for (const file of sortedFiles) {
      if (!file.storage_path) continue
      const filePath = resolveFilePath(file.storage_path)
      if (!filePath) continue

      try {
        switch (file.file_type) {
          case 'pdf':
            text = await extractPdf(filePath)
            break
          case 'docx':
            text = await extractDocx(filePath)
            break
          case 'pptx':
            text = await extractPptx(filePath)
            break
        }

        if (text.trim().length > 50) {
          usedFile = file.file_name
          break
        }
      } catch {
        continue
      }
    }

    if (!text || text.trim().length < 50) {
      // Gerar resumo basico a partir do titulo
      const summary = `Proposta comercial: ${proposal.title}.`
      await supabase
        .from('proposals')
        .update({ description: summary, ai_generated: false })
        .eq('id', proposal.id)
      updated++
      process.stdout.write(`${progress} ${proposal.title} (titulo apenas)\n`)
      continue
    }

    // Gerar resumo a partir do texto extraido
    const summary = generateSummary(text, proposal.title)

    const { error: updateError } = await supabase
      .from('proposals')
      .update({ description: summary, ai_generated: false })
      .eq('id', proposal.id)

    if (updateError) {
      failed++
      process.stdout.write(`${progress} ERRO: ${proposal.title}\n`)
    } else {
      updated++
      process.stdout.write(`${progress} ${proposal.title} (${usedFile})\n`)
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(' RELATORIO DE RESUMOS')
  console.log('='.repeat(60))
  console.log(`  Resumos gerados:    ${updated}`)
  console.log(`  Erros:              ${failed}`)
  console.log(`  Sem arquivo:        ${noFile}`)
  console.log('='.repeat(60))
  console.log()
  console.log('Concluido! Atualize o navegador para ver os resumos.')
}

main().catch((error) => {
  console.error('[ERRO FATAL]', error)
  process.exit(1)
})
