import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { productAreaUI } from '@/lib/page-types/product-area.ui';
import { emptyProductAreaState } from '@/lib/product-area-types';

export const dynamic = 'force-dynamic';

export default function CreateProductAreaPage() {
  return (
    <PageTypeBuilder
      uiDef={productAreaUI}
      initialState={emptyProductAreaState()}
      mode="create"
      apiPath="/api/product-area"
      editPath="/editor/product-area/:recordId"
    />
  );
}
