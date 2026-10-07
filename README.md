# CyberPME

Plataforma SaaS multiempresa para gestão de cibersegurança de pequenas e médias empresas. Este incremento entrega a **Fase A — Preparação**, a **Fase B — Fundação**, a **Fase C1 — Módulos centrais** (gestão de organizações, utilizadores/membros e inventário de ativos) e os módulos de gestão (riscos, tarefas, backups, tickets, incidentes, phishing simulado, score e dashboard).

## Módulos centrais (Fase C1)

- **Organizações** (`/admin/organizacoes`) — gestão de empresas clientes pelo super administrador: criar, editar, arquivar (soft delete), pesquisa por nome/slug/NIF, filtros por estado e setor, paginação.
- **Utilizadores e membros** (`/admin/utilizadores` e `/organizacoes/[id]/utilizadores`) — lista global de contas, convite de utilizadores para organizações, alteração de papéis (só SUPER_ADMIN atribui SUPER_ADMIN), ativação/desativação e remoção de acessos. Regras: sem memberships duplicados e sem remover o último gestor cliente.
- **Inventário de ativos** (`/organizacoes/[id]/ativos`) — CRUD com campos de proteção (endpoint, MFA, cifragem), pesquisa e filtros, paginação, indicadores no topo, exportação CSV e página de detalhe com riscos, tickets e incidentes associados. Criar/editar é exclusivo de ANALISTA_SEGURANCA e GESTOR_CLIENTE; COLABORADOR apenas visualiza.

## Riscos e tarefas (Fase C2)

- **Avaliações de risco** (`/organizacoes/[id]/avaliacoes`) — agrupam riscos por período e domínio, com responsável e estado (rascunho, em andamento, concluída).
- **Riscos** (`/organizacoes/[id]/riscos`) — ameaça, vulnerabilidade, probabilidade (1-5) e impacto (1-5); o nível é calculado automaticamente (probabilidade × impacto) e classificado em Baixo/Médio/Alto/Crítico. Vistas em lista (com filtros por nível, estado, responsável, ativo e prazo), **matriz 5×5** e **kanban** por estado. Riscos altos e críticos são destacados.
- **Tarefas de tratamento** (`/organizacoes/[id]/tarefas`) — cada tarefa está associada a um risco, com responsável, prioridade, prazo, comentários simples e indicadores de tarefas vencidas e de prioridade alta/urgente abertas.
- Criar/gerir é exclusivo de ANALISTA_SEGURANCA e GESTOR_CLIENTE; COLABORADOR apenas visualiza e comenta.

## Continuidade e resposta (Fase C3)

- **Backups e recuperação** (`/organizacoes/[id]/backups`) — registo de sistemas protegidos com fornecedor, frequência, RTO/RPO e retenção; testes de restauração (`BackupVerification`); indicadores (falhas 7 dias, sem teste +30 dias, desconhecidos) e semáforo de saúde por backup.
- **Tickets e suporte** (`/organizacoes/[id]/tickets`) — qualquer colaborador abre tickets; comentários, histórico de alterações, SLA com destaque de vencidos e painel do analista. Só ANALISTA_SEGURANCA atribui/assume; COLABORADOR comenta nos seus tickets.
- **Incidentes de segurança** (`/organizacoes/[id]/incidentes`) — 9 tipos (phishing, ransomware, etc.), severidade, sistemas afetados, ações imediatas, lições aprendidas, linha do tempo e checklist de resposta. Conversão em ticket ou risco. Orientação explícita anti-pagamento de resgate em ransomware.
- **Reporte de phishing** (`/organizacoes/[id]/phishing`) — formulário simples para qualquer colaborador reportar mensagens suspeitas (e-mail, WhatsApp, SMS); triagem pelo analista: falso positivo, converter em ticket ou em incidente.

## Score de segurança e dashboards (Fase C4)

O **score de segurança** (0–100) é calculado por organização a partir dos dados reais registados, em 8 categorias com pesos:

