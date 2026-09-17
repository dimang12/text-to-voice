import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : undefined;
  return <AuthForm mode="signin" next={next} urlError={error} />;
}
