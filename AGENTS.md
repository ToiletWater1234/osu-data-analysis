# Documentation must accompany every website update

For every website update, review and update `templates/about.html`, including usage, actual integrated repositories, limitations and the dated change log. Preserve the author's footer links. Do not attribute evaluated-only repositories as integrated dependencies.

After the guide matches the implementation, run `node scripts/documentation-review.mjs --record`, then `npm run build` and the relevant checks before deployment. The build verifies a source fingerprint so implementation edits cannot silently ship with an unreviewed guide. Do not merely renew the fingerprint to bypass documentation review.
