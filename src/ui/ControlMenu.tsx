import type { ReactNode } from 'react';

const icons = {
  location: 'M12 2v4m0 12v4M2 12h4m12 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
  image:
    'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 16l5-5 4 4 3-3 6 6M9 7h.01',
  animation: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM10 8l6 4-6 4Z',
  analysis: 'M3 20h18M6 16v-5m6 5V4m6 12V8',
  paint: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-4L4 15Z',
  telescope: 'm5 9 12-5 3 7-12 5ZM3 10l2 5m7-1v3m-4 4 4-4 4 4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
};

/** Native disclosure keeps forms mounted and works with keyboard and touch. */
export function ControlMenu({
  icon,
  title,
  description,
  children,
}: {
  icon: keyof typeof icons;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="control-menu" data-control-menu>
      <summary>
        <svg className="control-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={icons[icon]} />
        </svg>
        <span className="control-menu-label">
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
