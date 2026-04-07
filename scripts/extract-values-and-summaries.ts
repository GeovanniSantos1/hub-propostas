#!/usr/bin/env tsx
/**
 * =============================================================================
 * Extração de Valores e Resumos Completos - Hub Propostas
 * =============================================================================
 *
 * Lê os arquivos PDF/DOCX/PPTX/XLSX do disco, extrai:
 *   1. Valor monetário (R$) da proposta
 *   2. Total de horas estimadas
 *   3. Resumo mais completo do conteúdo
 *
 * COMO EXECUTAR:
 *   npx tsx scripts/extract-values-and-summaries.ts
 *
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Carregar .env.local
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ---------------------------------------------------------------------------
// Extratores de texto
// ---------------------------------------------------------------------------
async function extractDocx(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath)
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch { return '' }
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
  } catch { return '' }
}

async function extractPdf(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath)
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch { return '' }
}

async function extractXlsx(filePath: string): Promise<{ text: string; value: number | null; hours: number | null }> {
  try {
    const XLSX = require('xlsx')
    const workbook = XLSX.readFile(filePath)
    let allText = ''
    let maxValue = 0
    let totalHours = 0

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

      for (const row of data) {
        if (!Array.isArray(row)) continue
        const rowTexts: string[] = []

        for (const cell of row) {
          if (cell === null || cell === undefined || cell === '') continue
          const str = String(cell)
          rowTexts.push(str)

          // Tentar extrair valores monetários
          if (typeof cell === 'number' && cell > 1000) {
            // Valores grandes provavelmente são valores de proposta
            if (cell > maxValue && cell < 100000000) {
              maxValue = cell
            }
          }

          // Procurar padrões de R$
          const moneyMatch = str.match(/R\$\s*([\d.,]+)/g)
          if (moneyMatch) {
            for (const m of moneyMatch) {
              const numStr = m.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
              const num = parseFloat(numStr)
              if (num > maxValue && num < 100000000 && num > 1000) {
                maxValue = num
              }
            }
          }

          // Procurar horas totais
          const hourMatch = str.match(/(\d+)\s*(?:h|hrs?|horas?)/i)
          if (hourMatch) {
            const h = parseInt(hourMatch[1])
            if (h > totalHours && h < 100000) totalHours = h
          }
        }

        allText += rowTexts.join(' | ') + '\n'
      }
    }

    return {
      text: allText,
      value: maxValue > 0 ? maxValue : null,
      hours: totalHours > 0 ? totalHours : null,
    }
  } catch {
    return { text: '', value: null, hours: null }
  }
}

// ---------------------------------------------------------------------------
// Extração de valor monetário do texto
// ---------------------------------------------------------------------------
function extractMonetaryValue(text: string): number | null {
  // Procurar padrões como R$ 140.880,00 ou R$6.000,00
  const moneyPatterns = [
    // R$ com pontos e vírgula (formato BR): R$ 140.880,00
    /R\$\s*([\d.]+,\d{2})/g,
    // Valor total / investimento total seguido de número
    /(?:valor total|investimento total|total geral|total do projeto)[:\s]*R?\$?\s*([\d.]+,\d{2})/gi,
  ]

  let maxValue = 0

  for (const pattern of moneyPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.')
      const num = parseFloat(numStr)
      if (num > maxValue && num > 500 && num < 100000000) {
        maxValue = num
      }
    }
  }

  return maxValue > 0 ? maxValue : null
}

// ---------------------------------------------------------------------------
// Geração de resumo completo
// ---------------------------------------------------------------------------
function generateBetterSummary(text: string, title: string, clientName: string): string {
  if (!text || text.length < 30) {
    return `Proposta comercial para ${clientName}: ${title}.`
  }

  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')

  // Dividir em parágrafos significativos
  const paragraphs = cleaned
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 20)

  // Extrair seções relevantes por palavras-chave
  const sections: { key: string; content: string[] }[] = [
    { key: 'objetivo', content: [] },
    { key: 'escopo', content: [] },
    { key: 'entrega', content: [] },
    { key: 'solução', content: [] },
    { key: 'tecnologia', content: [] },
    { key: 'prazo', content: [] },
  ]

  const sectionKeywords: Record<string, string[]> = {
    objetivo: ['objetivo', 'goal', 'finalidade', 'propósito', 'visa ', 'busca ', 'pretende'],
    escopo: ['escopo', 'scope', 'abrangência', 'contempla', 'inclui', 'consiste em', 'compreende'],
    entrega: ['entrega', 'deliverable', 'produto', 'artefato', 'resultado', 'etapa', 'fase', 'sprint'],
    solução: ['solução', 'solution', 'proposta', 'abordagem', 'metodologia', 'approach', 'plataforma', 'sistema', 'aplicativo', 'portal', 'app ', 'website', 'intranet', 'dashboard'],
    tecnologia: ['tecnologia', 'technology', 'stack', 'framework', 'sharepoint', 'react', 'angular', '.net', 'azure', 'aws', 'power bi', 'power apps', 'python', 'node', 'sql', 'api'],
    prazo: ['prazo', 'cronograma', 'timeline', 'duração', 'meses', 'semanas', 'dias úteis', 'sprint'],
  }

  // Filtrar lixo comum de templates
  const junkPatterns = [
    /^[\d\s.\/]+$/,
    /confidencial/i,
    /www\.\w+/i,
    /todos os direitos/i,
    /^\s*\d+\s*$/,
    /^página/i,
    /^ivory\s/i,
    /^\s*mip\s/i,
    /^slide\s/i,
    /contato@/i,
    /^\|/,
    /^\d+\s*\|\s*\d+/,
    /^[\s|]+$/,
  ]

  const cleanParagraphs = paragraphs.filter(p =>
    !junkPatterns.some(pattern => pattern.test(p)) && p.length > 25
  )

  // Classificar parágrafos em seções
  for (const para of cleanParagraphs) {
    const lower = para.toLowerCase()
    for (const section of sections) {
      const keywords = sectionKeywords[section.key]
      if (keywords.some(kw => lower.includes(kw))) {
        if (section.content.length < 3) {
          section.content.push(para)
        }
      }
    }
  }

  // Montar resumo
  const parts: string[] = []

  // 1. Objetivo ou Solução (o que é a proposta)
  const objetivoContent = sections.find(s => s.key === 'objetivo')?.content || []
  const solucaoContent = sections.find(s => s.key === 'solução')?.content || []
  const escopoContent = sections.find(s => s.key === 'escopo')?.content || []

  if (objetivoContent.length > 0) {
    parts.push(truncateText(objetivoContent[0], 200))
  } else if (solucaoContent.length > 0) {
    parts.push(truncateText(solucaoContent[0], 200))
  } else if (escopoContent.length > 0) {
    parts.push(truncateText(escopoContent[0], 200))
  }

  // 2. Escopo / Entregas
  const entregaContent = sections.find(s => s.key === 'entrega')?.content || []
  if (escopoContent.length > 0 && parts.length < 2) {
    parts.push(truncateText(escopoContent[0], 150))
  }
  if (entregaContent.length > 0 && parts.length < 3) {
    parts.push(truncateText(entregaContent[0], 150))
  }

  // 3. Tecnologias
  const techContent = sections.find(s => s.key === 'tecnologia')?.content || []
  if (techContent.length > 0 && parts.length < 3) {
    parts.push(truncateText(techContent[0], 100))
  }

  // 4. Prazo
  const prazoContent = sections.find(s => s.key === 'prazo')?.content || []
  if (prazoContent.length > 0 && parts.length < 4) {
    parts.push(truncateText(prazoContent[0], 80))
  }

  if (parts.length === 0) {
    // Fallback: pegar os primeiros parágrafos com mais de 40 chars
    const meaningful = cleanParagraphs
      .filter(p => p.length > 40)
      .slice(0, 3)

    if (meaningful.length > 0) {
      return `Proposta para ${clientName}. ${truncateText(meaningful.join('. '), 400)}`
    }
    return `Proposta comercial para ${clientName}: ${title}.`
  }

  return truncateText(parts.join('. '), 500)
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastPeriod = cut.lastIndexOf('.')
  const lastSpace = cut.lastIndexOf(' ')
  if (lastPeriod > maxLen * 0.6) return cut.slice(0, lastPeriod + 1)
  if (lastSpace > maxLen * 0.7) return cut.slice(0, lastSpace) + '...'
  return cut.trim() + '...'
}

// ---------------------------------------------------------------------------
// Resolver caminho local
// ---------------------------------------------------------------------------
function resolveFilePath(storagePath: string): string | null {
  if (storagePath.startsWith('local://')) {
    const localPath = storagePath.replace('local://', '').replace(/\//g, '\\')
    if (fs.existsSync(localPath)) return localPath
    const altPath = storagePath.replace('local://', '')
    if (fs.existsSync(altPath)) return altPath
  }
  return null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(' EXTRAÇÃO DE VALORES E RESUMOS - Hub Propostas')
  console.log('='.repeat(60))
  console.log()

  // Buscar todas as propostas com paginação (Supabase limita a 1000 por query)
  const allProposals: typeof proposals = []
  let page = 0
  const PAGE_SIZE = 1000

  while (true) {
    const { data: batch, error: batchError } = await supabase
      .from('proposals')
      .select('id, title, client_id, description, value, clients(name)')
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (batchError) {
      console.error('[ERRO]', batchError.message)
      process.exit(1)
    }
    if (!batch || batch.length === 0) break
    allProposals.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }

  const proposals = allProposals
  const error = null as null

  if (error || !proposals) {
    console.error('[ERRO]', error?.message)
    process.exit(1)
  }

  console.log(`Total de propostas: ${proposals.length}`)
  console.log()

  let valuesFound = 0
  let summariesUpdated = 0
  let errors = 0

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i]
    const clientName = (proposal.clients as { name: string } | null)?.name || 'Cliente'
    const progress = `[${i + 1}/${proposals.length}]`

    // Buscar arquivos
    const { data: files } = await supabase
      .from('proposal_files')
      .select('file_name, file_type, storage_path')
      .eq('proposal_id', proposal.id)

    if (!files || files.length === 0) continue

    let bestValue: number | null = proposal.value ? Number(proposal.value) : null
    let bestSummaryText = ''
    let totalHours: number | null = null

    // Processar cada arquivo
    for (const file of files) {
      if (!file.storage_path) continue
      const filePath = resolveFilePath(file.storage_path)
      if (!filePath) continue

      try {
        if (file.file_type === 'xlsx') {
          // XLSX: extrair valores e horas
          const result = await extractXlsx(filePath)
          if (result.value && (!bestValue || result.value > bestValue)) {
            bestValue = result.value
          }
          if (result.hours && (!totalHours || result.hours > totalHours)) {
            totalHours = result.hours
          }
          // Texto do XLSX como fallback
          if (!bestSummaryText && result.text.length > 50) {
            bestSummaryText = result.text
          }
        } else if (file.file_type === 'docx') {
          const text = await extractDocx(filePath)
          if (text.length > bestSummaryText.length) {
            bestSummaryText = text
          }
          // Extrair valor monetário do DOCX
          const docValue = extractMonetaryValue(text)
          if (docValue && (!bestValue || docValue > bestValue)) {
            bestValue = docValue
          }
        } else if (file.file_type === 'pptx') {
          const text = await extractPptx(filePath)
          if (text.length > bestSummaryText.length) {
            bestSummaryText = text
          }
          const pptValue = extractMonetaryValue(text)
          if (pptValue && (!bestValue || pptValue > bestValue)) {
            bestValue = pptValue
          }
        } else if (file.file_type === 'pdf') {
          const text = await extractPdf(filePath)
          if (text.length > bestSummaryText.length) {
            bestSummaryText = text
          }
          const pdfValue = extractMonetaryValue(text)
          if (pdfValue && (!bestValue || pdfValue > bestValue)) {
            bestValue = pdfValue
          }
        }
      } catch {
        continue
      }
    }

    // Gerar resumo melhor
    const newSummary = generateBetterSummary(bestSummaryText, proposal.title, clientName)

    // Montar update
    const update: Record<string, unknown> = {}
    let changed = false

    if (newSummary && newSummary.length > 50 && (!proposal.description || proposal.description.startsWith('Proposta comercial:'))) {
      update.description = newSummary
      changed = true
      summariesUpdated++
    }

    if (bestValue && bestValue > 0) {
      update.value = bestValue
      changed = true
      valuesFound++
    }

    if (changed) {
      const { error: updateError } = await supabase
        .from('proposals')
        .update(update)
        .eq('id', proposal.id)

      if (updateError) {
        errors++
      } else {
        const valueStr = bestValue ? ` | R$ ${bestValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
        process.stdout.write(`${progress} ${clientName} - ${proposal.title.substring(0, 40)}${valueStr}\n`)
      }
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(' RELATÓRIO')
  console.log('='.repeat(60))
  console.log(`  Valores encontrados:    ${valuesFound}`)
  console.log(`  Resumos atualizados:    ${summariesUpdated}`)
  console.log(`  Erros:                  ${errors}`)
  console.log('='.repeat(60))
  console.log()
  console.log('Atualize o navegador para ver os resultados!')
}

main().catch(err => {
  console.error('[ERRO FATAL]', err)
  process.exit(1)
})
