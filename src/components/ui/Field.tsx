import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * Form controls.
 *
 * One set of metrics for every input: 40px tall, 12px radius, 13–14px type.
 * The border uses `--line-input`, not `--line-strong`. Mobile makes the same
 * distinction and for the same reason — a decorative divider may stay faint,
 * but the edge of a field you have to be able to find is load-bearing and has
 * to clear 3:1.
 *
 * Every control accepts an error, and when it does it sets `aria-invalid` and
 * wires `aria-describedby` to the message, so the failure is announced instead
 * of only being coloured red.
 */

const FIELD_BASE =
  'w-full rounded-md border bg-surface px-md text-sm text-ink transition-colors ' +
  'placeholder:text-ink-muted ' +
  'disabled:cursor-not-allowed disabled:bg-surface-alt disabled:opacity-70 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

const FIELD_OK = 'border-line-input hover:border-ink-muted/50';
const FIELD_ERR = 'border-danger bg-danger-soft/40 focus-visible:outline-danger';

function fieldClass(invalid: boolean | undefined, extra?: string) {
  return `${FIELD_BASE} ${invalid ? FIELD_ERR : FIELD_OK} ${extra ?? ''}`;
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  /** Inline validation message. Sets `aria-invalid` on the control. */
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Visually hides the label but keeps it for assistive tech. */
  hideLabel?: boolean;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
  hideLabel = false,
}: FieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className={
          hideLabel
            ? 'sr-only'
            : 'text-2xs font-semibold tracking-wide text-ink-secondary uppercase'
        }
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function describedBy(htmlFor: string | undefined, invalid: boolean | undefined) {
  if (!htmlFor || !invalid) return undefined;
  return `${htmlFor}-error`;
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className = '', ...props }: TextInputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      className={fieldClass(invalid, `h-10 ${className}`)}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * Select.
 *
 * The chevron is drawn rather than left to the platform: native select arrows
 * differ between Windows, macOS, iOS and Android, and on Windows the default
 * one is a grey triangle that reads as an artefact next to these tokens. The
 * element stays a real `<select>`, so the mobile picker and keyboard behaviour
 * are untouched.
 */
export function Select({ invalid, className = '', children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(props.id, invalid)}
        className={`${fieldClass(invalid, `h-10 appearance-none pr-9 ${className}`)}`}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  );
}

export interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function DateInput({ invalid, className = '', ...props }: DateInputProps) {
  return (
    <input
      {...props}
      type="date"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      className={fieldClass(invalid, `h-10 ${className}`)}
    />
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className = '', rows = 3, ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      className={fieldClass(invalid, `min-h-20 resize-y py-2.5 leading-relaxed ${className}`)}
    />
  );
}

/**
 * Search input with a leading glyph.
 *
 * A `<input type="search">` rather than a div with a key handler: it gives
 * screen readers the right role, the platform's clear button, and Escape-to-
 * clear, none of which a styled wrapper reproduces.
 *
 * `id` is required rather than generated. This file renders in Server
 * Components, where `useId` is unavailable, and a module-level counter would
 * produce different ids on the server and the client — a hydration mismatch on
 * every filtered page.
 */
export function SearchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        {...props}
        type="search"
        aria-describedby={describedBy(props.id, false)}
        className={`${fieldClass(undefined, `h-10 pr-3 pl-9 ${className}`)} [&::-webkit-search-cancel-button]:cursor-pointer`}
      />
    </div>
  );
}