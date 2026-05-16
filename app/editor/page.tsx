import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { landingUI } from '@/lib/page-types/landing.ui';
import { landingServer } from '@/lib/page-types/landing.server';

export const dynamic = 'force-dynamic';

export default function CreateLandingPage() {
  return (
    <PageTypeBuilder
      uiDef={landingUI}
      initialState={landingServer.emptyState()}
      mode="create"
      apiPath="/api/landing"
      editPath="/editor/:recordId"
    />
  );
}
