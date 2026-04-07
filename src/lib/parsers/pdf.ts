/**
 * Extrator de texto de arquivos PDF.
 *
 * Utiliza import dinâmico do pdf-parse para evitar problemas
 * com DOMMatrix/canvas no build do Next.js.
 */

const MAX_CHARS = 5_000

/**
 * Extrai texto de um buffer PDF.
 *
 * @param buffer - Buffer contendo o conteúdo do arquivo PDF
 * @returns Texto extraído, limitado a 5 000 caracteres
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Import dinâmico para evitar erro de DOMMatrix no build
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = (await import(/* webpackIgnore: true */ 'pdf-parse')) as unknown as (
    buf: Buffer,
  ) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  return data.text.slice(0, MAX_CHARS)
}