| Categoria | Peso | Base de cálculo |
|---|---|---|
| Gestão de identidade e MFA | 20 | % de contas administrativas com MFA (sem dados → conservador) |
| Proteção de endpoints | 15 | % de computadores com proteção de endpoint |
| Backups e recuperação | 20 | Backups com sucesso nos últimos 30 dias − penalização por falhas |
| Atualizações e vulnerabilidades | 10 | % de ativos atualizados nos últimos 30 dias |
| Segurança de rede | 10 | Firewall e Wi-Fi segmentado (sem dados → conservador) |
| Gestão de ativos | 10 | % de ativos com responsável e localização preenchidos |
| Formação e phishing | 10 | % de utilizadores com formação válida (ou taxa de cliques, se não houver formações) |
| Resposta a incidentes e políticas | 5 | Política publicada em categoria chave + incidentes tratados |

Faixas: **Crítico** (<40) · **Em risco** (40–59) · **Aceitável** (60–79) · **Bom** (≥80). Indicadores sem dados recebem pontuação conservadora e são marcados como incompletos (⚠︎) — nunca são inventados.

- **Dashboard da organização** (`/organizacoes/[id]/dashboard`) — score radial, score por categoria, evolução de 6 meses, principais fatores de redução, ações recomendadas, riscos críticos/altos abertos, semáforo de backups, tickets por prioridade e incidentes recentes.
- **Dashboard global** (`/dashboard`, SUPER_ADMIN e ANALISTA_SEGURANCA) — todas as organizações com score, filtros por setor/dimensão/faixa, agregados (organizações por faixa, riscos críticos abertos, incidentes críticos no último mês).
- Snapshots (`SecurityScoreSnapshot`) guardados automaticamente (máx. 1/24h) e registados em auditoria.

## O que está preparado

- Next.js App Router com TypeScript strict, Tailwind CSS e ESLint.
- PostgreSQL local por Docker Compose e schema Prisma multi-tenant.
- Seed apenas de desenvolvimento, com organizações, utilizadores e registos fictícios.
- Login por credenciais com palavra-passe bcrypt e sessão JWT através de NextAuth.
- **MFA TOTP** (Google Authenticator, Authy...) com QR code e códigos de backup de uso único.
- **Recuperação de palavra-passe** com token de uso único (1 hora) e invalidação de sessões.
- **Rate limiting** no login, na recuperação de password e nos reportes (contadores em BD).
- **Página de segurança** (`/seguranca`): MFA, palavra-passe, sessões ativas e últimos logins.
- **Políticas de segurança** com versionamento automático e histórico (`/organizacoes/[id]/politicas`).
- **Formações e questionários** com atribuição global ou por utilizador, validade e painel de conclusão (`/organizacoes/[id]/formacoes`, `/organizacoes/[id]/minhas-formacoes`).
- **Relatórios mensais** com resumo executivo, score, riscos, backups, tickets, incidentes, formações e ações recomendadas — visualização HTML pronta para imprimir/guardar como PDF (`/organizacoes/[id]/relatorios`).
- Proteção de rotas, autorização RBAC e isolamento por organização em todos os serviços.
- Layout responsivo, navegação por papel e seletor de organização.
- Módulos de gestão: ativos, riscos, tarefas, backups, tickets, incidentes e phishing.
- Administração: gestão de organizações e de utilizadores/acessos (super administrador).
- Score de segurança explicável (0-100) e dashboards com gráficos (recharts).
- Registo de auditoria central e cabeçalhos HTTP de segurança.

## Pré-requisitos

- Node.js 20 ou superior e npm.
- Docker Desktop com Docker Compose.

## Instalação local

```powershell
npm install
Copy-Item .env.example .env
```

