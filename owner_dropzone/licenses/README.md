# licenses/ — Permission evidence (PRIVATE)

Every licence, permission letter, contract and signed agreement goes here, one
file per dataset, named `<kind>-<subject>.<ext>`, e.g.
`translation-en-saheeh.pdf`, `audio-<reciter>.pdf`, `quran_text-<edition>.pdf`.

Alongside each file, record it in the License Center so the gate can see it:

```bash
npm run license:record -- \
  --kind=translation --subject=en-saheeh --status=CONFIRMED \
  --redistribution=allowed --commercial=allowed \
  --owner="…" --copyright="…" --license="…" --license-url="…" \
  --evidence="signed permission dated 2026-…, owner_dropzone/licenses/translation-en-saheeh.pdf" \
  --evidence-url="…" --recorded-by="اسم المالك"
```

`CONFIRMED` is impossible without evidence and an explicit redistribution
answer — the database refuses the row (`LICENSE_EVIDENCE_REQUIRED`).

What counts as evidence:
- a licence file that unambiguously covers **this** material (not just the
  packaging around it),
- or written permission from the copyright holder naming the material, the
  permitted uses (redistribution, commercial), and any attribution wording.

What does **not** count:
- the file being downloadable from the internet,
- an SPDX string in someone else's `package.json`,
- a licence that covers a compilation but not the underlying text,
- an automated test passing.

Check the current state any time:
```bash
npm run license:list
npm run release:gate
```
