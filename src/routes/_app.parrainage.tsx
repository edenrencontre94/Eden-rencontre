import { createFileRoute } from "@tanstack/react-router";
import { ParrainageDashboard } from "@/components/app/ParrainageDashboard";

export const Route = createFileRoute("/_app/parrainage")({
  head: () => ({
    meta: [{ title: "Parrainage — Eden Rencontre" }],
  }),
  component: ParrainagePage,
});

function ParrainagePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <ParrainageDashboard />
    </div>
  );
}
