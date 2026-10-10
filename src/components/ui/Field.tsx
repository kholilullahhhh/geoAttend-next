import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const FIELD_BASE =
  'h-10 w-full rounded-md border border-line-strong bg-surface px-md text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:opacity-60';

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-secondary">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_BASE} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${FIELD_BASE} pr-8 ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={`${FIELD_BASE} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-md border border-line-strong bg-surface p-md text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none ${props.className ?? ''}`}
    />
  );
}