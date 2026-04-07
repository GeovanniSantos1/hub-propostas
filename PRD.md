# PRD - Hub Propostas: Sistema de Gestao de Propostas e Prospeccao Comercial

## Visao do Produto

O Hub Propostas e um CRM focado em **propostas comerciais** e **prospeccao de clientes**. A premissa central e que o historico de propostas (ganhas, perdidas, em negociacao) e a maior fonte de oportunidades comerciais de uma empresa de servicos.

**Problema:** Propostas perdidas ou clientes antigos ficam esquecidos em pastas. Nao existe visibilidade sobre quando retomar contato, quais clientes tem potencial para novos projetos, ou quais propostas poderiam ser reaproveitadas.

**Solucao:** Um hub inteligente que organiza todas as propostas, monitora o ciclo de vida dos clientes e sugere proativamente janelas de oportunidade para novas vendas.

---

## O que ja existe (v1.0)

- [x] Cadastro e gestao de clientes (CRUD, busca, filtros, setores)
- [x] Gestao de propostas (status, valor, data, numero)
- [x] Upload inteligente com deteccao automatica de cliente/proposta pelo nome do arquivo
- [x] Armazenamento de arquivos no Azure Blob Storage
- [x] Analise de propostas com IA (OpenAI) - resumo, valor, servicos, prazo
- [x] Historico de interacoes (reuniao, ligacao, email, visita, nota)
- [x] Lembretes e follow-ups
- [x] Dashboard com metricas (total clientes, propostas ganhas/perdidas/negociando)
- [x] Relatorios com graficos (pizza, barras, top clientes, taxa de conversao)
- [x] Exportacao para Excel
- [x] Visualizacao de PDFs direto no navegador
- [x] Autenticacao e controle de acesso (admin/membro)

---

## Funcionalidades Propostas (v2.0+)

### FASE 1 - Prospeccao e Oportunidades (Prioridade Alta)

#### 1.1 Pipeline Visual (Kanban)
**O que:** Visualizacao drag-and-drop das propostas em colunas por status (Rascunho > Enviada > Negociando > Ganha/Perdida).

**Por que:** A tabela atual nao da visao do funil. O Kanban permite ver gargalos rapidamente (ex: muitas propostas paradas em "Enviada" sem retorno).

**Funcionalidades:**
- Arrastar cards entre colunas para atualizar status
- Cards mostram: cliente, valor, data de envio, dias parados naquele estagio
- Filtros por periodo, cliente, responsavel
- Indicador visual de propostas "paradas" (ex: borda vermelha se >15 dias sem movimentacao)
- Totalizador por coluna (quantidade e valor somado)

---

#### 1.2 Radar de Oportunidades (Clientes Dormentes)
**O que:** Tela que identifica automaticamente clientes com janela de oportunidade para reativacao.

**Por que:** Clientes antigos que ja compraram sao a fonte mais quente de novas vendas. O sistema deve alertar proativamente quando e hora de retomar contato.

**Regras de deteccao:**
- **Cliente sem interacao ha X meses** (configuravel, padrao: 3 meses)
- **Proposta perdida ha mais de 6 meses** - momento de retomar com nova abordagem
- **Proposta ganha com contrato prestes a vencer** - oportunidade de renovacao
- **Cliente com apenas 1 proposta** - potencial de cross-sell
- **Clientes com propostas em tecnologias que a empresa agora oferece** - upsell

**Visualizacao:**
- Lista priorizada por "temperatura" (quente/morno/frio)
- Filtro por motivo da oportunidade
- Acao rapida: "Criar lembrete", "Registrar contato", "Nova proposta"
- Score de oportunidade calculado pela IA com base no historico

---

#### 1.3 Retomada de Propostas Perdidas
**O que:** Fluxo dedicado para gestao de propostas que nao foram para frente.

**Por que:** Uma proposta perdida hoje pode virar oportunidade amanha. O sistema deve rastrear o motivo da perda e sugerir quando tentar novamente.

**Funcionalidades:**
- Campo **"Motivo da perda"** ao marcar proposta como perdida (preco, prazo, concorrente, projeto cancelado, budget, outro)
- Campo **"Data sugerida para retomada"** (o vendedor estima quando tentar de novo)
- Tela de "Propostas para retomada" - lista propostas perdidas cuja data sugerida ja passou
- IA sugere nova abordagem baseada no motivo da perda e no perfil do cliente
- Botao "Reabrir como nova proposta" - clona a proposta perdida como rascunho com link para a original

---

#### 1.4 Timeline Unificada do Cliente
**O que:** Visao cronologica completa de tudo que aconteceu com um cliente: propostas, interacoes, lembretes, arquivos.

