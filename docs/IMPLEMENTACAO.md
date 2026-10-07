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

## Próximos passos — Fase C3 (backups, tickets, incidentes, phishing)

- Revisitar os módulos de backups, tickets, incidentes e phishing com a estrutura org-scoped (`/organizacoes/[id]/...`) e o padrão de serviços tipados da Fase C1/C2.
- Destaque de riscos críticos no dashboard (hoje apenas na lista, conforme especificado).
- Notificações internas de prazos em atraso.
- Evolução posterior: recuperação de palavra-passe, rate limiting, CSP com nonce, MFA.
