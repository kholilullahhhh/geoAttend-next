import { ROLE_LABEL, type Tone } from '@/lib/status';

/**
 * Initials avatar.
 *
 * There is no uploaded profile image anywhere in the schema, so an avatar is
 * either a generated monogram or a placeholder — and a monogram is the honest
 * option. Inventing a picture URL here would mean rendering a broken image for
 * every user.
 *
 * The background is derived from the role so the two privileged roles are
 * distinguishable at a glance in the approvals table, but it is never the only
 * signal: the role is always spelled out in text next to it.
 */

const SIZES = {
  sm: 'size-7 text-2xs',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
  xl: 'size-14 text-base',
} as const;

const ROLE_TONE: Record<string, { box: string; fg: string; ring: string }> = {
  ADMIN: { box: 'bg-accent-soft', fg: 'text-accent-ink', ring: 'ring-accent-bright/35' },
  HR: { box: 'bg-info-soft', fg: 'text-info', ring: 'ring-info/35' },
  EMPLOYEE: { box: 'bg-surface-alt', fg: 'text-ink-secondary', ring: 'ring-line-strong' },
};

/**
 * Up to two initials from a display name.
 *
 * Handles the Indonesian and international forms this app actually stores:
 * "Budi Santoso" -> BS, "Siti  Nurhaliza" -> SN, "陈 小明" -> 陈小 (the last two
 * *characters*, not the first two, which is the only sensible rule for a name
 * written without spaces).
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const only = parts[0]!;
    // No spaces: take the last two characters, so CJK and single-word names
    // produce something meaningful instead of one arbitrary letter.
    return only.length > 1 ? only.slice(-2) : only;
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  role,
  size = 'md',
  className = '',
}: {
  name: string;
  role?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cfg = (role && ROLE_TONE[role]) || ROLE_TONE.EMPLOYEE!;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-semibold ring-1 ring-inset ${SIZES[size]} ${cfg.box} ${cfg.fg} ${className}`}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
      {/*
        The name is the accessible content. Without it the avatar is an
        anonymous glyph, and the sidebar would announce "B S" where the user's
        name was meant.
      */}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Role chip with its own glyph, used beside a name. */
export function RoleBadge({ role }: { role: string }) {
  const tone: Tone =
    role === 'ADMIN' ? 'accent' : role === 'HR' ? 'info' : 'neutral';
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-semibold whitespace-nowrap ${
        tone === 'accent'
          ? 'bg-accent-soft text-accent-ink'
          : tone === 'info'
            ? 'bg-info-soft text-info'
            : 'bg-surface-alt text-ink-secondary'
      }`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}