'use client';

import SaveButton from './SaveButton';
import SaveStatus from './SaveStatus';

interface Props {
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  isCreate: boolean;
  error?: string | null;
  justSaved?: boolean;
  hint?: string;
  dirty?: boolean;
}

/** Compact save cluster used by PageTypeBuilder's toolbar. */
export default function SaveBar({
  onSave,
  saving,
  canSave,
  isCreate,
  error,
  justSaved,
  hint,
  dirty,
}: Props) {
  return (
    <div className="flex items-center gap-3">
      <SaveStatus error={error} justSaved={justSaved} hint={hint} canSave={canSave} />
      {dirty && !error && !justSaved && <span className="text-xs text-gray-300">Osparade ändringar</span>}
      <SaveButton onClick={onSave} saving={saving} canSave={canSave} isCreate={isCreate} />
    </div>
  );
}
