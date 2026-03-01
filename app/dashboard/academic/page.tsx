import { listDatasets } from "@/lib/analytics-service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireSession } from "@/lib/require-session";
import { getRoleForEmail } from "@/lib/access-control";

export default async function AcademicDashboardPage({
  searchParams
}: {
  searchParams?: { datasetId?: string };
}) {
  const session = await requireSession();
  const initialUserRole = await getRoleForEmail(session?.user?.email);
  const datasets = await listDatasets();
  const requestedId = searchParams?.datasetId;
  const initialDatasetId =
    (requestedId && datasets.some((d) => d.id === requestedId) ? requestedId : undefined) ??
    datasets[0]?.id ??
    null;

  return (
    <DashboardClient
      initialDatasets={datasets}
      initialDatasetId={initialDatasetId}
      initialUserRole={initialUserRole}
      section="academic"
    />
  );
}
