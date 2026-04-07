/**
 * Modulo de sumarizacao de propostas com IA.
 *
 * Utiliza a API da OpenAI para gerar resumos concisos
 * de propostas comerciais. O prompt e escrito em portugues para
 * garantir que o resumo tambem seja gerado no mesmo idioma.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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

    return completion.choices[0]?.message?.content?.trim() ?? ''
  } catch (error) {
    console.error('[AI] Erro ao gerar resumo da proposta:', error)
    throw error
  }
}
