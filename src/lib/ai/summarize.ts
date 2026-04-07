/**
 * Modulo de sumarizacao de propostas com IA.
 *
 * Utiliza a API do Claude (Anthropic) para gerar resumos concisos
 * de propostas comerciais. O prompt e escrito em portugues para
 * garantir que o resumo tambem seja gerado no mesmo idioma.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Gera um resumo de 2-3 frases para uma proposta comercial.
 *
 * @param text - Texto extraido do documento da proposta
 * @returns Resumo gerado pela IA
 * @throws Propaga erros da API caso a chamada falhe
 */
export async function summarizeProposal(text: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Voce e um assistente especializado em propostas comerciais.

Analise o texto a seguir, que foi extraido de uma proposta comercial, e faca um resumo conciso de 2 a 3 frases. O resumo deve destacar:
- O objetivo principal da proposta
- Os servicos ou produtos oferecidos
- Informacoes relevantes como prazos ou valores, se disponiveis

Texto da proposta:
${text}

Resumo:`,
        },
      ],
    })

    // Extrair o texto da resposta
    const content = message.content[0]
    if (content.type === 'text') {
      return content.text.trim()
    }

    return ''
  } catch (error) {
    console.error('[AI] Erro ao gerar resumo da proposta:', error)
    throw error
  }
}
