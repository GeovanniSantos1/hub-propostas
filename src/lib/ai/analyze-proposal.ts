/**
 * Analise inteligente de propostas com OpenAI.
 *
 * Extrai dados estruturados do texto de uma proposta comercial:
 * resumo, valor, prazo, servicos, pontos principais.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ProposalAnalysis {
  summary: string
  value: number | null
  deadline: string | null
  services: string[]
  highlights: string[]
  clientName: string | null
}

/**
 * Analisa o texto de uma proposta e extrai dados estruturados.
 *
 * @param text - Texto extraido do documento
 * @returns Dados estruturados da proposta
 */
export async function analyzeProposal(text: string): Promise<ProposalAnalysis> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Voce e um assistente especializado em analisar propostas comerciais brasileiras.
Extraia informacoes estruturadas do texto fornecido e responda APENAS em JSON valido com este formato:

{
  "summary": "Resumo de 2-3 frases sobre o objetivo e escopo da proposta",
  "value": null ou numero (valor total em reais, sem formatacao - ex: 150000.00),
  "deadline": null ou string com o prazo (ex: "30 dias", "3 meses", "90 dias uteis"),
  "services": ["lista", "de", "servicos", "oferecidos"],
  "highlights": ["pontos", "principais", "da", "proposta"],
  "clientName": null ou "nome do cliente identificado no documento"
}

Regras:
- O valor deve ser o valor TOTAL da proposta em numero decimal (sem R$, pontos ou virgulas de milhar). Use ponto como separador decimal.
- Se houver multiplos valores, use o valor total. Se nao encontrar valor, retorne null.
- Os highlights devem ter no maximo 5 itens curtos e objetivos.
- Os servicos devem ser uma lista clara do que esta sendo proposto.
- Responda SOMENTE o JSON, sem texto adicional.`,
      },
      {
        role: 'user',
        content: `Analise esta proposta comercial:\n\n${text}`,
      },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim() ?? '{}'

  try {
    const parsed = JSON.parse(content) as ProposalAnalysis
    return {
      summary: parsed.summary || '',
      value: typeof parsed.value === 'number' ? parsed.value : null,
      deadline: parsed.deadline || null,
      services: Array.isArray(parsed.services) ? parsed.services : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      clientName: parsed.clientName || null,
    }
  } catch {
    return {
      summary: content,
      value: null,
      deadline: null,
      services: [],
      highlights: [],
      clientName: null,
    }
  }
}
