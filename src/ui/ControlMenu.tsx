import type { ReactNode } from 'react';

/** Native disclosure keeps forms mounted and works with keyboard and touch. */
export function ControlMenu({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="control-menu" data-control-menu>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <svg className="control-menu-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m6 3 5 5-5 5" />
        </svg>
      </summary>
      <div className="control-menu-body">{children}</div>
    </details>
  );
}
