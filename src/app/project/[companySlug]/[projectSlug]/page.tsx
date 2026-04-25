import { Suspense } from "react";
import ConfiguratorClient from "./ConfiguratorClient";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectSlug: string }>;
}) {
  const { companySlug, projectSlug } = await params;
  return (
    <Suspense>
      <ConfiguratorClient companySlug={companySlug} projectSlug={projectSlug} />
    </Suspense>
  );
}
