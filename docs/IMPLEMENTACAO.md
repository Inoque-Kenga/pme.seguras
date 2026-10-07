# Implementação — CyberPME

## Fase C1 — Módulos centrais (concluída)

### Organizações (`/admin/organizacoes`)

- Destinado ao super administrador; analistas de segurança podem consultar a lista.
- Campos estendidos: NIF, setor, dimensão (MICRO/PEQUENA/MEDIA/GRANDE), cidade, província, contactos e plano.
- Criar (`/admin/organizacoes/nova`), editar e arquivar (`/admin/organizacoes/[id]`).
- Arquivar é soft delete (`status = ARCHIVED`): os dados nunca são apagados fisicamente.
- Pesquisa por nome/slug/NIF, filtros por estado e setor, paginação.
- Auditoria: CREATE, UPDATE e STATUS_CHANGE (arquivamento).

### Utilizadores e membros (`/admin/utilizadores`, `/organizacoes/[id]/utilizadores`)

- Lista global de contas com pesquisa (apenas SUPER_ADMIN).
- Gestão de membros por organização: convidar (cria conta se o e-mail não existir), alterar papel, ativar/desativar, remover acesso.
- Regras implementadas em `lib/services/membership-rules.ts` (funções puras, testadas):
  - Não existem dois memberships ativos do mesmo utilizador na mesma organização.
  - Não é possível remover, desativar ou rebaixar o último GESTOR_CLIENTE ativo da organização.
  - Só SUPER_ADMIN pode atribuir o papel SUPER_ADMIN.
- Quem gere membros: SUPER_ADMIN (global) e GESTOR_CLIENTE (da organização).
- Auditoria: ASSIGN (convites e papéis), STATUS_CHANGE (ativação), DELETE (remoção de acesso).

### Inventário de ativos (`/organizacoes/[id]/ativos`)

- CRUD completo com campos de proteção: `protecaoEndpoint`, `mfaAplicavel`, `cifragem`, `ultimaAtualizacao`, além de marca/modelo, número de série, sistema operativo e IP (validado).
- Arquivar é soft delete (`archivedAt`); ativos arquivados saem das listagens e indicadores.
- Indicadores no topo: total, críticos, sem proteção de endpoint, sem atualização há mais de 30 dias, sem cifragem.
- Pesquisa (nome, modelo, série, proprietário), filtros (tipo, criticidade, estado, proteção, cifragem), paginação.
- Exportação CSV (`/organizacoes/[id]/ativos/exportar`) com os mesmos filtros; registada em auditoria (EXPORT).
- Detalhe (`/organizacoes/[id]/ativos/[assetId]`) com edição e listas de riscos, tickets e incidentes associados (só leitura nesta fase).
- RBAC: criar/editar/arquivar exclusivo de ANALISTA_SEGURANCA e GESTOR_CLIENTE; COLABORADOR apenas visualiza.

### Serviços e validação

- `lib/services/organization.service.ts`, `membership.service.ts`, `asset.service.ts`.
- Todos validam com Zod, verificam RBAC, filtram por `organizationId` e escrevem AuditLog.
- Erros tipados em `lib/services/errors.ts`: `VALIDATION | FORBIDDEN | NOT_FOUND | CONFLICT`.

### Testes (vitest)

- `tests/organization-schema.test.ts` e `tests/asset-schema.test.ts` — validação de schemas Zod.
- `tests/membership-rules.test.ts` — regras puras de membership (duplicação, último gestor, atribuição de SUPER_ADMIN).
- `tests/asset-access.test.ts` — isolamento multi-tenant com Prisma mockado: utilizador de uma organização não edita/arquiva ativos de outra; listagens sempre filtradas por `organizationId`; COLABORADOR bloqueado.
- Total: 25 testes.

## Fase C2 — Avaliações, riscos e tarefas (concluída)

### Avaliações de risco (`/organizacoes/[id]/avaliacoes`)

