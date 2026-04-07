# PRD - Construtor Inteligente de Propostas

## Problema

Hoje, criar uma proposta do zero exige que o vendedor:
1. Abra propostas antigas de clientes parecidos para ter referencia de preco
2. Estime o valor manualmente, muitas vezes "no feeling"
3. Monte o escopo relembrando projetos passados similares
4. Nao tem visibilidade se o preco esta dentro do padrao do mercado interno (empresa)
5. Perde tempo refazendo estruturas que ja existem

O resultado: propostas com precos inconsistentes, escopos incompletos, e perda de oportunidade por demora na elaboracao.

## Solucao

Um **Construtor Inteligente de Propostas** que:
- Guia o vendedor por etapas estruturadas (wizard)
- Usa IA + historico real de propostas para sugerir valores, escopo e servicos
- Calcula preco com base em propostas anteriores do mesmo tipo/setor
- Gera um rascunho pronto para ajuste final e envio

---

## Fluxo do Usuario

```
[1. Selecionar Cliente] --> [2. Definir Servicos] --> [3. IA Calcula e Sugere] --> [4. Revisar e Ajustar] --> [5. Gerar Proposta]
```

### Etapa 1 - Selecionar Cliente
**Tela:** Campo de busca com autocomplete

- Buscar cliente existente ou criar novo
- Ao selecionar, o sistema carrega automaticamente:
  - Setor do cliente
  - Historico de propostas (ganhas, perdidas, em andamento)
  - Health Score atual
  - Ultima interacao
- **Insight lateral:** "Este cliente ja tem 3 propostas ganhas em Desenvolvimento. Considere oferecer Suporte ou Treinamento."

### Etapa 2 - Definir Servicos e Escopo
**Tela:** Selecao de tags + campo de descricao livre

- Selecionar tipo de servico (tags existentes): Assessment, Desenvolvimento, Consultoria, Treinamento, Squad, etc.
- Selecionar tecnologias envolvidas: Azure, .NET, React, Power Platform, etc.
- Campo de texto livre para descrever o escopo em linguagem natural
- **Opcional:** Selecionar uma proposta existente como "base" (template)

### Etapa 3 - IA Calcula e Sugere
**Tela:** Painel com sugestoes da IA (o coracao da feature)

A IA recebe:
- Cliente selecionado + setor
- Servicos/tecnologias escolhidos
- Descricao do escopo
- Historico COMPLETO de propostas similares (mesmo servico, mesmo setor, mesma tecnologia)

A IA retorna:

#### 3.1 Sugestao de Valor
```
Valor sugerido: R$ 85.000,00
Faixa: R$ 65.000 - R$ 120.000

Baseado em:
- 12 propostas similares de "Desenvolvimento + Azure"
- Valor medio ganho: R$ 82.400
- Valor medio perdido por preco: R$ 145.000 (preco alto demais)
- Para o setor "Industria": media de R$ 78.000
```

**Dados que alimentam o calculo:**
- Media de valor de propostas ganhas com as mesmas tags (servico + tecnologia)
- Media de valor de propostas ganhas para clientes do mesmo setor
- Media de valor de propostas perdidas por motivo "preco" (teto a evitar)
- Historico especifico do cliente (se ja comprou antes, qual faixa de preco)
- Desvio padrao para gerar a faixa min-max

#### 3.2 Sugestao de Escopo
```
Escopo sugerido (baseado em propostas similares ganhas):

1. Discovery e Levantamento de Requisitos (2 semanas)
2. Prototipacao e Validacao (1 semana)
3. Desenvolvimento Sprint 1-4 (8 semanas)
4. Testes e Homologacao (2 semanas)
5. Implantacao e Go-live (1 semana)
6. Suporte pos-implantacao (4 semanas)

Prazo estimado: 18 semanas
Equipe sugerida: 1 Tech Lead, 2 Devs, 1 QA, 1 Agile Master
```

**Dados que alimentam:**
- Descricoes e resumos (ai_generated) de propostas ganhas similares
- Padroes de escopo recorrentes extraidos dos documentos

#### 3.3 Probabilidade de Ganho
```
Probabilidade estimada: 68%

Fatores positivos:
+ Cliente ja comprou 2x (relacionamento estabelecido)
+ Setor com alta conversao (Industria: 42%)
+ Valor dentro da faixa historica de aceite

Fatores de risco:
- Cliente perdeu ultima proposta por "budget" 
- Sem interacao ha 45 dias
```

