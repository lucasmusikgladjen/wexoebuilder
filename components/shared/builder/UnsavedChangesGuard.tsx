'use client';

import { useEffect } from 'react';

interface Props {
  active: boolean;
  message?: string;
}

/** Warns on browser/tab navigation when a builder has unsaved changes. */
export default function UnsavedChangesGuard({
  active,
  message = 'Du har osparade ändringar. Vill du lämna sidan?',
}: Props) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, message]);

  return null;
}
