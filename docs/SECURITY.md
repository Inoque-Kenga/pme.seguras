# Segurança — CyberPME

## Modelo de ameaças resumido

As principais ameaças consideradas são acesso entre organizações (IDOR), roubo de credenciais, permissões excessivas, exposição de dados por logs e configuração incorreta de integrações.

## Medidas na fundação

- Passwords de demonstração são armazenadas com bcrypt e o seed não corre em produção.
- Sessões JWT têm duração limitada; cookies são geridos pelo NextAuth.
- Rotas privadas são protegidas por middleware e há helpers de autorização no servidor.
- Todas as organizações são relacionadas por associações explícitas; endpoints e serviços devem aplicar a mesma fronteira.
- Cabeçalhos HTTP incluem `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Inputs de login têm validação Zod; erros de credenciais são genéricos.
- Eventos de auditoria guardam referências e metadados opcionais minimizados.

## Segredos, privacidade e logs

Não guardar tokens, passwords ou strings de ligação no repositório. Usar `.env` local não versionado e um gestor de segredos em produção. Os logs não devem conter passwords, tokens ou dados pessoais desnecessários. Utilizar apenas os dados fictícios incluídos no seed.

## Proteção contra IDOR

Autorização baseada somente em IDs fornecidos pelo cliente é proibida. Resolver associação ativa do utilizador à organização e incluir `organizationId` em todas as consultas de entidades multi-tenant. A proteção de interface ou middleware, isoladamente, não é suficiente.

## Reporte de vulnerabilidades

Reporte vulnerabilidades ao responsável pela implementação por um canal privado, incluindo passos para reproduzir e impacto. Não inclua dados reais de clientes. Não publique detalhes exploráveis antes de existir correção.

## Limitações

Rate limiting, recuperação de palavra-passe, CSP baseada em nonce, MFA e gestão de segredos integrada ainda não estão implementados. A aplicação não deve ser exposta à Internet nem usada com dados reais até essas medidas e uma revisão independente estarem concluídas.
