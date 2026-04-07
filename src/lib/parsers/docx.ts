/**
 * Extrator de texto de arquivos DOCX.
 *
 * Utiliza a biblioteca mammoth para converter o conteudo de um
 * documento Word (.docx) em texto puro. Retorna no maximo 5000
 * caracteres para manter compatibilidade com chamadas a API de IA.
 */

import mammoth from 'mammoth'

const MAX_CHARS = 5_000

/**
 * Extrai texto de um buffer DOCX.
 *
 * @param buffer - Buffer contendo o conteudo do arquivo DOCX
 * @returns Texto extraido, limitado a 5 000 caracteres
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value.slice(0, MAX_CHARS)
}
