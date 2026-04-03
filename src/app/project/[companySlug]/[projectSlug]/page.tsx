import ConfiguratorClient from "./ConfiguratorClient";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectSlug: string }>;
}) {
  const { companySlug, projectSlug } = await params;
  return <ConfiguratorClient companySlug={companySlug} projectSlug={projectSlug} />;
}