#### 3.4 Alertas Inteligentes
```
⚠️ A ultima proposta para este cliente foi perdida por "preco" 
   com valor de R$ 130.000. Considere ficar abaixo desse teto.

💡 Clientes do setor Industria que compraram "Desenvolvimento" 
   tambem contrataram "Suporte" em 60% dos casos.

📊 Sua taxa de conversao para "Azure + Desenvolvimento" e de 35%.
   A media da empresa e 28%.
```

### Etapa 4 - Revisar e Ajustar
**Tela:** Formulario pre-preenchido com os dados sugeridos

- Titulo da proposta (sugerido pela IA, editavel)
- Descricao/resumo (gerado pela IA, editavel)
- Valor (sugerido, com slider entre min-max, editavel)
- Prazo (sugerido, editavel)
- Status: "Rascunho"
- Tags ja atribuidas (dos servicos selecionados na etapa 2)
- Numero da proposta (auto-gerado ou manual)

O vendedor pode:
- Aceitar tudo e criar
- Ajustar qualquer campo
- Voltar para alterar servicos/escopo e recalcular

### Etapa 5 - Gerar Proposta
**Acao:** Cria a proposta no banco + opcionalmente gera documento

- Cria registro na tabela `proposals`
- Atribui tags selecionadas
- Registra no activity_log
- **Opcional futuro:** Gerar PDF/PPTX a partir de template com os dados preenchidos

---

## Modelo de Dados

### Dados necessarios para o calculo (ja existem no banco)

| Dado | Tabela | Campo |
|------|--------|-------|
| Propostas anteriores por servico | proposals + proposal_tags | tags de categoria "service" |
| Propostas por tecnologia | proposals + proposal_tags | tags de categoria "technology" |
| Propostas por setor do cliente | proposals + clients | clients.sector |
| Valores de propostas ganhas | proposals | value WHERE status = 'won' |
| Valores de propostas perdidas | proposals | value WHERE status = 'lost' |
| Motivo da perda | proposals | loss_reason |
| Resumos das propostas | proposals | description (ai_generated) |
| Historico do cliente | proposals | client_id |

### Novo campo sugerido

```sql
-- Na tabela proposals, campo para armazenar os parametros 
-- usados pela IA na sugestao (para auditoria e melhoria do modelo)
alter table public.proposals
  add column if not exists ai_suggestion jsonb;
```

O campo `ai_suggestion` armazena:
```json
{
  "suggested_value": 85000,
  "value_range": { "min": 65000, "max": 120000 },
  "win_probability": 0.68,
  "similar_proposals_count": 12,
  "similar_avg_value": 82400,
  "scope_suggestion": "...",
  "alerts": ["..."],
  "model": "gpt-4o-mini",
  "generated_at": "2026-04-07T..."
}
```

---

## Prompt da IA (Calculo de Valor)

```
Voce e um consultor comercial analisando dados historicos para precificar uma nova proposta.

CONTEXTO DO CLIENTE:
- Nome: {client_name}
- Setor: {client_sector}
- Propostas anteriores: {client_proposals_summary}
- Health Score: {health_score}

SERVICO SOLICITADO:
- Tipo: {service_tags}
- Tecnologias: {technology_tags}
- Descricao do escopo: {scope_description}

DADOS HISTORICOS (propostas similares):
- Propostas ganhas com mesmas tags: {won_similar}
  - Media de valor: R$ {avg_won_value}
  - Mediana: R$ {median_won_value}
  - Min: R$ {min_won_value} | Max: R$ {max_won_value}

- Propostas perdidas com mesmas tags: {lost_similar}
  - Media de valor: R$ {avg_lost_value}
  - Perdidas por preco: {lost_by_price_count} com media R$ {avg_lost_price_value}

- Propostas do mesmo setor ({sector}):
  - Media ganhas: R$ {sector_avg_won}
  - Taxa de conversao do setor: {sector_conversion_rate}%

- Historico deste cliente especifico:
  - Total propostas: {client_total}
  - Ganhas: {client_won} (media R$ {client_avg_won_value})
  - Perdidas: {client_lost}
  - Ultima proposta perdida: motivo "{last_loss_reason}", valor R$ {last_loss_value}

Retorne JSON:
{
  "suggested_value": numero,
  "value_range": { "min": numero, "max": numero },
  "win_probability": decimal 0-1,
  "scope_suggestion": "texto com escopo sugerido em topicos",
  "timeline": "prazo estimado",
  "team_suggestion": "equipe sugerida",
  "title_suggestion": "titulo sugerido para a proposta",
  "alerts": ["lista de alertas e insights"],
  "reasoning": "explicacao de como chegou ao valor"
}
```

