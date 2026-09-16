# audio/ — Recitation audio (PRIVATE)

**Required file**: a manifest validating against
`quran_api/schemas/audio-manifest.schema.json`
(start from `quran_api/schemas/audio-manifest.template.json`).

Every file entry must carry, from the dataset itself:
`sequence_number, surah, ayah, audio_url, format, codec, bitrate, sample_rate,
duration_ms, file_size, checksum (SHA-256)`.
The manifest also carries the source, licence, licence URL, attribution and the
reciter + riwayah.

**License required**: redistribution permission, or at least a documented
streaming permission (then `status: "streaming_only"` and no download URL).
**Verification**: `npm run import:audio -- <file> --validate-only` (schema),
then the real import verifies every URL over HTTP: status, content type,
declared size and SHA-256. Only files that pass become `verified = true`.
**Never**: no CDN scraping, no bypassing access controls, no mirroring.