**Por que:** Antes de ligar para um cliente, o vendedor precisa saber rapidamente todo o historico. Hoje as informacoes estao espalhadas em cards separados.

**Funcionalidades:**
- Timeline vertical com todas as atividades mescladas e ordenadas por data
- Icones por tipo (proposta enviada, reuniao, email, proposta ganha, proposta perdida, lembrete)
- Filtro por tipo de atividade
- Destaque para marcos importantes (primeira proposta, primeira venda, ultima interacao)
- Indicador de "dias sem contato"

---

### FASE 2 - Inteligencia Comercial (Prioridade Media)

#### 2.1 Health Score do Cliente
**O que:** Indicador numerico (0-100) que mede a "saude" do relacionamento com cada cliente.

**Calculo baseado em:**
- Frequencia de interacoes (peso 25%)
- Taxa de conversao de propostas (peso 25%)
- Recencia da ultima interacao (peso 20%)
- Volume financeiro (peso 15%)
- Diversidade de servicos contratados (peso 15%)

**Visualizacao:**
- Badge colorido no card do cliente (verde >70, amarelo 40-70, vermelho <40)
- Ranking de clientes por health score no dashboard
- Alerta quando score cai abaixo de limite configuravel

---

#### 2.2 Sugestoes de Cross-sell / Upsell com IA
**O que:** A IA analisa o portfolio de servicos ja vendidos para cada cliente e sugere novos servicos que outros clientes similares contrataram.

**Logica:**
- "Cliente A comprou Desenvolvimento + Assessment. Clientes similares tambem compraram Treinamento e Suporte."
- "Cliente B teve proposta de Migracao RPA perdida ha 8 meses. 3 outros clientes do mesmo setor contrataram esse servico recentemente."

**Exibicao:**
- Card "Oportunidades sugeridas" na pagina do cliente
- Notificacao semanal com top 5 oportunidades detectadas

---

#### 2.3 Tags e Categorias de Propostas
**O que:** Sistema de tags para classificar propostas por tipo de servico, tecnologia ou area.

**Exemplos de tags:**
- Tipo: Assessment, Desenvolvimento, Consultoria, Treinamento, Suporte, Migracao
- Tecnologia: Azure, SharePoint, Power Platform, RPA, IA, Mobile
- Area: TI, Juridico, RH, Financeiro, Operacoes

**Beneficios:**
- Filtrar propostas por tag na listagem
- Relatorios por tipo de servico (o que mais vende, o que mais perde)
- Base para sugestoes de cross-sell
- Tags podem ser sugeridas automaticamente pela IA ao analisar o documento

---

#### 2.4 Forecast de Receita
**O que:** Projecao de receita baseada no pipeline atual de propostas.

**Calculo:**
- Propostas em negociacao × probabilidade por estagio
- Ex: "Enviada" = 20%, "Negociando" = 50%, "Won" = 100%
- Percentuais configuraveis

**Visualizacao:**
- Grafico de barras com receita projetada por mes
- Card no dashboard: "Receita projetada proximo trimestre: R$ X"
- Comparativo projetado vs realizado

---

### FASE 3 - Automacao e Integracao (Prioridade Baixa)

#### 3.1 Templates de Propostas
**O que:** Biblioteca de propostas modelo que podem ser clonadas e customizadas.

**Funcionalidades:**
- Marcar uma proposta como "template"
- Criar nova proposta a partir de template (copia titulo, descricao, valor base, arquivos)
- Sugestao automatica de template baseada no tipo de servico e setor do cliente
- Historico de qual template gerou mais propostas ganhas

---

#### 3.2 Notificacoes por Email
**O que:** Sistema de notificacoes automaticas por email.

**Gatilhos:**
- Lembrete vencendo hoje/amanha
- Proposta parada no mesmo status ha mais de X dias
- Cliente classificado como "oportunidade quente" pelo Radar
- Resumo semanal: pipeline, oportunidades, lembretes pendentes

---

#### 3.3 Integracao com Email (Outlook/Gmail)
**O que:** Capturar emails trocados com clientes e registrar automaticamente como interacoes.

**Funcionalidades:**
- Conectar conta de email (OAuth)
- Detectar emails de/para contatos cadastrados
- Registrar automaticamente como interacao tipo "email"
- Opcao de enviar proposta por email direto do sistema

---

#### 3.4 Comparador de Propostas
**O que:** Ferramenta para comparar duas ou mais propostas lado a lado.

**Uso:** Comparar versoes diferentes de uma proposta (a, b, c) ou comparar propostas de clientes similares para entender diferencas de preco/escopo.