- Modelo `RiskAssessment`: título, descrição, domínio, responsável, datas e estado (RASCUNHO/EM_ANDAMENTO/CONCLUIDA).
- Criar (`/nova`), editar e mudar estado (`/[assessmentId]`); cada avaliação lista os riscos associados.
- Gerir avaliações é exclusivo de ANALISTA_SEGURANCA e GESTOR_CLIENTE.

### Riscos (`/organizacoes/[id]/riscos`)

- Modelo `Risk` migrado para a especificação: ameaça, vulnerabilidade, `probability` (1-5), `impact` (1-5), `level` e `riskLevel` (BAIXO/MEDIO/ALTO/CRITICO) calculados no serviço (`lib/risk-level.ts`, função pura testada), tratamento, responsável, prazo, estado (ABERTO/EM_TRATAMENTO/ACEITE/MITIGADO/FECHADO), ligações opcionais a ativo e avaliação.
- Três vistas: **lista** (filtros por nível, estado, responsável, ativo, prazo — vencidos/próximos 7 dias/sem prazo — e paginação), **matriz 5×5** (contagem por célula com cores por banda) e **kanban** por estado.
- Riscos ALTOS e CRÍTICOS destacados na lista (fundo vermelho + ⚠️).
- Criar/editar exclusivo de ANALISTA_SEGURANCA e GESTOR_CLIENTE; auditoria em CREATE/UPDATE/STATUS_CHANGE.

### Tarefas de tratamento (`/organizacoes/[id]/tarefas`)

- Modelo `RiskTreatmentTask` ligado obrigatoriamente a um risco; prioridade (BAIXA/MEDIA/ALTA/CRITICA), estado (NAO_INICIADA/EM_ANDAMENTO/CONCLUIDA/CANCELADA), responsável e prazo.
- Indicadores: tarefas vencidas e tarefas de prioridade alta/urgente abertas.
- Comentários simples (`TaskComment`) na página de detalhe — qualquer membro pode comentar.
- Filtros por estado, prioridade, responsável e prazo; paginação.

### Testes

- `tests/risk-level.test.ts` — bandas do nível de risco e matriz 5×5.
- `tests/risk-schema.test.ts` — schemas de Risk, RiskTreatmentTask e comentário.
- `tests/risk-access.test.ts` — isolamento multi-tenant (Prisma mockado): edição cross-org bloqueada, listagem sempre filtrada, COLABORADOR bloqueado, ativo de outra organização rejeitado.
- Total acumulado: 45 testes.

## Fase C3 — Backups, tickets, incidentes e phishing (concluída)

### Backups e recuperação (`/organizacoes/[id]/backups`)

- Modelos `BackupJob` (sistema, fornecedor, frequência DIARIA/SEMANAL/MENSAL/OUTRA, estado SUCESSO/FALHA/AVISO/DESCONHECIDO, tamanho, localização, retenção, RTO/RPO, último teste) e `BackupVerification` (testes de restauração).
- Indicadores: falhas nos últimos 7 dias, sem teste de restauração há +30 dias, estado desconhecido.
- Semáforo de saúde por backup (`backupSemaphore`, função pura testada): vermelho em falha/desconhecido, amarelo em aviso/atraso/sem teste recente.
- Edição exclusiva de ANALISTA_SEGURANCA e GESTOR_CLIENTE; COLABORADOR visualiza.

### Tickets e suporte (`/organizacoes/[id]/tickets`)

- `Ticket` com categoria (SUPORTE/INCIDENTE/SOLICITACAO/OUTRO), estado (ABERTO→FECHADO), prioridade, SLA em horas, ativo e ligações a incidente/report.
- `TicketComment` + `TicketEvent` (histórico de estados e atribuições visível no detalhe).
- Qualquer membro cria; apenas ANALISTA_SEGURANCA atribui/assume; ciclo de vida gerido por ANALISTA_SEGURANCA e GESTOR_CLIENTE; COLABORADOR comenta apenas nos seus tickets.
- Painel do analista (atribuídos + vencidos por SLA); tickets vencidos destacados com ⏰.

