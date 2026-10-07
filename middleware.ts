export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ativos/:path*",
    "/avaliacoes/:path*",
    "/riscos/:path*",
    "/tarefas/:path*",
    "/backups/:path*",
    "/tickets/:path*",
    "/incidentes/:path*",
    "/phishing/:path*",
    "/organizacoes/:path*",
    "/admin/:path*",
  ],
};