Gera um segredo local e substitui `NEXTAUTH_SECRET` em `.env`. Mantém `.env` fora do controlo de versões. A password `DEMO_PASSWORD` só se usa no seed local.

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`. O seed aborta em ambiente `production`.

## Contas de demonstração

As contas são criadas pelo seed. Todas usam a variável local `DEMO_PASSWORD`:

- `admin@cyberpme.demo` — Super administrador.
- `demo.analista_seguranca@cyberpme.demo` — Analista de segurança.
- `demo.gestor_cliente@cyberpme.demo` — Gestor cliente.
- `demo.colaborador@cyberpme.demo` — Colaborador.

Password local de exemplo, não utilizável em produção: `CyberPME-Demo-Only-2026!`. Altera-a localmente se preferires. Nunca reutilizes esta password.

### Testar o MFA em demonstração

1. Entra com uma conta demo e vai a **Segurança → Ativar MFA**.
2. Lê o QR code com o Google Authenticator/Authy (ou usa o segredo mostrado).
3. Confirma com o código de 6 dígitos e guarda os códigos de backup.
4. No próximo login, após a palavra-passe, a plataforma pede o código da app (ou um código de backup).

## Comandos

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Rotas principais

```text
/recuperar-password                     Pedido de recuperação de password
/redefinir-password/[token]             Redefinir password com token (1h, uso único)
/seguranca                              Segurança da conta (MFA, sessões, logins, password)
/mfa-verify                             (redireciona para /login — MFA integrado no login)
/admin/organizacoes                       Gestão de organizações (SUPER_ADMIN)
/admin/organizacoes/nova                  Criar organização
/admin/organizacoes/[id]                  Detalhe, edição e arquivamento
/admin/utilizadores                       Lista global de utilizadores (SUPER_ADMIN)
/organizacoes/[id]/utilizadores           Membros de uma organização
/organizacoes/[id]/ativos                 Inventário de ativos (+ indicadores, CSV)
/organizacoes/[id]/ativos/novo            Registar ativo
/organizacoes/[id]/ativos/[assetId]       Detalhe e edição do ativo
/organizacoes/[id]/ativos/exportar        Exportação CSV
/organizacoes/[id]/avaliacoes             Avaliações de risco
/organizacoes/[id]/riscos                 Riscos (lista, matriz 5×5, kanban)
/organizacoes/[id]/riscos/novo            Registar risco
/organizacoes/[id]/riscos/[riskId]        Detalhe e edição do risco
/organizacoes/[id]/tarefas                Tarefas de tratamento (+ indicadores)
/organizacoes/[id]/tarefas/nova           Criar tarefa (associada a um risco)
/organizacoes/[id]/tarefas/[taskId]       Detalhe, edição e comentários
/organizacoes/[id]/backups                Backups (+ indicadores e semáforo)
/organizacoes/[id]/backups/[backupId]     Detalhe e testes de restauração
/organizacoes/[id]/tickets                Tickets (+ painel do analista, SLA)
/organizacoes/[id]/tickets/[ticketId]     Detalhe, comentários e histórico
/organizacoes/[id]/incidentes             Incidentes de segurança
/organizacoes/[id]/incidentes/[incidentId] Detalhe, linha do tempo, conversões
/organizacoes/[id]/phishing               Reports de phishing + triagem
/organizacoes/[id]/phishing/novo          Reportar mensagem suspeita
/organizacoes/[id]/politicas              Políticas de segurança (+ versões)
/organizacoes/[id]/formacoes              Módulos, perguntas e atribuições
/organizacoes/[id]/minhas-formacoes       Formações atribuídas ao utilizador
/organizacoes/[id]/relatorios             Relatórios mensais (lista + gerar)
/organizacoes/[id]/relatorios/[reportId]  Relatório (imprimir / guardar PDF)
/organizacoes/[id]/dashboard              Dashboard da organização (score)
/dashboard                              Dashboard global (admins)
```

## Estrutura

```text
app/                 Rotas e páginas App Router (um diretório por módulo)
components/          Layout, componentes de interface e gráficos
components/ui/       Componentes base (botão, skeleton, diálogo de confirmação)
lib/                 Prisma, autenticação, RBAC, auditoria, score e labels
lib/services/        Serviços de domínio (validação Zod, RBAC, auditoria, erros tipados)
prisma/              Schema e seed de demonstração
tests/               Testes unitários e de isolamento multi-tenant (vitest)
types/               Extensões de tipos do NextAuth
docs/                Decisões de arquitetura, segurança e implementação
```

## Segurança e limitações atuais

- Os dados são fictícios e marcados como demonstração.
- Não há monitorização real nem integrações externas configuradas; as campanhas de phishing são apenas simuladas (sem envio de e-mails).
- Os segredos de integração não fazem parte do schema público nem do frontend.
- O middleware melhora a proteção de navegação, mas a autorização efetiva é feita em cada serviço de domínio, sempre com o `organizationId` resolvido da sessão.
- A recuperação de palavra-passe mostra a ligação no terminal em desenvolvimento; o envio por e-mail é uma integração futura.
- O rate limiting é aplicado por e-mail (login/recuperação) e por utilizador (reportes); limitação por IP exige captura de IP ao nível do proxy, planeado para uma fase futura.
- Esta plataforma apoia a gestão de riscos e não substitui uma auditoria formal ou consultoria jurídica.
