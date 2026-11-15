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
        <span className="control-menu-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="control-menu-body">{children}</div>
    </details>
  );
}
