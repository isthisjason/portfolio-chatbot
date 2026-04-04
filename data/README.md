# Portfolio Data

This folder is the source of truth for the chatbot's grounded context.

Edit these files with your real public portfolio and resume data:

- `portfolio/owner.js`
- `portfolio/projects.js`
- `portfolio/experience.js`
- `portfolio/stack.js`
- `portfolio/boundaries.js`

The Worker prompt reads from these files through `data/portfolio/index.js`, so you can maintain real source data separately from prompt wording.

Guidelines:

- Only include facts you are comfortable exposing publicly.
- Prefer short, evidence-based statements over marketing language.
- Add projects and experience entries in a format recruiters can skim.
- Keep sensitive or non-public details out of these files.