### Incidentes de segurança (`/organizacoes/[id]/incidentes`)

- 9 tipos (PHISHING, MALWARE, RANSOMWARE, ...), severidade, data/hora, sistemas afetados, ações imediatas, lições aprendidas, responsável, estado (REPORTADO→ENCERRADO).
- `IncidentTimelineEvent`: linha do tempo com eventos de estado, ações e notas.
- Checklist de resposta fixa e, para ransomware, orientação explícita: nunca pagar resgate, isolar, preservar evidências, avaliar backups, contactar apoio/autoridades.
- Conversão em ticket (ligado ao incidente) e atalho para registar risco.

### Reporte de phishing (`/organizacoes/[id]/phishing`)

- `PhishingReport`: canal (EMAIL/WHATSAPP/SMS/OUTRO), remetente, assunto, descrição, URL suspeita, classificação inicial, reportante.
- Qualquer membro reporta; triagem exclusiva de ANALISTA_SEGURANCA: em análise, falso positivo, converter em ticket ou em incidente (cria as entidades ligadas e muda o estado do report).
- URLs do seed são fictícios (`*.test`).

### Testes

- `tests/c3-schemas.test.ts` — schemas dos 4 módulos + semáforo de backups + SLA de tickets.
- `tests/c3-access.test.ts` — isolamento multi-tenant (listas filtradas, edição cross-org bloqueada) + regras de papel (COLABORADOR cria ticket mas não edita backups nem comenta tickets alheios).
- Total acumulado: 67 testes.

## Fase C4 — Score de segurança e dashboards (concluída)

### Motor de score (`lib/security-score.ts`, função pura)

- Score 0–100 por organização em 8 categorias com pesos (MFA 20, endpoints 15, backups 20, atualizações 10, rede 10, ativos 10, formação/phishing 10, incidentes/políticas 5).
- Faixas: CRITICO (<40), EM_RISCO (40-59), ACEITAVEL (60-79), BOM (≥80).
- Dados em falta (MFA por conta, segmentação de rede, políticas, formação) → pontuação conservadora (~25%) + selo "dados incompletos" (⚠︎). Nada é inventado.
- Fatores de redução (top 5) e ações recomendadas derivadas das categorias mais fracas.

### Serviço (`lib/services/security-score.service.ts`)

- `collectScoreInput` recolhe dados reais (assets, backups, campanhas, incidentes), sempre filtrados por `organizationId`.
- `computeAndStoreSnapshot`: guarda `SecurityScoreSnapshot` (máx. 1 por 24h) com `detalhesJson` e registo em auditoria.
- Histórico de 6 meses + comparação com o mês anterior para a variação (▲/▼).
- Dashboard global: `listOrganizationsWithScores` (filtros setor/dimensão/faixa) + `getGlobalAggregates` (riscos críticos abertos, incidentes críticos 30 dias).

### Dashboards

- `/organizacoes/[id]/dashboard` — radial do score, barras por categoria, linha de evolução 6 meses, fatores, recomendações, riscos críticos/altos, semáforo de backups, tickets por prioridade, incidentes 30 dias; etiqueta de dados de demonstração e de indicadores incompletos.
- `/dashboard` — global para SUPER_ADMIN/ANALISTA_SEGURANCA (lista + agregados); outros papéis são redirecionados para o dashboard da sua organização.
- Gráficos em Recharts (`components/score-charts.tsx`); cores sempre acompanhadas de texto/ícones.

### Testes

- `tests/security-score.test.ts` — cálculo com dados fictícios, conservadorismo sem dados, penalizações (falhas de backup, cliques de phishing), bandas de classificação.
- `tests/score-access.test.ts` — todas as queries do cálculo filtradas por `organizationId`; snapshots não duplicados dentro de 24h.
- Total acumulado: 76 testes.

## Fase D1 — Segurança da plataforma (concluída)

