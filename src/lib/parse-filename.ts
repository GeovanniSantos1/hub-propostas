/**
 * Parser de nomes de arquivo do Hub Propostas
 *
 * Extrai metadados do padrao: YYYY_MM_DD_NomeCliente_PropXXXXx_Descricao.ext
 * Exemplos:
 *   2024_03_15_Empresa_Prop0042_PropostaComercial.pdf
 *   2024_01_10_Cliente_Prop0100a_ApresentacaoServicos.pptx
 *   2025_11_07_All4Labels_Prop15630b_Treinamento Copilot.pdf
 */

const FILENAME_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(.+?)_Prop(\d{4,5}\w?)_(.+)$/i

export interface ParsedFile {
  date: string
  proposalNumber: string
  clientName: string
  description: string
}

/**
 * Extrai metadados de um nome de arquivo seguindo o padrao do Hub Propostas.
 */
export function parseProposalFilename(filename: string): ParsedFile | null {
  const nameWithoutExt = filename.replace(/\.\w+$/, '')
  const match = nameWithoutExt.match(FILENAME_PATTERN)

  if (!match) return null

  const [, year, month, day, clientName, propNumber, description] = match

  return {
    date: `${year}-${month}-${day}`,
    proposalNumber: `Prop${propNumber}`,
    clientName: clientName.replace(/_/g, ' ').trim(),
    description: description.replace(/_/g, ' ').trim(),
  }
}

/**
 * Gera um titulo legivel a partir dos metadados extraidos.
 */
export function buildProposalTitle(parsed: ParsedFile): string {
  return `${parsed.proposalNumber} - ${parsed.description}`
}

/**
 * Tenta extrair ao menos o nome do cliente de nomes que nao seguem o padrao completo.
 * Heuristicas simples para nomes fora do padrao.
 */
export function guessClientFromFilename(filename: string): string | null {
  const nameWithoutExt = filename.replace(/\.\w+$/, '')

  // Tentar padrao parcial: YYYY_MM_DD_Cliente_...
  const partialMatch = nameWithoutExt.match(/^\d{4}_\d{2}_\d{2}_([^_]+)/)
  if (partialMatch) {
    return partialMatch[1].replace(/_/g, ' ').trim()
  }

  return null
}
