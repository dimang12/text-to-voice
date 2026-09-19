import { notFound } from "next/navigation";
import { AudioEditor } from "@/components/editor/AudioEditor";
import { getProject, listClipSources } from "@/lib/projects";
import { requireUser } from "@/lib/supabase/server";

export default async function EditorPage({ params }: PageProps<"/studio/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [project, sources] = await Promise.all([getProject(supabase, id), listClipSources(supabase)]);
  if (!project) notFound();
  return <AudioEditor project={project} sources={sources} />;
}