### Rate limiting (`lib/rate-limit.ts`)

- Tabela `RateLimitEntry` (janela fixa, limpeza lazy) — funciona com várias instâncias.
- Limites: login 5/15 min (por e-mail), recuperação 3/1h (por e-mail), reportes 10/1h (por utilizador).
- Excedido → mensagem clara com tempo de espera + auditoria (`RATE_LIMIT_EXCEEDED`, sem passwords).
- Nota: limitação por IP não é aplicável em server actions/NextAuth sem proxy; documentado no README.

### Recuperação de password

- Rotas públicas `/recuperar-password` e `/redefinir-password/[token]`.
- Token aleatório (32 bytes) guardado como **hash SHA-256**, validade 1 hora, uso único (`PasswordResetToken`).
- Resposta anti-enumeração (não revela se o e-mail existe); em dev a ligação aparece no terminal e na página.
- Sucesso → password com política forte (12+ chars, maiúscula, minúscula, dígito) + **todas as sessões revogadas**.
- Auditoria em pedido, sucesso e falha (sem passwords).

### MFA TOTP

- Campos `mfaEnabled`, `mfaSecret` (cifrado AES-256-GCM), `mfaBackupCodes` (hashes) em `User`.
- Ativação em `/seguranca`: QR code (`generateURI` otplib v13 + `qrcode`) → validação do 1.º código → 8 códigos de backup mostrados uma única vez.
- Login: após password correta, `authorize()` exige código TOTP ou backup (erro `MFA_REQUIRED` → segundo passo no formulário de login). Backups são de uso único (consumidos).
- Desativação exige password atual + TOTP; regenerar códigos exige TOTP e invalida os antigos.
- Auditoria em ativação, desativação, regeneração e falhas de MFA no login.
- Nota de design: o segundo passo MFA está integrado no `/login` (NextAuth credentials não suporta "meia-sessão" sem estado extra); `/mfa-verify` redireciona para `/login`.

### Página de segurança (`/seguranca`)

- Estado do MFA + ativação/desativação, códigos de backup restantes e regeneração.
- Alteração de password (exige a atual; revoga as outras sessões).
- Sessões ativas (`UserSession` registada no login via callback JWT; revogar individual ou todas as outras; sessões revogadas são rejeitadas no `requireSession`).
- Últimos logins (sucesso/falha) a partir da auditoria; logout auditado via evento `signOut`.

### Testes

- `tests/rate-limit.test.ts` — janelas, bloqueio com tempo de espera e auditoria.
- `tests/password-reset.test.ts` — fluxo completo, anti-enumeração, token hash, password fraca.
- `tests/mfa.test.ts` — TOTP real (otplib v13), backups de uso único, login MFA.
- `tests/session-access.test.ts` — não é possível terminar sessões de outro utilizador.
- Total acumulado: 95 testes.

## Fase D2 — Políticas e formações (concluída)

### Políticas de segurança (`/organizacoes/[id]/politicas`)

- Modelo `SecurityPolicy` (7 categorias, estado RASCUNHO/PUBLICADA/EM_REVISAO, versão) + `PolicyVersion` (histórico).
- Edição de política **publicada** arquiva a versão atual e incrementa automaticamente; histórico visível no detalhe.
- COLABORADOR vê apenas publicadas; criação/edição exclusiva de ANALISTA_SEGURANCA e GESTOR_CLIENTE.
- Auditoria em criação, edição e mudança de estado/publicação.

### Formações e questionários (`/organizacoes/[id]/formacoes`, `/minhas-formacoes`)

- `TrainingModule` (por organização ou global) + `TrainingQuestion` (escolha múltipla, máx. 5) + `TrainingAssignment` (global ou por utilizador) + `TrainingCompletion` (score, validade, estado).
- Atribuição cria completions em massa (membros ativos); membros novos recebem lazy no acesso.
- Questionário sem respostas corretas no cliente; submissão avaliada no servidor (≥70% aprova) → CONCLUIDO com `validoAte = conclusão + validadeMeses`; reprovado fica EM_ANDAMENTO e pode tentar de novo.
- Expiração lazy (leitura marca EXPIRADO) via função pura `effectiveCompletionState` (testada).
- Painel de gestão: % de utilizadores válidos, pendentes e expirados.

