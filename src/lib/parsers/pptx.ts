/**
 * Extrator de texto de arquivos PPTX.
 *
 * Arquivos PPTX sao na verdade arquivos ZIP contendo XMLs.
 * Utilizamos JSZip para descompactar e extrair o texto dos slides.
 * Retorna no maximo 5000 caracteres.
 */

import JSZip from 'jszip'

const MAX_CHARS = 5_000

/**
 * Remove todas as tags XML e retorna apenas o texto.
 */
function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrai texto de um buffer PPTX.
 *
 * Percorre todos os arquivos de slide (ppt/slides/slideN.xml)
 * dentro do ZIP e concatena o texto extraido de cada um.
 *
 * @param buffer - Buffer contendo o conteudo do arquivo PPTX
 * @returns Texto extraido, limitado a 5 000 caracteres
 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)

  // Coletar os nomes dos arquivos de slide e ordena-los
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/i)?.[1] ?? '0', 10)
      const numB = parseInt(b.match(/slide(\d+)/i)?.[1] ?? '0', 10)
      return numA - numB
    })

  const textParts: string[] = []

  for (const slideName of slideFiles) {
    const file = zip.files[slideName]
    if (!file) continue

    const xmlContent = await file.async('text')
    const text = stripXmlTags(xmlContent)
    if (text) {
      textParts.push(text)
    }
  }

  return textParts.join('\n\n').slice(0, MAX_CHARS)
}
