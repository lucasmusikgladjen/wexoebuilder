import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { uniquePageUI } from '@/lib/page-types/unique-page.ui';
import { emptyUniquePageState } from '@/lib/unique-page-types';

export const dynamic = 'force-dynamic';

export default function CreateUniquePage() {
  return (
    <PageTypeBuilder
      uiDef={uniquePageUI}
      initialState={emptyUniquePageState()}
      mode="create"
      apiPath="/api/unique-page"
      editPath="/editor/unique/:recordId"
    />
  );
}