**Visualizacao:**
- Tabela comparativa: valor, servicos, prazo, status
- Diff de resumos gerados pela IA
- Historico de versoes de uma mesma proposta

---

#### 3.5 API Publica / Webhooks
**O que:** Expor endpoints para integracao com sistemas externos.

**Casos de uso:**
- Integrar com ERP para atualizar status de propostas ganhas
- Webhook quando proposta muda de status (para disparar fluxo no Power Automate)
- Integracao com ferramentas de BI (Power BI, Metabase)

---

### FASE 4 - Melhorias de UX (Continuo)

#### 4.1 Busca Global Inteligente
**O que:** Campo de busca unificado que pesquisa em clientes, propostas, interacoes e arquivos simultaneamente.

**Funcionalidades:**
- Busca federada com resultados agrupados por tipo
- Busca semantica (IA entende "propostas de app mobile" mesmo que o titulo nao tenha essas palavras)
- Atalho de teclado (Ctrl+K)

---

#### 4.2 Dashboard Personalizavel
**O que:** Permitir que cada usuario monte seu proprio dashboard com os widgets que mais usa.

**Widgets disponiveis:**
- Metricas resumidas
- Pipeline por status
- Clientes quentes (radar de oportunidades)
- Propostas para retomada
- Lembretes pendentes
- Grafico de receita
- Atividades recentes

---

#### 4.3 Modo Offline / PWA
**O que:** Permitir consultar informacoes basicas (clientes, propostas, historico) sem internet.

**Caso de uso:** Vendedor em reuniao externa precisa consultar historico do cliente no celular.

---

#### 4.4 Auditoria e Log de Atividades
**O que:** Registro de todas as acoes dos usuarios no sistema.

**Rastreado:**
- Quem criou/editou/deletou cada registro
- Historico de mudancas de status de propostas
- Acessos a arquivos
- Login/logout

---

## Priorizacao Sugerida (Roadmap)

### Sprint 1 (2 semanas)
| Feature | Esforco | Impacto |
|---------|---------|---------|
| 1.1 Pipeline Kanban | Medio | Alto |
| 1.3 Motivo de perda + retomada | Baixo | Alto |
| 2.3 Tags de propostas | Baixo | Medio |

### Sprint 2 (2 semanas)
| Feature | Esforco | Impacto |
|---------|---------|---------|
| 1.2 Radar de Oportunidades | Alto | Alto |
| 1.4 Timeline unificada | Medio | Alto |
| 2.1 Health Score | Medio | Medio |

### Sprint 3 (2 semanas)
| Feature | Esforco | Impacto |
|---------|---------|---------|
| 2.2 Sugestoes cross-sell IA | Alto | Alto |
| 2.4 Forecast de receita | Medio | Medio |
| 3.1 Templates de propostas | Medio | Medio |

### Sprint 4+ (continuo)
| Feature | Esforco | Impacto |
|---------|---------|---------|
| 3.2 Notificacoes email | Medio | Medio |
| 3.3 Integracao email | Alto | Alto |
| 4.1 Busca global inteligente | Alto | Alto |
| 3.4 Comparador | Medio | Baixo |
| 3.5 API/Webhooks | Medio | Baixo |
| 4.2 Dashboard personalizavel | Alto | Medio |
| 4.3 PWA offline | Alto | Baixo |
| 4.4 Auditoria | Medio | Baixo |

---

## Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Propostas com follow-up em dia | > 80% |
| Clientes dormentes reativados/mes | > 5 |
| Taxa de conversao de propostas | > 30% |
| Tempo medio de resposta a oportunidade | < 48h |
| Propostas perdidas retomadas com sucesso | > 10% |
| Usuarios ativos diarios | > 80% do time comercial |

---

## Alteracoes no Banco de Dados (planejadas)

### Novos campos em `proposals`:
```sql
loss_reason text check (loss_reason in ('price', 'deadline', 'competitor', 'cancelled', 'budget', 'other')),
loss_notes text,
retry_date date,
retried_from uuid references proposals(id),
forecast_probability decimal default 0
```

### Nova tabela `tags`:
```sql
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text check (category in ('service', 'technology', 'area')),
  color text,
  created_at timestamptz default now()
);

create table proposal_tags (
  proposal_id uuid references proposals(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (proposal_id, tag_id)
);
```

### Nova tabela `activity_log`:
```sql
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
```

### Nova tabela `opportunity_scores` (cache do health score):
```sql
create table opportunity_scores (
  client_id uuid references clients(id) on delete cascade primary key,
  score integer not null default 0,
  factors jsonb,
  last_interaction_at timestamptz,
  days_since_contact integer,
  suggestions text[],
  calculated_at timestamptz default now()
);
```
