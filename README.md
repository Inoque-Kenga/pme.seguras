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

## O que está preparado

- Next.js App Router com TypeScript strict, Tailwind CSS e ESLint.
- PostgreSQL local por Docker Compose e schema Prisma multi-tenant.
- Seed apenas de desenvolvimento, com organizações, utilizadores e registos fictícios.
- Login por credenciais com palavra-passe bcrypt e sessão JWT através de NextAuth.
- Proteção de rotas, autorização RBAC e isolamento por organização em todos os serviços.
- Layout responsivo, navegação por papel e seletor de organização.
- Módulos de gestão: ativos, riscos, tarefas, backups, tickets, incidentes e simulações de phishing.
- Administração: gestão de organizações e de utilizadores/acessos (super administrador).
- Score de segurança explicável (0-100) e dashboard com gráficos (recharts).
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

## Comandos

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Rotas principais

```text
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
- A autenticação atual suporta credenciais; recuperação de palavra-passe e rate limiting ainda não estão implementados.
- Esta plataforma apoia a gestão de riscos e não substitui uma auditoria formal ou consultoria jurídica.
