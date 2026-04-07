# Hub Propostas

CRM de propostas comerciais e prospeccao de clientes da IVORY IT. Centraliza todas as propostas, monitora o ciclo de vida dos clientes e sugere proativamente oportunidades de novas vendas com inteligencia artificial.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | Next.js API Routes (App Router) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticacao | Supabase Auth com SSR |
| Armazenamento | Azure Blob Storage |
| IA | OpenAI GPT-4o-mini |
| Drag & Drop | dnd-kit |
| Parsers | pdf-parse, mammoth (DOCX), jszip (PPTX), xlsx |

## Funcionalidades

### Gestao de Propostas

#### Pipeline Kanban
Visualizacao de todas as propostas em colunas por status: Rascunho, Enviada, Negociando, Ganha e Perdida. Cards sao arrastados entre colunas para atualizar o status. Propostas paradas ha mais de 15 dias ficam destacadas em vermelho. Ao mover para "Perdida", o sistema solicita o motivo (preco, prazo, concorrente, cancelado, budget, escopo) e uma data sugerida para retomada futura. O topo mostra o valor total do pipeline ativo.

#### Listagem de Propostas
Tabela com busca por titulo e filtros por status. Cada proposta exibe cliente, data, valor, status e arquivos anexados. Os badges de arquivo (PDF, DOCX, PPTX, XLSX) sao clicaveis e abrem o documento diretamente no navegador via URL assinada do Azure.

#### Tags
Sistema de classificacao com 24 tags em tres categorias:
- **Servicos**: Assessment, Desenvolvimento, Consultoria, Treinamento, Suporte, Migracao, Discovery, Squad, Alocacao
- **Tecnologias**: Azure, SharePoint, Power Platform, RPA, .NET, React, Mobile, IA/ML, DevOps
- **Areas**: TI, Juridico, RH, Financeiro, Operacoes, Comercial

Tags podem ser adicionadas ou removidas diretamente no card da proposta.

#### Clonar Proposta
Botao de copia em cada card permite clonar uma proposta como novo rascunho, copiando titulo, descricao, valor e tags. A nova proposta fica vinculada a original.

#### Comparador
Pagina para selecionar duas propostas e visualizar lado a lado: titulo, cliente, status, valor, data, arquivos, motivo de perda e descricoes. Mostra a diferenca de valor calculada.

### Inteligencia Artificial

#### Construtor Inteligente de Propostas
Wizard de 4 etapas para criar propostas do zero com auxilio de IA:

1. **Cliente** - busca com autocomplete
2. **Servicos** - selecao de tags e descricao do escopo
3. **IA Sugere** - o sistema consulta o historico de propostas similares (mesmas tags, mesmo setor, mesmo cliente) e a OpenAI retorna:
   - Valor sugerido com faixa minima e maxima
   - Probabilidade de ganho baseada no historico
   - Escopo detalhado com etapas e prazo
   - Equipe sugerida
   - Alertas (ex: "ultima proposta perdida por preco a R$ 130k")
   - Propostas de referencia usadas no calculo
4. **Revisar** - formulario pre-preenchido pela IA, editavel antes de criar

#### Upload Inteligente
Drag-and-drop de arquivos com deteccao automatica pelo padrao de nome (`YYYY_MM_DD_Cliente_PropXXXX_Descricao.ext`). Apos upload para o Azure, a IA extrai do documento: resumo, valor, prazo, servicos oferecidos e pontos principais. O valor detectado e salvo automaticamente na proposta.

#### Sugestoes de Cross-sell
Na pagina do cliente, o botao "Gerar sugestoes" aciona a IA que analisa as propostas do cliente, de clientes do mesmo setor e os servicos mais vendidos globalmente. Retorna ate 5 sugestoes de novos servicos com motivo, nivel de confianca e valor estimado.

#### Resumo de Propostas
Extrai texto de PDFs, DOCX e PPTX e gera resumo automatico de 2-3 frases com a OpenAI.

### Prospeccao e Oportunidades

#### Radar de Oportunidades
Pagina que identifica automaticamente tres tipos de oportunidade:
- **Para retomada**: propostas perdidas cuja data de retomada definida no Pipeline ja passou
- **Perdidas ha 6+ meses**: propostas antigas com potencial de reabordagem
- **Clientes dormentes**: clientes sem contato recente, classificados por temperatura (quente 60-90 dias, morno 90-180 dias, frio 180+ dias), com motivo da oportunidade e metricas do cliente

#### Health Score
Indicador de 0 a 100 que mede a saude do relacionamento com cada cliente. Calculado com cinco fatores ponderados:
- Frequencia de interacoes no ultimo ano (25%)
- Taxa de conversao de propostas (25%)
- Recencia do ultimo contato (20%)
- Volume financeiro de propostas ganhas (15%)
- Diversidade de servicos contratados (15%)

