# Arquitetura — CyberPME

## Fundação

O Next.js App Router fornece páginas e endpoints. Os componentes de layout podem ser renderizados no servidor e o formulário de login usa uma pequena camada cliente para chamar NextAuth. O acesso a PostgreSQL é feito apenas pelo Prisma no servidor.

## Multi-tenancy

As organizações são a fronteira de isolamento. As associações `OrganizationMembership` ligam utilizadores a organizações e guardam papel e estado. Serviços com dados de cliente devem obter `organizationId` da sessão/associação verificada e nunca confiar num identificador fornecido pelo browser. `requireOrganizationAccess` é o helper inicial de autorização.

## Autenticação e RBAC

NextAuth Credentials verifica utilizador ativo e hash bcrypt. A sessão usa JWT com duração limitada e inclui apenas o ID do utilizador e associações/roles. `middleware.ts` protege as rotas privadas selecionadas; verificações no servidor continuam obrigatórias dentro de cada serviço. `SUPER_ADMIN` tem âmbito global; restantes papéis dependem das associações.

## Serviços e auditoria

`lib/` centraliza a instância Prisma, helpers RBAC e escrita de eventos de auditoria. Os serviços de domínio em `lib/services/` validam entradas (Zod), autorizam a operação por papel, restringem por organização e registam alterações relevantes em `AuditLog`. As páginas chamam os serviços através de server actions (`app/<módulo>/actions.ts`); os metadados de auditoria são minimizados.

## Score e integrações futuras

O cálculo de score está isolado no serviço puro `lib/score.ts`, com pesos e fatores explicáveis (riscos, incidentes, tarefas, backups e phishing). Integrações externas devem ser adaptadores sem chamadas reais enquanto não houver credenciais configuradas. Segredos futuros devem residir em ambiente seguro ou gestor de segredos, nunca nos metadados visíveis ao cliente.