### Ajuste do score

- "Formação e phishing" (10): % de utilizadores únicos com formação válida (fallback para taxa de cliques se não houver formações; conservador se nenhum dos dois).
- "Resposta a incidentes e políticas" (5): política publicada em categoria chave (PASSWORDS/RESPOSTA_INCIDENTES/USO_ACEITAVEL) → 3 pts + incidentes tratados → +2.
- Fatores do dashboard refletem estes dados ("Apenas 40% dos utilizadores têm formação válida", "sem política publicada").

### Testes

- Schemas dos 4 modelos; `computeValidUntil`; `effectiveCompletionState`; score com formações/políticas; isolamento multi-tenant (COLABORADOR só vê publicadas e as suas completions).
- Total acumulado: 120 testes.

## Fase D3 — Relatórios mensais PDF (concluída)

### Modelo e geração (`lib/services/report.service.ts`)

- `SecurityReport` (um por mês/organização, `@@unique(organizationId, mesReferencia)`): score, categoria, resumo executivo, secções em JSON, estado (GERADO/PUBLICADO/ARQUIVADO), autor e data de geração.
- `gerarRelatorio` recolhe dados reais do mês (score + variação, riscos altos/críticos, backups, tickets, incidentes, formações, políticas) e faz upsert (regenerar = substituir com dados frescos).
- Conteúdo gerado por funções puras testadas (`lib/report-content.ts`):
  - `buildExecutiveSummary` — texto estruturado por regras (score, variação, riscos, backups, incidentes, formação, políticas).
  - `buildRecommendedActions` — 3–7 ações priorizadas por gap (incidentes críticos → riscos críticos → falhas de backup → testes → SLA → formação → políticas).
- Auditoria em geração e mudanças de estado; gestão exclusiva de ANALISTA_SEGURANCA e GESTOR_CLIENTE.

### Rotas e UI

- `/organizacoes/[id]/relatorios` — lista com filtros por mês/estado + gerar mês atual.
- `/relatorios/novo` — escolha do mês de referência.
- `/relatorios/[reportId]` — documento com 6 secções numeradas (resumo executivo, riscos, backups com semáforo, tickets/incidentes, formações/políticas, ações) + rodapé legal.
- Exportação PDF via `window.print()` com CSS `@media print` (navegação escondida, secções sem quebra).

### Testes

- `tests/report-content.test.ts` — resumo executivo e recomendações (cenários positivo/negativo/máximo).
- `tests/report-access.test.ts` — isolamento multi-tenant e validação do mês.
- Total acumulado: 134 testes.

## Próximos passos opcionais

- Geração de PDF no servidor (@react-pdf/renderer) para anexos automáticos.
- Envio mensal agendado por e-mail (integração SMTP) dos relatórios publicados.
- Campos de MFA por conta administrativa e de segmentação de rede para completar o score.
- Rate limiting por IP ao nível do proxy/middleware de plataforma.

## Fase C concluída ✅

C1 (organizações/utilizadores/ativos) → C2 (avaliações/riscos/tarefas) → C3 (backups/tickets/incidentes/phishing) → C4 (score/dashboards).

## Próximos passos opcionais

- Módulo de formações (`TrainingAssignment`) e políticas (`SecurityPolicy`) para alimentar as categorias hoje conservadoras.
- Campo de MFA por conta e dados de rede para o mesmo fim.
- Integrações reais (EDR, e-mail, backups) via adaptadores, com segredos em gestor de segredos.
- Endurecimento: recuperação de palavra-passe, rate limiting, CSP com nonce, MFA.
- Relatórios exportáveis (PDF) do score e da postura de segurança.
