import { XCircle } from "lucide-react";

export function Recommendations({ actions }: { actions: string[] }) {
  if (actions.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Recommended actions</h3>
      <ul className="space-y-1.5">
        {actions.map((action, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
