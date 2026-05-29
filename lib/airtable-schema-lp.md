# Airtable Schema — Wexoe Landing Pages

**Base ID:** `appokKSTaBdCa8YiW` (Wexoe NY)

Detta schema används av Claude-middlemannen för att transformera
state-JSON till Airtable-fältnamn när en Landing Page skapas eller
uppdateras via buildern. Post-migration: snake_case överallt i
Airtable display-namn för LP-familjen.

---

## Tabell 1: cms_landing_pages

**Table ID:** `tblpPlk17FZIKawXY`

| Fältnamn | Typ | Kommentar |
|---|---|---|
| **slug** | singleLineText | URL-slug + primary key, lowercase a-z, 0-9, bindestreck. Matchar WP-shortcode. |
| **h1** | singleLineText | Sidans huvudrubrik i hero-bannern. |
| **internal_notes** | multilineText | Fri redaktörs-text. Inkludera INTE i Claude-output. |
| **is_active** | checkbox | Soft-delete-flagga. Inkludera INTE i Claude-output — backend hanterar. |
| **country_ids** | multipleRecordLinks | Länk till core_countries. **Hanteras av backend, inkludera ej.** |
| **seo_title** | singleLineText | Valfri SEO-rubrik. |
| **seo_description** | multilineText | Valfri meta-description (150-160 tecken). |
| **og_image_url** | url | Open Graph-bild-URL. |
| **hero_description** | multilineText | Brödtext under H1. |
| **hero_image_url** | url | Bild-URL från WP Media. |
| **hero_cta_text** | singleLineText | Primär CTA-knapp. Default "Kontakta oss". |
| **hero_cta_url** | singleLineText | Länk för primär CTA. |
| **hero_cta2_text** | singleLineText | Sekundär CTA — visas bara om ifylld. |
| **hero_cta2_url** | singleLineText | Länk för sekundär CTA. |
| **content_h2** | singleLineText | Rubrik i content-sektionen. |
| **content_text** | multilineText | Brödtext (stöder markdown). |
| **content_benefits** | multilineText | En benefit per rad, `\n`-separerad. |
| **sidebar_type** | singleSelect | Ett av: `case`, `event`, `leadmagnet`, `calculator`, eller tom sträng. |
| **case_id** | multipleRecordLinks | Endast om `sidebar_type = case`. Länk till ETT cms_cases-record; sidebaren renderar dess kort-lager (card_*) + permalink. **Hanteras av backend, inkludera ej i Claudes output.** |
| **calc_title** | singleLineText | Endast om `sidebar_type = calculator`. |
| **calc_html** | multilineText | Endast om `sidebar_type = calculator`. HTML/CSS/JS. |
| **event_type** | singleLineText | Endast om `sidebar_type = event`. |
| **event_title** | singleLineText | Endast om `sidebar_type = event`. |
| **event_description** | multilineText | Endast om `sidebar_type = event`. |
| **event_date** | singleLineText | Endast om `sidebar_type = event`. Fritext (inte date-typ). |
| **event_location** | singleLineText | Endast om `sidebar_type = event`. |
| **event_webhook** | url | Endast om `sidebar_type = event`. |
| **magnet_title** | singleLineText | Endast om `sidebar_type = leadmagnet`. |
| **magnet_format** | singleLineText | Endast om `sidebar_type = leadmagnet`. |
| **magnet_description** | multilineText | Endast om `sidebar_type = leadmagnet`. |
| **magnet_file_url** | url | Endast om `sidebar_type = leadmagnet`. |
| **magnet_webhook** | url | Endast om `sidebar_type = leadmagnet`. |
| **contact_name** | singleLineText | Kontaktpersonens namn. |
| **contact_title** | singleLineText | Titel. |
| **contact_email** | email | |
| **contact_phone** | phoneNumber | |
| **contact_image_url** | url | Porträttbild från WP Media. |
| **contact_quote** | multilineText | Citat/text intill porträttet. |
| **show_content** | checkbox | Ska ALLTID inkluderas (även när `false`). |
| **show_sidebar** | checkbox | Ska ALLTID inkluderas. |
| **show_contact** | checkbox | Ska ALLTID inkluderas. |
| **show_tabs** | checkbox | Ska ALLTID inkluderas. |
| **color_main** | singleLineText | Hex-color override, default `#11325D`. |
| **color_secondary** | singleLineText | Hex-color override, default `#F28C28`. |
| **tab_ids** | multipleRecordLinks | Länk till cms_landing_page_tabs. **Hanteras av backend, inkludera ej i Claudes output.** |