---

## API Endpoints

### POST /api/ai/proposal-builder
**Input:**
```json
{
  "clientId": "uuid",
  "serviceTags": ["tag_id_1", "tag_id_2"],
  "technologyTags": ["tag_id_3"],
  "scopeDescription": "Texto livre descrevendo o escopo",
  "baseProposalId": "uuid (opcional - template)"
}
```

**Output:**
```json
{
  "suggestion": {
    "title": "Prop XXXXX - Desenvolvimento Portal Azure",
    "description": "Resumo gerado...",
    "value": 85000,
    "valueRange": { "min": 65000, "max": 120000 },
    "winProbability": 0.68,
    "scope": "1. Discovery...\n2. Desenvolvimento...",
    "timeline": "18 semanas",
    "team": "1 Tech Lead, 2 Devs, 1 QA",
    "alerts": ["..."],
    "reasoning": "..."
  },
  "similarProposals": {
    "won": [{ "id": "...", "title": "...", "value": 82000, "client": "..." }],
    "lost": [{ "id": "...", "title": "...", "value": 145000, "lossReason": "price" }]
  },
  "clientContext": {
    "healthScore": 72,
    "totalProposals": 5,
    "wonProposals": 2,
    "lastInteraction": "2026-03-15",
    "crossSellOpportunity": "Suporte"
  }
}
```

---

## Componentes de UI

### 1. ProposalBuilderWizard (`/proposals/new`)
- Wizard com 4-5 etapas (stepper visual)
- Cada etapa tem validacao antes de avancar
- Botao "Voltar" em cada etapa
- Preview lateral com dados preenchidos ate o momento

### 2. ValueCalculator (componente do step 3)
- Gauge/medidor visual mostrando o valor sugerido dentro da faixa
- Slider para ajustar o valor
- Cards de referencia mostrando propostas similares
- Indicador de probabilidade de ganho (gauge circular)

### 3. ScopeEditor (componente do step 3)
- Texto editavel com o escopo sugerido
- Botao "Regenerar" para pedir nova sugestao
- Opcao de importar escopo de proposta existente

### 4. AlertsPanel (componente do step 3)
- Cards com alertas da IA
- Cores por tipo: amarelo (cuidado), azul (insight), verde (positivo)

### 5. SimilarProposalsList (componente lateral)
- Lista das propostas usadas como referencia
- Link para abrir cada uma
- Mostra valor, status, cliente

---

## Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Propostas criadas via builder / total | > 60% |
| Tempo medio para criar proposta | < 10 minutos |
| Variacao entre valor sugerido e valor final | < 20% |
| Taxa de conversao de propostas criadas via builder | > media historica |
| Satisfacao do vendedor (survey) | > 4/5 |

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| IA sugere valores muito altos/baixos | Sempre mostrar faixa + referencia historica. Vendedor ajusta. |
| Poucas propostas similares para calcular | Mostrar aviso "poucos dados, sugestao menos precisa" e ampliar busca |
| Vendedor confia cegamente na IA | Sempre exibir o raciocinio e os dados de referencia |
| Dados historicos desatualizados | Usar apenas propostas dos ultimos 3 anos como peso maior |

---

## Roadmap de Implementacao

### Fase 1 - MVP (1 sprint)
- [x] Wizard de 4 etapas
- [x] Calculo de valor baseado em historico
- [x] Sugestao de escopo com IA
- [x] Probabilidade de ganho
- [x] Alertas inteligentes
- [x] Criacao da proposta

### Fase 2 - Refinamento (1 sprint)
- [ ] Slider visual para ajuste de valor
- [ ] Gauge de probabilidade
- [ ] Lista de propostas similares como referencia lateral
- [ ] "Regenerar" sugestao com parametros diferentes

### Fase 3 - Geracao de Documento (1 sprint)
- [ ] Template de proposta em PPTX/PDF
- [ ] Preenchimento automatico com dados do builder
- [ ] Upload automatico para Azure Blob Storage
- [ ] Preview do documento antes de gerar
