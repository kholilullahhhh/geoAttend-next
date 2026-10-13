import { TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { RISK_HELP, RISK_LABEL, RISK_SHORT } from '@/lib/status';

/**
 * Risk indicators for an attendance row.
 *
 * These are *signals for human review*, not proof of wrongdoing. GPS alone
 * cannot prove a location is genuine — a spoofed device, a bad fix indoors and
 * a genuine mistake all produce the same signal — so the wording stays neutral
 * and the full explanation is available on hover rather than being asserted in
 * the badge itself.
 *
 * Each flag is a separate pill with the long form in its `title`, so the
 * meaning survives a narrow column, a colour-blind reader and a greyscale
 * print.
 */
export function RiskFlags({
  flags,
  reviewRequired,
  size = 'sm',
}: {
  flags: string[] | null | undefined;
  reviewRequired: boolean;
  size?: 'sm' | 'md';
}) {
  const list = flags ?? [];
  if (!reviewRequired && list.length === 0) {
    return <span className="text-xs text-ink-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reviewRequired && (
        <Badge
          tone="danger"
          size={size}
          title="Backend menandai catatan ini untuk diperiksa manusia."
        >
          <TriangleAlert className="size-3" aria-hidden="true" />
          Perlu ditinjau
        </Badge>
      )}
      {list.map((f) => (
        <Badge key={f} tone="warning" size={size} title={RISK_HELP[f] ?? RISK_LABEL[f] ?? f}>
          {RISK_SHORT[f] ?? RISK_LABEL[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}