# PA-familjen — datamigrationslogg

Spårning av datamigrationen från legacy-basen `Wexoe` (`appXoUcK68dQwASjF`)
till SSOT-basen `Wexoe NY` (`appokKSTaBdCa8YiW`) för PA-familjen.

Schemat byggdes i en tidigare migration (se `lib/airtable-schema-pa.md`).
Den här loggen täcker själva data-flytten.

## Status

| Tabell | Källa | Mål | Antal | Status |
|---|---|---|---|---|
| `cms_solutions_mini` | `Solutions & Concepts` (tblc98m9MJcpbWAVU) | tblxK7ikOgLFuze6m | 11 | ✅ klar |
| `cms_products` | `Products` (tblHafyCEyh7S3Y64) | tblN23V7uAMpeZoO1 | 46 | ✅ klar |
| `cms_product_page_sections` | extraherade ur Normal 1–4-slots på `Product Areas` | tbl1r3T3ukIPJ0S3N | 18 | ✅ klar |
| `cms_product_pages` | `Product Areas` (tblgatNFYFMwF4EcQ) | tbl5PQR7FNHCogeya | 19 | ✅ klar |

## Linkade records

- `product_ids` på cms_product_pages översatta via gammal→ny rec-ID-tabell
  (alla 46 products mappade).
- `solution_ids` på cms_product_pages översatta via gammal→ny rec-ID-tabell
  (alla 11 solutions mappade).
- `section_ids` på cms_product_pages pekar på nyskapade sub-records i
  cms_product_page_sections, sorterade på `order`.

## Divisioner

Endast `INDUSTRY` (gammalt rec-ID `rec39zJoKEAbWCMQ1`) har en motsvarande
SSOT-division (`Industri`, `recN7qh6VJ8vqxTjJ`) och länkades automatiskt på
de 15 PA:er som tillhör den i den gamla basen.

`IT INFRA`-taggade PA:er (Fiber, Koppar, Rack & skåp, FTTO) lämnades med
tomt `division_ids` — `core_divisions` i Wexoe NY har idag bara
`Industri`/`Automation`/`Kassasystem`, ingen direkt motsvarighet till IT
INFRA. Behöver manuell mappning innan de syns på rätt divisionssida.

## Cross-base limitations

`article_ids` på cms_products är inte rewired ännu — gamla
`Articles`-rec-ID:n från legacy-basen pekar inte på de nya `cms_articles`
i Wexoe NY (artiklarna migrerades i en tidigare PR med nya IDs). Behöver en
lookup-mappning gammal-artikel-ID → ny-artikel-ID per produkt; körs som
separat pass när vi behöver visa article-listor på PA-sidor.

## Bekräftelseparet

- 19 PA:er i `cms_product_pages` (slug-set: vfd, ibe, robot, hmi, fiber, io,
  onmachine, koppar, mjukvara, plc, lagspanning, rack, protokoll, remote,
  switch, motion, gear, ftto, safety).
- 18 sub-record-sektioner i `cms_product_page_sections` (motsvarar
  fyllda Normal 1–4-slots på de PA:er som hade dem).
- 46 produkter i `cms_products`, varav 40 aktiva.
- 11 solutions i `cms_solutions_mini`.
