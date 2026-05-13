# Builder-uppgifter: kontaktformulär-integration

Den fulla feature-beskrivningen + utvecklingsplanen ligger i wexoeplugins-repot:

→ [`wexoeplugins/features/contact-form-integration.md`](https://github.com/lucasmusikgladjen/wexoeplugins/blob/claude/review-contact-plugins-4jqRS/features/contact-form-integration.md)

Den här filen sammanfattar **bara** Builder-delen (Fas 4).

---

## Vad ska Builderns kod göra

Varje page-typ (LP, PA, Audience) får en ny editor-sektion "Kontaktformulär" som redigerar `contact_form_*`-fälten i sin Airtable-record. Datat hör hemma i samma entity som idag — `landing_pages` / `product_areas` / `audience_heroes` — så ingen ny mapper-fil behövs, bara utökningar.

## Filer som ska skapas

```
lib/
  contact-form-types.ts        ← NY: ContactFormState, emptyContactFormState()

components/
  editors/
    ContactFormEditor.tsx      ← NY (LP): redigerar contactForm-delen av PageState

  audience/
    editors/
      ContactFormEditor.tsx    ← NY
    preview/
      ContactFormPreview.tsx   ← NY

  product-area/
    editors/
      ContactFormEditor.tsx    ← NY
    preview/
      ContactFormPreview.tsx   ← NY

  preview/
    ContactFormPreview.tsx     ← NY (LP)
```

## Filer som ska utökas

```
lib/types.ts                   ← Lägg contactForm: ContactFormState i PageState
lib/product-area-types.ts      ← Lägg contactForm: ContactFormState i ProductAreaState
lib/audience-types.ts          ← Lägg contactForm: ContactFormState i AudienceState

lib/page-mapper.ts             ← Läs "Contact Form *"-fält till state
lib/product-area-mapper.ts     ← Samma
lib/audience-mapper.ts         ← Samma (forward + reverse)

lib/airtable-schema-lp.md      ← Dokumentera nya fält + Claude-formateringsregler
lib/airtable-schema-pa.md      ← Samma

components/EditorPanel.tsx     ← Lägg 'contactForm' i sections-arrayen
components/PreviewPanel.tsx    ← Rendera ContactFormPreview om state.contactForm.show

components/audience/AudienceBuilder.tsx          ← Lägg 'contactForm' i QUICK_NAV + visibility-state
components/audience/preview/AudiencePreviewPanel.tsx  ← Rendera ContactFormPreview

components/product-area/ProductAreaBuilder.tsx              ← Samma mönster
components/product-area/preview/ProductAreaPreviewPanel.tsx ← Samma
```

## ContactFormState-skiss

```ts
// lib/contact-form-types.ts
export type ContactFormLayout = 'split' | 'centered';
export type ContactFormTheme = 'dark' | 'light';

export interface ContactFormState {
  show: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  layout: ContactFormLayout;
  theme: ContactFormTheme;
  showCompany: boolean;
  showPhone: boolean;
  showDropdown: boolean;
  dropdownLabel: string;
  options: string;        // multiline, en option per rad
  ctaText: string;
  messageLabel: string;
  trustSignals: string;   // multiline, en per rad, format: **Bold del** | Resten
  showContactPerson: boolean;
}

export function emptyContactFormState(): ContactFormState {
  return {
    show: false,
    eyebrow: '',
    title: 'Prata med någon som kan automation',
    subtitle: '',
    layout: 'split',
    theme: 'dark',
    showCompany: true,
    showPhone: true,
    showDropdown: true,
    dropdownLabel: 'Vad kan vi hjälpa dig med?',
    options: 'Generell fråga\nDiskutera ett projekt\nLägga en order\nMinska stillestånd\nFörbättra OEE\nInfo om produkt',
    ctaText: 'Skicka',
    messageLabel: 'Berätta mer (valfritt)',
    trustSignals: '**30+ års erfarenhet** | av Rockwell och svensk industri\n**Vi säljer inte bara produkter** | vi löser problem\n**Lager i Köpenhamn** | snabb leverans när det krisar',
    showContactPerson: true,
  };
}
```

## Editor-skiss (alla tre typer, identiskt)

```tsx
import { FieldInput, FieldCheckbox, RichTextarea } from '@/components/editors/FieldInput';
import { ContactFormState } from '@/lib/contact-form-types';

interface Props {
  state: ContactFormState;
  setField: <K extends keyof ContactFormState>(k: K, v: ContactFormState[K]) => void;
  visible: boolean;
  onToggleVisible: (v: boolean) => void;
}

export default function ContactFormEditor({ state, setField, visible, onToggleVisible }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Kontaktformulär</h3>
        <FieldCheckbox label="Visa" checked={visible} onChange={onToggleVisible} />
      </div>
      {visible && (
        <>
          <FieldInput label="Eyebrow" value={state.eyebrow} onChange={(v) => setField('eyebrow', v)} placeholder="Kontakta oss" />
          <FieldInput label="Titel" value={state.title} onChange={(v) => setField('title', v)} />
          <RichTextarea label="Underrubrik" value={state.subtitle} onChange={(v) => setField('subtitle', v)} rows={2} />

          <div className="grid grid-cols-2 gap-2">
            <SingleSelect label="Layout" value={state.layout} options={[['split','Två kolumner'],['centered','Centrerad']]} onChange={(v) => setField('layout', v as any)} />
            <SingleSelect label="Tema" value={state.theme} options={[['dark','Mörk'],['light','Ljus']]} onChange={(v) => setField('theme', v as any)} />
          </div>

          <details>
            <summary className="cursor-pointer text-sm text-gray-500">Vilka fält ska visas?</summary>
            <div className="mt-2 space-y-1">
              <FieldCheckbox label="Företag" checked={state.showCompany} onChange={(v) => setField('showCompany', v)} />
              <FieldCheckbox label="Telefon" checked={state.showPhone} onChange={(v) => setField('showPhone', v)} />
              <FieldCheckbox label="Dropdown" checked={state.showDropdown} onChange={(v) => setField('showDropdown', v)} />
            </div>
          </details>

          {state.showDropdown && (
            <>
              <FieldInput label="Dropdown-label" value={state.dropdownLabel} onChange={(v) => setField('dropdownLabel', v)} />
              <RichTextarea label="Dropdown-alternativ (en per rad)" value={state.options} onChange={(v) => setField('options', v)} rows={6} />
            </>
          )}

          <FieldInput label="CTA-text" value={state.ctaText} onChange={(v) => setField('ctaText', v)} />
          <FieldInput label="Meddelande-label" value={state.messageLabel} onChange={(v) => setField('messageLabel', v)} />
          <RichTextarea label="Trust-signaler (en per rad, **Bold** | Resten)" value={state.trustSignals} onChange={(v) => setField('trustSignals', v)} rows={4} />
          <FieldCheckbox label="Visa kontaktperson bredvid formuläret" checked={state.showContactPerson} onChange={(v) => setField('showContactPerson', v)} />
        </>
      )}
    </div>
  );
}
```

## Preview-skiss

Preview ska visa en *visuell skiss* av formulärets layout — den behöver inte vara pixel-identisk med PHP-renderingen. Fokus: layoutbyte (split/centered) syns direkt, vilka fält som visas reflekteras live, mörkt/ljust tema är tydligt. Återanvänd `colorOr` / `textOn` från `lib/color-utils.ts` för temat.

## Claude-prompt-uppdatering

Lägg till i `lib/airtable-schema-lp.md` och `lib/airtable-schema-pa.md`:

```markdown
| **Show Contact Form** | checkbox | Ska ALLTID inkluderas (även `false`). |
| **Contact Form Eyebrow** | singleLineText | |
| **Contact Form Title** | singleLineText | |
| **Contact Form Subtitle** | multilineText | |
| **Contact Form Layout** | singleSelect | `split` eller `centered`. |
| **Contact Form Theme** | singleSelect | `dark` eller `light`. |
| **Contact Form Show Company** | checkbox | Ska ALLTID inkluderas. |
| **Contact Form Show Phone** | checkbox | Ska ALLTID inkluderas. |
| **Contact Form Show Dropdown** | checkbox | Ska ALLTID inkluderas. |
| **Contact Form Dropdown Label** | singleLineText | |
| **Contact Form Options** | multilineText | En per rad. |
| **Contact Form CTA Text** | singleLineText | |
| **Contact Form Message Label** | singleLineText | |
| **Contact Form Trust Signals** | multilineText | En per rad, format `**Bold** \| Resten`. |
| **Contact Form Show Contact Person** | checkbox | Ska ALLTID inkluderas. |
```

Lägg också till formateringsregel:

> 9. **Contact Form-fält:** `Contact Form Layout` ska vara `split` eller `centered`. `Contact Form Theme` ska vara `dark` eller `light`. Trust signals ska följa format `**Bold del** | Resten av meningen`, en per rad.

## Cache-invalidering

`lib/wexoe-cache.ts` behöver **inte** ändras. `LP_ENTITIES` / `PA_ENTITIES` / `AUDIENCE_ENTITIES` är samma — de nya fälten ligger på respektive page-entity.

## Testning

För varje page-typ:

1. Skapa ny sida i Builder → expandera "Kontaktformulär"-sektion → fyll i fält → publicera.
2. Verifiera att Airtable har rätt värden i nya kolumner.
3. Verifiera att WP-sidan renderar formuläret med korrekt config.
4. Submita formuläret → ny rad i User data-tabellen med `submission_type = "contact"` och `source_plugin` korrekt.
5. Testa `#kontakt`-länk från en knapp på samma sida → scrollar till formuläret.

## Öppna punkter (samma som huvuddokumentet)

1. Position i layout (ersätter eller kompletterar kontaktperson-kortet?)
2. Builder-namnval för section-id: `'contactForm'` (camelCase, matchar conventions) eller `'contact-form'`?
3. Ska "Visa kontaktperson bredvid formuläret"-toggeln återanvända PageState-fältens `contact_*` direkt (visa kontaktpersonen om hen är fylld) eller kräva explicit toggle?

---

*Slut.*
