import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "solucoes-financeiras-super-secret-key-2026"
);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas que não precisam de autenticação de tenant (incluindo /sys-init e APIs de setup protegidas por PIN)
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/sys-init") ||
    pathname.startsWith("/api/tenants/setup") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.includes("favicon") ||
    pathname.includes("icon") ||
    pathname.includes("apple-icon") ||
    pathname.includes("opengraph-image") ||
    pathname.includes("twitter-image") ||
    pathname.includes("manifest") ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|webmanifest|json)$/i.test(pathname)
  ) {
    // Se tentar acessar o login estando autenticado com um token multi-tenant válido, vai pro painel
    if (pathname === "/login") {
      const token = request.cookies.get("sol_auth_token")?.value;
      if (token) {
        try {
          const { payload } = await jwtVerify(token, JWT_SECRET);
          if (payload.tenantId) {
            return NextResponse.redirect(new URL("/", request.url));
          }
        } catch {
          // Token inválido, segue pro login
        }
      }
    }
    return NextResponse.next();
  }

  // Verificar autenticação
  const token = request.cookies.get("sol_auth_token")?.value;

  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.tenantId) {
      const url = new URL("/login", request.url);
      const res = NextResponse.redirect(url);
      res.cookies.delete("sol_auth_token");
      return res;
    }
    return NextResponse.next();
  } catch {
    const url = new URL("/login", request.url);
    const res = NextResponse.redirect(url);
    res.cookies.delete("sol_auth_token");
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth api routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, icons, manifests
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$).*)",
  ],
};
