import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { audienceUI } from '@/lib/page-types/audience.ui';
import { emptyAudienceState } from '@/lib/audience-types';

export const dynamic = 'force-dynamic';

export default function CreateAudiencePage() {
  return (
    <PageTypeBuilder
      uiDef={audienceUI}
      initialState={emptyAudienceState()}
      mode="create"
      apiPath="/api/audience"
      editPath="/editor/audience/:recordId"
    />
  );
}
