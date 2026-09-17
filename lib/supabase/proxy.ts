import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv()) return response;

  // An OAuth or email-link code can land on any page when the provider falls back to the site URL.
  // Hand it to the callback route so the sign-in still completes.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const callback = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    callback.pathname = "/auth/callback";
    callback.search = "";
    callback.searchParams.set("code", code);
    callback.searchParams.set("next", next.startsWith("/") ? next : "/");
    return NextResponse.redirect(callback);
  }

  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api");

  if (!user && !isPublic && !isApi) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }
  return response;
}
