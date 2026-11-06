# Commons source texts

The paragraphs in `paragraphs.json` are excerpts of public Ethereum documentation from [ethereum.org](https://ethereum.org/).

## License

Verified on 2026-11-06 against the Ethereum Foundation terms of use, [ethereum.org/terms-of-use](https://ethereum.org/en/terms-of-use/):

> Unless otherwise marked, (a) all material, data, and information on the Websites, such as data files, text, music, audio files or other sounds, photographs, videos, or other images, but excluding any software or computer code (collectively, the “Non-Code Content”) are licensed under the Creative Commons Attribution 4.0 International License; and (b) all software or computer code (collectively, the “Code Content”) are licensed under the MIT License.

These files contain Non-Code Content only, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The [ethereum-org-website](https://github.com/ethereum/ethereum-org-website) MIT license covers the site software; no code from that repository is included here.

**Attribution.** Ethereum documentation by ethereum.org contributors. Non-code content is licensed by Stiftung Ethereum (Ethereum Foundation) under CC BY 4.0. Source repository: `https://github.com/ethereum/ethereum-org-website`, commit `c362ca84b53659a924d360ac02ca5a99987cacb3` (2026-11-05). Each item's `pageUrl` and `repoPath` name the page it came from.

## What changed

- Markdown syntax, fenced code, tables, and component markup were removed.
- A paragraph longer than 120 words was split at a sentence boundary. Pieces under 20 words were dropped.
- Link lists, command lines, and field dumps were left out.
- 200 excerpts were kept, taking turns across the pages in `paragraphs.json`, so the queue is not a single article.

`sourceRef` is the page URL plus `#pNNN`, where `NNN` is this corpus's excerpt index on that page. `pnpm seed:commons` copies `sourceRef`, `sourceText`, and a target language (`hi` or `mr`) into `CommonsItem`.
