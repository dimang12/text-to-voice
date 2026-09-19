import { getTranslations } from "next-intl/server";
import { ProjectsTable } from "@/components/ProjectsTable";
import { createProject } from "@/lib/actions/projects";
import { listProjects } from "@/lib/projects";
import { requireUser } from "@/lib/supabase/server";

export default async function StudioListPage() {
  const t = await getTranslations("editor");
  const { supabase } = await requireUser();
  const projects = await listProjects(supabase);
  return (
    <div className="pane">
      <div className="row-head">
        <div>
          <h2>{t("projectsTitle")}</h2>
          <p className="hint" style={{ margin: "4px 0 0" }}>{t("projectsHint")}</p>
        </div>
        <form action={createProject.bind(null, undefined)}>
          <button className="btn primary" type="submit">+ {t("newProject")}</button>
        </form>
      </div>
      <ProjectsTable rows={projects} emptyText={t("noProjects")} />
    </div>
  );
}
