import { TopicsEditor } from "@/components/topics-editor";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Topics" };

export default async function TopicsPage() {
  const viewer = await requireUser();
  return (
    <div className="max-w-4xl">
      <h2 className="text-[17px] font-semibold">Topics</h2>
      <p className="mb-6 mt-1 text-[13px] text-muted">What you can speak to. Weight decides how much a match counts toward a room&apos;s leverage.</p>
      <TopicsEditor initial={viewer.workspace.topics} />
    </div>
  );
}
