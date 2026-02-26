import { listDatasets } from "@/lib/analytics-service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { datasetId?: string };
}) {
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
    />
  );
}
