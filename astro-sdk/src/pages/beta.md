---
title: Beta access
x-feature: beta-access
---

# Beta access

This Markdown page contributes `beta-access` to the generated
`toggly-page-features.json` manifest via the `x-feature` frontmatter.

Middleware in `src/middleware.ts` performs the sample's server-side
enforcement (404 when the flag is off). Deploy a Toggly Cloudflare Worker in
front of static hosting for edge enforcement of the same manifest.