---

## Tabell 2: cms_landing_page_tabs

**Table ID:** `tblp8d32aj5BgGMvE`

En LP har 0 eller flera tabs. Tabs är linked records som pekar tillbaka på
cms_landing_pages via `landing_page_ids`-fältet.

| Fältnamn | Typ | Kommentar |
|---|---|---|
| **name** | singleLineText | Tab-rubrik i pill-knappen. |
| **order** | number | 1-baserat index. Används av WP-pluginet för sortering. |
| **is_active** | checkbox | Ska alltid vara `true`. |
| **tab_type** | singleSelect | Ett av: `textimage`, `fullmedia`, `faq`, `calameo`, `downloads`, `compare`, `steps`. |
| **internal_notes** | multilineText | Fri redaktörs-text. Inkludera INTE. |
| **landing_page_ids** | multipleRecordLinks | Back-link till cms_landing_pages. **Hanteras av backend, inkludera ej.** |
| **download_ids** | multipleRecordLinks | Länk till cms_landing_page_downloads. **Hanteras av backend, inkludera ej.** |

### Typ-specifika fält

Inkludera **endast** de fält som hör till tabens `tab_type`.

**textimage:**

| Fält | Typ | Format |
|---|---|---|
| `ti_h2` | singleLineText | |
| `ti_text` | multilineText | |
| `ti_benefits` | multilineText | En benefit per rad, `\n`-separerad. |
| `ti_image_url` | url | |
| `ti_inverted` | checkbox | Alltid inkludera om tab är textimage. |

**fullmedia:**

| Fält | Typ | Format |
|---|---|---|
| `fm_url` | url | YouTube-länk eller bild-URL (auto-detect av WP). |

**faq:**

| Fält | Typ | Format |
|---|---|---|
| `faq_items` | multilineText | `Q: Fråga\nA: Svar\n\nQ: Fråga 2\nA: Svar 2` (tom rad separerar). |

**calameo:**

| Fält | Typ | Format |
|---|---|---|
| `calameo_1_title` / `calameo_1_src` | text / url | Upp till 3 dokument. |
| `calameo_2_title` / `calameo_2_src` | text / url | |
| `calameo_3_title` / `calameo_3_src` | text / url | |

**downloads:**

Inga tab-fält — nedladdningar skapas som separata records i cms_landing_page_downloads-tabellen
och linkas till taben via `tab_ids`-fältet där.

**compare:**

| Fält | Typ | Format |
|---|---|---|
| `compare_title` | singleLineText | |
| `compare_col_a` | singleLineText | Rubrik på kolumn A. |
| `compare_col_b` | singleLineText | Rubrik på kolumn B. |
| `compare_rows` | multilineText | `Label \| Värde A \| Värde B` per rad (pipe-separerat), `\n`-separerat mellan rader. |

**steps:**

| Fält | Typ | Format |
|---|---|---|
| `steps_title` | singleLineText | |
| `steps` | multilineText | `Rubrik \| Beskrivning` per rad (pipe-separerat), `\n`-separerat mellan rader. |

---

## Tabell 3: cms_landing_page_downloads

**Table ID:** `tbltAtilGKnQ2wc7I`

Downloads är linked records som hör till en tab via `tab_ids`-fältet.

