import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BatchInputDetailRedirect({ params }: PageProps) {
  const { batchId } = await params;
  redirect(`/oil/kostprijs/${batchId}`);
}
