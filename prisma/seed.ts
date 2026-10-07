import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("A seed de demonstração não pode ser executada em produção.");
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Define DEMO_PASSWORD com pelo menos 12 caracteres antes do seed.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const organizations = [
    {
      name: "Clínica Vida Segura",
      slug: "clinica-vida-segura",
      nif: "5000123456",
      sector: "Saúde",
      dimensao: "PEQUENA" as const,
      city: "Luanda",
      provincia: "Luanda",
      contactoNome: "Dra. Marta Fictícia",
      contactoEmail: "contacto@clinica-vida-segura.demo",
      contactoTelefone: "+244 900 000 001",
    },
    {
      name: "Kwanza Comércio Digital",
      slug: "kwanza-comercio-digital",
      nif: "5000654321",
      sector: "Comércio",
      dimensao: "MICRO" as const,
      city: "Benguela",
      provincia: "Benguela",
      contactoNome: "Sr. Paulo Exemplo",
      contactoEmail: "geral@kwanza-comercio.demo",
      contactoTelefone: "+244 900 000 002",
    },
    {
      name: "Academia Horizonte",
      slug: "academia-horizonte",
      nif: "5000998877",
      sector: "Educação",
      dimensao: "MEDIA" as const,
      city: "Huambo",
      provincia: "Huambo",
      contactoNome: "Prof. João Demonstração",
      contactoEmail: "info@academia-horizonte.demo",
      contactoTelefone: "+244 900 000 003",
    },
  ];

  const plan = await prisma.subscriptionPlan.upsert({
    where: { name: "Demonstração" },
    update: { isActive: true },
    create: {
      name: "Demonstração",
      description: "Plano local de demonstração, sem cobrança.",
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@cyberpme.demo" },
    update: { name: "Administrador CyberPME", passwordHash, isActive: true, emailVerified: new Date() },
    create: {
      name: "Administrador CyberPME",
      email: "admin@cyberpme.demo",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  for (const organizationData of organizations) {
    const organization = await prisma.organization.upsert({
      where: { slug: organizationData.slug },
      update: { ...organizationData, planoId: plan.id },
      create: { ...organizationData, planoId: plan.id },
    });

    const adminMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: superAdmin.id, organizationId: organization.id } },
    });
    if (!adminMembership) {
      await prisma.organizationMembership.create({
        data: {
          userId: superAdmin.id,
          organizationId: organization.id,
          role: Role.SUPER_ADMIN,
        },
      });
    }
  }

  const demoUsers: { email: string; name: string; role: Role }[] = [];
  for (const [index, role] of [
    Role.ANALISTA_SEGURANCA,
    Role.GESTOR_CLIENTE,
    Role.COLABORADOR,
  ].entries()) {
    const email = `demo.${role.toLowerCase()}@cyberpme.demo`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        email,
        name: ["Analista de Demonstração", "Gestor de Demonstração", "Colaborador de Demonstração"][index],
        passwordHash,
      },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug: organizations[index === 0 ? 0 : 1].slug },
    });
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: { role, status: "ACTIVE" },
      create: { userId: user.id, organizationId: organization.id, role },
    });
    demoUsers.push({ email, name: user.name, role });
  }

  // ---------------------------------------------------------------------
  // Dados de demonstração da Fase C (apenas se a organização ainda não tiver)
  // ---------------------------------------------------------------------
  const clinica = await prisma.organization.findUniqueOrThrow({ where: { slug: "clinica-vida-segura" } });
  const kwanza = await prisma.organization.findUniqueOrThrow({ where: { slug: "kwanza-comercio-digital" } });
  const analista = await prisma.user.findUniqueOrThrow({ where: { email: "demo.analista_seguranca@cyberpme.demo" } });
  const gestor = await prisma.user.findUniqueOrThrow({ where: { email: "demo.gestor_cliente@cyberpme.demo" } });

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  if ((await prisma.asset.count({ where: { organizationId: clinica.id } })) === 0) {
    const servidor = await prisma.asset.create({
      data: {
        organizationId: clinica.id,
        name: "Servidor de registos clínicos",
        type: "HARDWARE",
        marcaModelo: "Dell PowerEdge T350 (demo)",
        numeroSerie: "DEMO-SN-0001",
        sistemaOperativo: "Windows Server 2022",
        ip: "192.168.10.5",
        criticality: "CRITICAL",
        owner: "TI interno",
        location: "Sala técnica — Luanda",
        protecaoEndpoint: true,
        ultimaAtualizacao: daysAgo(5),
        mfaAplicavel: true,
        cifragem: true,
        description: "Servidor principal com dados de pacientes (demonstração).",
      },
    });
    await prisma.asset.createMany({
      data: [
        {
          organizationId: clinica.id,
          name: "Sistema de agendamento online",
          type: "SOFTWARE",
          marcaModelo: "Aplicação web interna",
          criticality: "HIGH",
          owner: "Receção",
          protecaoEndpoint: false,
          ultimaAtualizacao: daysAgo(45),
          mfaAplicavel: true,
          cifragem: false,
          description: "Aplicação web de marcações (demonstração).",
        },
        {
          organizationId: clinica.id,
          name: "Base de dados de pacientes",
          type: "DATA",
          criticality: "CRITICAL",
          owner: "Direção clínica",
          protecaoEndpoint: true,
          ultimaAtualizacao: daysAgo(2),
          cifragem: true,
        },
        {
          organizationId: clinica.id,
          name: "Rede Wi-Fi de visitantes",
          type: "NETWORK",
          criticality: "LOW",
          protecaoEndpoint: false,
          cifragem: false,
        },
        {
          organizationId: clinica.id,
          name: "Portátil da receção",
          type: "HARDWARE",
          marcaModelo: "Lenovo ThinkPad E14 (demo)",
          numeroSerie: "DEMO-SN-0002",
          sistemaOperativo: "Windows 11 Pro",
          criticality: "MEDIUM",
          status: "UNDER_MAINTENANCE",
          owner: "Receção",
          protecaoEndpoint: false,
          ultimaAtualizacao: daysAgo(70),
          cifragem: false,
        },
      ],
    });

    const avaliacaoClinica = await prisma.riskAssessment.create({
      data: {
        organizationId: clinica.id,
        title: "Avaliação anual 2026",
        description: "Avaliação de risco anual aos sistemas de informação da clínica (demonstração).",
        domain: "Sistemas de informação",
        ownerId: analista.id,
        startDate: daysAgo(30),
        status: "EM_ANDAMENTO",
      },
    });

    const riscoAcesso = await prisma.risk.create({
      data: {
        organizationId: clinica.id,
        assessmentId: avaliacaoClinica.id,
        title: "Acesso indevido a registos clínicos",
        description: "Contas partilhadas na receção podem expor dados de pacientes.",
        threat: "Acesso não autorizado por pessoal interno",
        vulnerability: "Contas partilhadas sem autenticação individual",
        probability: 4,
        impact: 5,
        level: 20,
        riskLevel: "CRITICO",
        status: "EM_TRATAMENTO",
        treatment: "Contas individuais e revisão trimestral de acessos.",
        ownerId: analista.id,
        dueDate: daysAhead(30),
        assetId: servidor.id,
      },
    });
    const riscoRansomware = await prisma.risk.create({
      data: {
        organizationId: clinica.id,
        assessmentId: avaliacaoClinica.id,
        title: "Ransomware em postos de trabalho",
        threat: "Ransomware via e-mail ou pen drive",
        vulnerability: "Estações sem proteção de endpoint",
        probability: 3,
        impact: 4,
        level: 12,
        riskLevel: "ALTO",
        status: "EM_TRATAMENTO",
        treatment: "Backup diário e formação anti-phishing.",
        ownerId: analista.id,
        dueDate: daysAhead(60),
      },
    });
    await prisma.risk.createMany({
      data: [
        {
          organizationId: clinica.id,
          assessmentId: avaliacaoClinica.id,
          title: "Falha elétrica prolongada",
          threat: "Corte prolongado de energia",
          vulnerability: "Sem gerador de reserva",
          probability: 2,
          impact: 3,
          level: 6,
          riskLevel: "MEDIO",
          status: "ACEITE",
        },
        {
          organizationId: clinica.id,
          title: "Perda de dispositivo móvel com dados",
          threat: "Roubo ou perda de portátil/telemóvel",
          vulnerability: "Portátil da receção sem cifragem",
          probability: 2,
          impact: 4,
          level: 8,
          riskLevel: "MEDIO",
          status: "ABERTO",
          dueDate: daysAgo(2),
        },
      ],
    });

    const tarefaMfa = await prisma.riskTreatmentTask.create({
      data: {
        organizationId: clinica.id,
        riskId: riscoAcesso.id,
        title: "Ativar autenticação de dois fatores no e-mail",
        status: "EM_ANDAMENTO",
        priority: "HIGH",
        dueDate: daysAhead(7),
        assigneeId: analista.id,
      },
    });
    await prisma.riskTreatmentTask.createMany({
      data: [
        {
          organizationId: clinica.id,
          riskId: riscoAcesso.id,
          title: "Rever permissões das contas da receção",
          status: "NAO_INICIADA",
          priority: "MEDIUM",
          dueDate: daysAgo(3),
          assigneeId: analista.id,
        },
        {
          organizationId: clinica.id,
          riskId: riscoRansomware.id,
          title: "Instalar proteção de endpoint em todos os postos",
          status: "EM_ANDAMENTO",
          priority: "URGENT",
          dueDate: daysAhead(14),
          assigneeId: analista.id,
        },
        {
          organizationId: clinica.id,
          riskId: riscoRansomware.id,
          title: "Formação de sensibilização anti-phishing",
          status: "CONCLUIDA",
          priority: "MEDIUM",
          assigneeId: analista.id,
        },
      ],
    });
    await prisma.taskComment.createMany({
      data: [
        {
          taskId: tarefaMfa.id,
          authorId: analista.id,
          body: "MFA ativado para a direção. Falta a equipa da receção (demonstração).",
        },
        {
          taskId: tarefaMfa.id,
          authorId: superAdmin.id,
          body: "Confirmar na próxima semana se falta alguém.",
        },
      ],
    });

    const backupPacientes = await prisma.backupJob.create({
      data: {
        organizationId: clinica.id,
        sistemaAtivo: "Base de dados de pacientes",
        fornecedor: "Backblaze (demo)",
        frequencia: "DIARIA",
        ultimaExecucao: daysAgo(1),
        estado: "SUCESSO",
        tamanhoGB: 42.5,
        localizacao: "Cloud",
        retencaoDias: 30,
        rtoHoras: 4,
        rpoHoras: 24,
        ultimoTesteRestauracao: daysAgo(10),
      },
    });
    const backupFicheiros = await prisma.backupJob.create({
      data: {
        organizationId: clinica.id,
        sistemaAtivo: "Servidor de ficheiros",
        fornecedor: "NAS local (demo)",
        frequencia: "SEMANAL",
        ultimaExecucao: daysAgo(6),
        estado: "FALHA",
        localizacao: "NAS local",
        retencaoDias: 14,
        rtoHoras: 8,
        rpoHoras: 168,
        notas: "Falha de espaço em disco (demonstração).",
      },
    });
    await prisma.backupVerification.createMany({
      data: [
        {
          backupJobId: backupPacientes.id,
          dataTeste: daysAgo(10),
          resultado: "SUCESSO",
          detalhes: "Restauro de ficheiro de teste concluído (demonstração).",
        },
        {
          backupJobId: backupFicheiros.id,
          dataTeste: daysAgo(40),
          resultado: "FALHA",
          detalhes: "Restauro falhou por espaço insuficiente (demonstração).",
        },
      ],
    });

    const ticketLento = await prisma.ticket.create({
      data: {
        organizationId: clinica.id,
        title: "Computador da receção muito lento",
        description: "Possível malware; pedir análise.",
        category: "SUPORTE",
        status: "EM_ANDAMENTO",
        priority: "HIGH",
        slaHoras: 48,
        createdById: analista.id,
        assigneeId: analista.id,
        events: {
          create: [
            { tipo: "STATUS_CHANGE", descricao: "Ticket criado (Aberto).", autorId: analista.id },
            { tipo: "ATRIBUICAO", descricao: "Ticket atribuído a Analista de Demonstração.", autorId: analista.id },
          ],
        },
      },
    });
    await prisma.ticket.create({
      data: {
        organizationId: clinica.id,
        title: "Criar conta para nova enfermeira",
        category: "SOLICITACAO",
        status: "ABERTO",
        priority: "MEDIUM",
        createdById: analista.id,
        events: { create: { tipo: "STATUS_CHANGE", descricao: "Ticket criado (Aberto).", autorId: analista.id } },
      },
    });
    await prisma.ticketComment.create({
      data: {
        ticketId: ticketLento.id,
        authorId: analista.id,
        conteudo: "Análise inicial feita; agendada limpeza para amanhã (demonstração).",
      },
    });

    const incidentePhishing = await prisma.incident.create({
      data: {
        organizationId: clinica.id,
        title: "E-mail de phishing reportado pela receção",
        description: "Mensagem falsa de fornecedor pedindo credenciais.",
        type: "PHISHING",
        severity: "HIGH",
        status: "EM_ANALISE",
        detectedAt: daysAgo(2),
        sistemasAfetados: "Conta de e-mail da receção",
        acoesImediatas: "Password da conta reposta; mensagem em quarentena.",
        responsavelId: analista.id,
        timeline: {
          create: [
            { tipo: "STATUS_CHANGE", descricao: "Incidente reportado.", autorId: analista.id },
            { tipo: "ACAO", descricao: "Password reposta e mensagem colocada em quarentena.", autorId: analista.id },
          ],
        },
      },
    });
    void incidentePhishing;
    await prisma.incident.create({
      data: {
        organizationId: clinica.id,
        title: "Tentativa de acesso noturno ao VPN",
        type: "ACESSO_INDEVIDO",
        severity: "MEDIUM",
        status: "RECUPERADO",
        detectedAt: daysAgo(15),
        resolvedAt: daysAgo(14),
        sistemasAfetados: "VPN",
        licoesAprendidas: "Ativar MFA no VPN reduziu tentativas repetidas (demonstração).",
        timeline: {
          create: [
            { tipo: "STATUS_CHANGE", descricao: "Incidente reportado.", autorId: superAdmin.id },
            { tipo: "STATUS_CHANGE", descricao: "Estado alterado para Recuperado.", autorId: superAdmin.id },
          ],
        },
      },
    });

    await prisma.phishingReport.createMany({
      data: [
        {
          organizationId: clinica.id,
          canal: "EMAIL",
          remetente: "facturas@fornecedor-falso.example",
          assunto: "Fatura em atraso — pagamento urgente",
          descricao: "E-mail a pedir transferência urgente para novo IBAN. Ninguém interagiu (demonstração).",
          urlSuspeita: "http://exemplo-suspeito.test/pagamento",
          classificacaoInicial: "ALTA",
          reportanteId: analista.id,
          estado: "CONVERTIDO_INCIDENTE",
        },
        {
          organizationId: clinica.id,
          canal: "WHATSAPP",
          remetente: "+244 900 999 999",
          descricao: "Mensagem a fingir ser da direção a pedir códigos de cartão-presente (demonstração).",
          classificacaoInicial: "MEDIA",
          reportanteId: analista.id,
          estado: "NOVO",
        },
      ],
    });

    await prisma.phishingCampaign.createMany({
      data: [
        {
          organizationId: clinica.id,
          name: "Simulação trimestral Q3",
          status: "COMPLETED",
          targetCount: 25,
          sentCount: 25,
          clickedCount: 4,
          reportedCount: 9,
          launchedAt: daysAgo(20),
        },
        {
          organizationId: clinica.id,
          name: "Simulação trimestral Q4",
          status: "DRAFT",
          targetCount: 30,
        },
      ],
    });
  }

  if ((await prisma.asset.count({ where: { organizationId: kwanza.id } })) === 0) {
    await prisma.asset.createMany({
      data: [
        {
          organizationId: kwanza.id,
          name: "Loja online (e-commerce)",
          type: "SERVICE",
          criticality: "CRITICAL",
          owner: "Equipa digital",
          protecaoEndpoint: true,
          ultimaAtualizacao: daysAgo(10),
          mfaAplicavel: true,
          cifragem: true,
        },
        {
          organizationId: kwanza.id,
          name: "Portáteis da equipa comercial",
          type: "HARDWARE",
          marcaModelo: "HP ProBook 450 (demo)",
          sistemaOperativo: "Windows 11 Pro",
          criticality: "MEDIUM",
          protecaoEndpoint: true,
          ultimaAtualizacao: daysAgo(25),
          cifragem: false,
        },
      ],
    });
    const avaliacaoKwanza = await prisma.riskAssessment.create({
      data: {
        organizationId: kwanza.id,
        title: "Avaliação da loja online",
        domain: "E-commerce",
        ownerId: gestor.id,
        startDate: daysAgo(15),
        status: "EM_ANDAMENTO",
      },
    });
    const riscoFraude = await prisma.risk.create({
      data: {
        organizationId: kwanza.id,
        assessmentId: avaliacaoKwanza.id,
        title: "Fraude em pagamentos online",
        threat: "Pagamentos com cartões roubados",
        vulnerability: "Sem regras anti-fraude configuradas",
        probability: 3,
        impact: 4,
        level: 12,
        riskLevel: "ALTO",
        status: "EM_TRATAMENTO",
        treatment: "Regras anti-fraude e revisão manual de encomendas altas.",
        ownerId: gestor.id,
        dueDate: daysAhead(45),
      },
    });
    await prisma.riskTreatmentTask.create({
      data: {
        organizationId: kwanza.id,
        riskId: riscoFraude.id,
        title: "Atualizar plugins da loja online",
        status: "NAO_INICIADA",
        priority: "HIGH",
        dueDate: daysAhead(5),
        assigneeId: gestor.id,
      },
    });
    await prisma.backupJob.create({
      data: {
        organizationId: kwanza.id,
        sistemaAtivo: "Base de dados da loja",
        fornecedor: "OneDrive (demo)",
        frequencia: "DIARIA",
        ultimaExecucao: daysAgo(1),
        estado: "SUCESSO",
        tamanhoGB: 12.3,
        localizacao: "Cloud",
        retencaoDias: 30,
        rtoHoras: 2,
        rpoHoras: 24,
      },
    });
    await prisma.ticket.create({
      data: {
        organizationId: kwanza.id,
        title: "Erro no checkout com Multicaixa Express",
        description: "Clientes reportam falha no pagamento (demonstração).",
        category: "INCIDENTE",
        status: "ABERTO",
        priority: "URGENT",
        slaHoras: 8,
        createdById: gestor.id,
        events: { create: { tipo: "STATUS_CHANGE", descricao: "Ticket criado (Aberto).", autorId: gestor.id } },
      },
    });
    await prisma.phishingReport.create({
      data: {
        organizationId: kwanza.id,
        canal: "SMS",
        remetente: "MBWay-Alerta (demo)",
        descricao: "SMS a pedir confirmação de dados do cartão via link (demonstração).",
        urlSuspeita: "http://exemplo-falso.test/mbway",
        classificacaoInicial: "MEDIA",
        reportanteId: gestor.id,
        estado: "NOVO",
      },
    });
    await prisma.phishingCampaign.createMany({
      data: [
        {
          organizationId: kwanza.id,
          name: "Simulação equipa comercial",
          status: "RUNNING",
          targetCount: 15,
          sentCount: 15,
          clickedCount: 2,
          reportedCount: 5,
          launchedAt: daysAgo(3),
        },
      ],
    });
  }

  // ---------------------------------------------------------------------
  // Políticas e formações (Fase D2)
  // ---------------------------------------------------------------------
  if ((await prisma.securityPolicy.count({ where: { organizationId: clinica.id } })) === 0) {
    await prisma.securityPolicy.createMany({
      data: [
        {
          organizationId: clinica.id,
          title: "Política de palavras-passe",
          category: "PASSWORDS",
          status: "PUBLICADA",
          version: 2,
          authorId: superAdmin.id,
          publishedAt: daysAgo(60),
          content:
            "# Política de Palavras-passe (demonstração)\n\n1. Mínimo 12 caracteres com maiúsculas, minúsculas e dígitos.\n2. Nunca partilhar passwords por e-mail, WhatsApp ou papel.\n3. Usar um gestor de passwords sempre que possível.\n4. Mudar imediatamente se houver suspeita de compromisso.",
        },
        {
          organizationId: clinica.id,
          title: "Política de resposta a incidentes",
          category: "RESPOSTA_INCIDENTES",
          status: "PUBLICADA",
          version: 1,
          authorId: superAdmin.id,
          publishedAt: daysAgo(45),
          content:
            "# Política de Resposta a Incidentes (demonstração)\n\n1. Reportar de imediato à equipa de segurança.\n2. Isolar o equipamento, sem desligar.\n3. Preservar evidências.\n4. Nunca pagar resgates.\n5. Registar ações e lições aprendidas.",
        },
        {
          organizationId: clinica.id,
          title: "Política de uso aceitável",
          category: "USO_ACEITAVEL",
          status: "RASCUNHO",
          version: 1,
          authorId: superAdmin.id,
          content:
            "# Política de Uso Aceitável (rascunho, demonstração)\n\n1. Equipamentos da empresa apenas para fins profissionais.\n2. Proibido instalar software sem autorização.",
        },
      ],
    });

    const moduloPhishing = await prisma.trainingModule.create({
      data: {
        organizationId: clinica.id,
        title: "Noções essenciais de phishing",
        description: "Como reconhecer e reagir a mensagens fraudulentas (demonstração).",
        content:
          "Phishing é quando alguém se faz passar por uma entidade confiável para roubar dados.\n\nSinais de alerta:\n- Urgência excessiva e ameaças.\n- Remetentes com domínios parecidos mas diferentes.\n- Pedidos de passwords, códigos ou transferências.\n\nRegra de ouro: em dúvida, não clique — reporte.",
        duracaoMinutos: 10,
        validadeMeses: 12,
        questions: {
          create: [
            {
              pergunta: "Qual é o objetivo principal de um ataque de phishing?",
              opcoes: ["Roubar credenciais ou dados", "Acelerar o computador", "Enviar publicidade legítima", "Testar a internet"],
              respostaCorretaIndex: 0,
            },
            {
              pergunta: "Um e-mail urgente pede a sua password. O que faz?",
              opcoes: ["Responde rapidamente", "Ignora e reporta à equipa de segurança", "Reencaminha aos colegas", "Apaga sem reportar"],
              respostaCorretaIndex: 1,
            },
            {
              pergunta: "Qual destes é um sinal comum de phishing?",
              opcoes: ["Domínio ligeiramente diferente do oficial", "Assinatura da empresa", "E-mail do seu chefe direto", "Newsletter subscrita"],
              respostaCorretaIndex: 0,
            },
            {
              pergunta: "Recebeu um link suspeito no WhatsApp de um 'colega'. Primeiro passo?",
              opcoes: ["Clicar para verificar", "Confirmar com o colega por outro canal", "Partilhar no grupo", "Responder ao remetente"],
              respostaCorretaIndex: 1,
            },
            {
              pergunta: "Se clicou num link suspeito e introduziu a password, deve:",
              opcoes: ["Não contar a ninguém", "Mudar a password e reportar de imediato", "Esperar uma semana", "Reiniciar o computador apenas"],
              respostaCorretaIndex: 1,
            },
          ],
        },
      },
    });
    await prisma.trainingAssignment.create({
      data: {
        organizationId: clinica.id,
        trainingModuleId: moduloPhishing.id,
        atribuicaoGlobal: true,
        completions: {
          create: [
            {
              userId: analista.id,
              dataInicio: daysAgo(20),
              dataConclusao: daysAgo(20),
              score: 100,
              validoAte: daysAhead(345),
              estado: "CONCLUIDO",
            },
            { userId: superAdmin.id, estado: "NAO_INICIADO" },
          ],
        },
      },
    });
  }

  // Histórico de snapshots de score (6 meses) para o gráfico de evolução.
  const snapshotSeries: Record<string, number[]> = {
    "clinica-vida-segura": [45, 48, 52, 55, 61, 66],
    "kwanza-comercio-digital": [55, 58, 60, 63, 68, 71],
    "academia-horizonte": [38, 40, 42, 45, 47, 50],
  };
  for (const [slug, scores] of Object.entries(snapshotSeries)) {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug } });
    if ((await prisma.securityScoreSnapshot.count({ where: { organizationId: organization.id } })) > 0) continue;
    for (const [index, score] of scores.entries()) {
      const monthsAgo = scores.length - index; // ponto mais antigo → mais recente
      const dataReferencia = new Date(now);
      dataReferencia.setMonth(dataReferencia.getMonth() - monthsAgo);
      await prisma.securityScoreSnapshot.create({
        data: {
          organizationId: organization.id,
          score,
          categoria: score >= 80 ? "BOM" : score >= 60 ? "ACEITAVEL" : score >= 40 ? "EM_RISCO" : "CRITICO",
          detalhesJson: { demo: true, nota: "Snapshot histórico de demonstração." },
          dataReferencia,
        },
      });
    }
  }

  // Relatórios mensais de demonstração (Fase D3).
  if ((await prisma.securityReport.count({ where: { organizationId: clinica.id } })) === 0) {
    const mesAnterior = new Date(now);
    mesAnterior.setUTCDate(1);
    mesAnterior.setUTCMonth(mesAnterior.getUTCMonth() - 1);
    const mesAtual = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    await prisma.securityReport.createMany({
      data: [
        {
          organizationId: clinica.id,
          mesReferencia: mesAnterior,
          scoreGlobal: 61,
          categoria: "ACEITAVEL",
          resumoExecutivo:
            "No mês anterior, a Clínica Vida Segura apresenta um nível de segurança ACEITÁVEL, com um score global de 61 em 100. Existe 1 risco crítico por tratar que exige atenção prioritária. Nas cópias de segurança, 1 backup com falha nos últimos 30 dias exige verificação. A sensibilização melhorou com a formação de phishing. (demonstração)",
          riscosCriticosAltos: [
            { title: "Acesso indevido a registos clínicos", level: 20, riskLevel: "CRITICO", status: "EM_TRATAMENTO", owner: "Analista de Demonstração", dueDate: null },
            { title: "Ransomware em postos de trabalho", level: 12, riskLevel: "ALTO", status: "EM_TRATAMENTO", owner: "Analista de Demonstração", dueDate: null },
          ],
          estadoBackups: { total: 2, sucesso: 1, falha: 1, aviso: 0, desconhecido: 0, semTesteRecente: 1 },
          ticketsIncidentes: {
            tickets: { abertos: 2, vencidos: 0, resolvidosNoMes: 1 },
            incidentes: { totalNoMes: 1, criticos: 0, encerrados: 0 },
          },
          formacoesPoliticas: { validPercent: 50, validUsers: 1, totalMembers: 2, keyPolicies: 2 },
          acoesRecomendadas: [
            "Resolver a falha de backup do servidor de ficheiros e repetir a execução.",
            "Testar a restauração do servidor de ficheiros.",
            "Garantir a conclusão da formação para os utilizadores pendentes.",
          ],
          status: "PUBLICADO",
          geradoPorId: superAdmin.id,
          dataGeracao: mesAnterior,
        },
        {
          organizationId: clinica.id,
          mesReferencia: mesAtual,
          scoreGlobal: 66,
          categoria: "ACEITAVEL",
          resumoExecutivo:
            "Neste mês, a Clínica Vida Segura apresenta um nível de segurança ACEITÁVEL, com um score global de 66 em 100 — uma melhoria de 5 pontos face ao mês anterior. Mantém-se 1 risco crítico em tratamento. (demonstração)",
          riscosCriticosAltos: [
            { title: "Acesso indevido a registos clínicos", level: 20, riskLevel: "CRITICO", status: "EM_TRATAMENTO", owner: "Analista de Demonstração", dueDate: null },
          ],
          estadoBackups: { total: 2, sucesso: 1, falha: 1, aviso: 0, desconhecido: 0, semTesteRecente: 1 },
          ticketsIncidentes: {
            tickets: { abertos: 2, vencidos: 1, resolvidosNoMes: 0 },
            incidentes: { totalNoMes: 1, criticos: 0, encerrados: 0 },
          },
          formacoesPoliticas: { validPercent: 50, validUsers: 1, totalMembers: 2, keyPolicies: 2 },
          acoesRecomendadas: [
            "Tratar imediatamente 1 risco(s) crítico(s) aberto(s).",
            "Resolver a falha de backup e repetir a execução manualmente.",
            "Garantir a conclusão da formação para 1 utilizador pendente.",
          ],
          status: "GERADO",
          geradoPorId: superAdmin.id,
          dataGeracao: now,
        },
      ],
    });
  }

  console.log("Seed de demonstração concluída.");
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao criar dados de demonstração:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