Exibido na pagina do cliente com barras por fator e sugestoes automaticas quando algum indicador esta baixo.

#### Forecast de Receita
Projecao financeira com:
- Pipeline total e forecast ponderado (Rascunho 5%, Enviada 20%, Negociando 50%)
- Receita realizada no ano e media mensal
- Grafico de barras: ultimos 12 meses realizados + 3 meses projetados
- Funil visual por estagio com quantidade, valor e ponderacao
- Ranking das 10 maiores propostas ativas

### Gestao de Clientes

#### Cadastro
CRUD com busca por nome, filtros por setor (11 setores) e status (ativo/arquivado). Campos: nome, razao social, setor, contato, email, telefone, notas.

#### Pagina do Cliente
Visao completa com tres paineis:
- **Propostas**: cards com status, valor, tags, arquivos clicaveis e botao de clonar
- **Painel lateral**: Health Score, proximo follow-up, sugestoes de cross-sell (IA), informacoes de contato
- **Timeline unificada**: todas as atividades em ordem cronologica (propostas criadas/enviadas/ganhas/perdidas, reunioes, ligacoes, emails, visitas, notas, lembretes)

### Demais Funcionalidades

#### Busca Global (Ctrl+K)
Command palette que pesquisa simultaneamente em clientes, propostas e interacoes. Resultados agrupados por tipo com acesso direto. Sem digitar, exibe atalhos rapidos para Pipeline, Upload, Oportunidades, Forecast e Relatorios.

#### Lembretes
Gestao de follow-ups com duas abas (pendentes e concluidos). Lembretes vencidos em vermelho, do dia em amarelo. Podem ser vinculados a propostas e atribuidos a usuarios.

#### Relatorios
Graficos de pizza (propostas por status), barras (por mes), tabela de top 10 clientes e KPIs (total, ganhas, taxa de conversao). Exportacao para Excel.

#### Log de Atividades
Registro automatico de mudancas de status, atualizacoes e clones de propostas. Listagem paginada com filtros por tipo (propostas, clientes, interacoes, arquivos).

#### Autenticacao
Login e registro com email/senha via Supabase Auth. Perfis com papeis admin e membro. Row Level Security em todas as tabelas.

## Estrutura do Projeto

```
src/
  app/
    (auth)/                  # Login e registro
    (dashboard)/
      page.tsx               # Dashboard
      pipeline/              # Kanban
      clients/               # Listagem e detalhe de clientes
      proposals/             # Listagem e construtor inteligente
      opportunities/         # Radar de oportunidades
      upload/                # Upload inteligente
      forecast/              # Projecao de receita
      compare/               # Comparador de propostas
      reminders/             # Lembretes
      reports/               # Relatorios
      activity/              # Log de atividades
      settings/              # Configuracoes
    api/
      upload/                # Upload com Azure + analise IA
      files/[id]/            # Acesso a arquivos (SAS URL)
      proposals/[id]/        # PATCH status, tags; POST clone
      ai/
        summarize/           # Resumo de proposta
        proposal-builder/    # Construtor inteligente
        cross-sell/          # Sugestoes de cross-sell
      health-score/          # Calculo do health score
      search/                # Busca global federada
      activity-log/          # Log de atividades
  components/                # Componentes React
  lib/
    supabase/                # Clientes Supabase (server e browser)
    azure/                   # Utilitarios Azure Blob Storage
    ai/                      # Analise e sumarizacao com OpenAI
    parsers/                 # Extratores de texto (PDF, DOCX, PPTX)
    health-score.ts          # Calculo do health score
    parse-filename.ts        # Parser de nomes de arquivo
    activity-log.ts          # Registro de atividades
  types/
    database.ts              # Tipos TypeScript
supabase/
  migrations/
    001_initial_schema.sql   # Tabelas base
    002_pipeline_tags_loss.sql # Pipeline, tags, motivo de perda
    003_activity_log.sql     # Log de atividades
    004_ai_suggestion.sql    # Campo ai_suggestion
scripts/
  import-hub.ts              # Importa pastas locais para o banco
  upload-to-azure.ts         # Upload em massa para Azure
```

## Configuracao

### Variaveis de Ambiente (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=propostashub
AZURE_STORAGE_CONTAINER_NAME=hub-propostas
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

# Caminho local das propostas (para scripts de importacao)
HUB_PROPOSTAS_PATH=C:\Users\...\Hub Propostas
```

### Banco de Dados

Execute as migracoes em ordem no SQL Editor do Supabase:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_pipeline_tags_loss.sql
supabase/migrations/003_activity_log.sql
supabase/migrations/004_ai_suggestion.sql
```

### Scripts

```bash
# Importar propostas das pastas locais e subir para o Azure
npx tsx scripts/upload-to-azure.ts

# Importar clientes e propostas para o Supabase
npx tsx scripts/import-hub.ts
```

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).