| Fältnamn | Typ | Kommentar |
|---|---|---|
| **name** | singleLineText | Filnamn eller titel. |
| **description** | singleLineText | Kort beskrivning. |
| **thumbnail_url** | url | Valfri thumbnail-URL. |
| **file_url** | url | Länk till filen (WP Media). |
| **button_text** | singleLineText | Knapp-text, oftast filtyp (ex. "PDF"). |
| **order** | number | 1-baserat index inom taben. |
| **is_active** | checkbox | Ska alltid vara `true`. |
| **internal_notes** | multilineText | Fri redaktörs-text. Inkludera INTE. |
| **tab_ids** | multipleRecordLinks | Back-link till cms_landing_page_tabs. **Hanteras av backend, inkludera ej.** |

---

## Formateringsregler

Claude ska **tolka** och **städa** user-edited data innan den går till Airtable:

1. **Utelämna tomma fält** (tomma strängar, null) vid CREATE. Vid UPDATE kan
   backend sätta explicit `""` för fält som ska rensas — men Claude behöver inte
   bry sig om det.

2. **content_benefits / ti_benefits:** Om input ser ut som en paragraf
   eller kommaseparerad lista, splitta till en per rad (`\n`).

3. **faq_items:** Säkerställ att varje fråga har `Q: `-prefix och varje svar `A: `-prefix.
   Separera QA-par med en blank rad.

4. **compare_rows:** Säkerställ pipe-format `Label | Värde A | Värde B` per rad.

5. **steps:** Säkerställ pipe-format `Rubrik | Beskrivning` per rad.

6. **Boolean-fält** (`show_content`, `show_sidebar`, `show_tabs`, `show_contact`,
   `show_contact_form`, `contact_form_show_*`-checkboxes, `is_active`, `ti_inverted`)
   ska ALLTID inkluderas i outputen, även när `false`.

7. **Sidebar-typ-fält:** Inkludera endast fält som hör till den aktiva
   `sidebar_type`. Backend rensar stale fält från andra typer vid UPDATE.

8. **Tab-typ-fält:** Inkludera endast fält som hör till tabens `tab_type`.
   Backend rensar stale fält vid UPDATE.

9. **Contact Form-fält:** Alla 15 `contact_form_*`-fält ska ALLTID inkluderas
   i `landingPage.fields` vid UPDATE (även tomma eller false) så att ingen
   data tappas i en delvis publish. `contact_form_layout` = `split` eller
   `centered`. `contact_form_theme` = `dark` eller `light`. `contact_form_trust_signals`
   format: `**Bold** | Resten` per rad, max 3.

---

## Contact Form-fält (cms_landing_pages-tabellen)

Renderas av `\Wexoe\Core\Renderers\ContactForm` sist på LP-sidan när
`show_contact_form` = true. Samma 15 fält finns på Product Areas och
Audience Heroes (men där fortfarande med legacy PascalCase tills de
familjerna migreras).

| Fältnamn | Typ | Kommentar |
|---|---|---|
| `show_contact_form` | checkbox | True = rendera kontaktformulär sist. |
| `contact_form_eyebrow` | singleLineText | |
| `contact_form_title` | singleLineText | Tom = PHP-default. |
| `contact_form_subtitle` | multilineText | |
| `contact_form_layout` | singleSelect | `split` eller `centered`. |
| `contact_form_theme` | singleSelect | `dark` eller `light`. |
| `contact_form_show_company` | checkbox | |
| `contact_form_show_phone` | checkbox | |
| `contact_form_show_dropdown` | checkbox | |
| `contact_form_dropdown_label` | singleLineText | Tom = PHP-default. |
| `contact_form_options` | multilineText | En option per rad. |
| `contact_form_cta_text` | singleLineText | Tom = "Skicka". |
| `contact_form_message_label` | singleLineText | |
| `contact_form_trust_signals` | multilineText | `**Bold** \| Text` per rad, max 3. |
| `contact_form_show_contact_person` | checkbox | Visa kontaktperson-kort. |
