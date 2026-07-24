# Submit Agent


> A browser extension that uses AI to auto-fill product submission forms on directory sites. You provide your product info once; the agent fills every form for you.

---



## The problem

You built an AI product, but nobody knows about it.

Google decides whether a site is worth recommending based on how many other sites link to it. A new site has zero links — Google doesn't even know you exist. The fix: submit your product to directory sites. Each listing creates a backlink, and every backlink builds your authority.

But manually opening each site, finding the form, and filling in fields one by one often takes days.

Submit Agent can compress that to about 2 hours.

## How it works

**Submit Agent** runs in the browser: the AI reads the form structure on the current page, maps your product profile to each field, and automatically rewrites descriptions to avoid duplicate content.

1. You fill in your product info once (name, URL, descriptions, logo, social links).
2. Open a submission page — say, [Futurepedia](https://www.futurepedia.io/submit-tool) or [G2](https://www.g2.com/products/new).
3. Click the extension. The AI reads the page structure, figures out which fields need what, and fills them in. Descriptions are auto-rewritten so each submission is unique (Google penalizes duplicate content).
4. You review the filled form, then submit it yourself.

## Features

| Area | Details |
|------|---------|
| **385+ verified sites** | [`sites.json`](sites.json) collects backlinks from across the web, deduplicates them, and verifies site health. |
| **Progress dashboard** | Side panel dashboard: overall progress bar, sorted by DR; per-site submission flow shows agent status and activity log. |
| **Resumable** | Submission records and product profiles are stored locally (IndexedDB / `chrome.storage`). |
| **Based on PageAgent** | Core engine is [@page-agent](https://github.com/alibaba/page-agent) and related packages (Alibaba PageAgent ecosystem) — structured DOM observation + ReAct loop for click, input, and DOM reading decisions. |
| **Token-efficient** | No full-page screenshots for visual understanding. Uses DOM / page state, keeping prompts and context focused. |
| **Description dedup** | System prompt rewrites copy for each site, reducing the risk of being flagged as duplicate content. |
| **Built-in model option** | Supports built-in, OpenAI, DeepSeek, or any custom OpenAI-compatible endpoint; "Test Connection" in settings. |

## Install

### From release (recommended)

1. Download the latest `.zip` from 
2. Unzip it.
3. Open Chrome → `chrome://extensions` → turn on **Developer mode** (top right).
4. Click **Load unpacked** → select the unzipped folder.
5. Pin the extension from the puzzle icon in the toolbar.

### Build from source

```bash
cd extension
npm install
npm run build
```

The built extension lands in `extension/.output/chrome-mv3/`. Load that folder as unpacked in Chrome.

## Setup

### 1. Configure the AI model

Click the extension icon → **Settings**.

Submit Agent works with any OpenAI-compatible API.

We recommend using "qwen3.5-flash", "gemini-3-flash", or "claude-haiku-4.5" models. Form-filling doesn't require top-tier reasoning.

### 2. Add your product

First time you open the extension, it asks for your product URL. The AI fetches your site, reads it, and generates a profile: name, tagline, short description, long description, categories. You review and edit, then save.

You can also fill everything manually — click "or fill in manually" to open the full form.

Want to submit multiple products? The dropdown in the top-left corner of the side panel lets you switch between products or add new ones.

## Using the extension

### Method 1: Pick a site from the dashboard

Open the side panel (click the extension icon). You'll see a dashboard listing all sites, sorted by DR (Domain Rating). Sites you've already submitted to are marked.

Click any site → **Start Auto-fill**. The extension opens the submission page and the AI fills the form. When it's done, review and submit.

### Method 2: Fill the current page

Already on a submission page? Click the floating button that appears in the bottom-right corner of any webpage (you can toggle this off in Settings). The agent fills the form on whatever page you're on.

## Sites database

The complete data for all backlink sites lives in [`sites.json`](sites.json).

Six categories: AI directories, startup directories, review platforms, developer communities, deal platforms, and general SEO directories.

Missing a site? Data outdated? PRs welcome.

## Development

```bash
cd extension
npm install      # also runs wxt prepare
npm run dev      # launches Chrome with HMR and a persistent profile
npm run build    # production build
npm run zip      # package as .zip for distribution
```

### Tech stack

- **[WXT](https://wxt.dev/)** — browser extension framework (Manifest V3)
- **React 19** + **Tailwind CSS v4** — side panel and options page UI
- **[@page-agent/core](https://github.com/alibaba/page-agent)** — the AI engine that drives DOM analysis and form-filling (Alibaba PageAgent)
- **IndexedDB** — stores product profiles and submission records locally
- **chrome.storage** — persists LLM settings and preferences

### Project structure

```
extension/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts      # Service worker: routes messages between components
│   │   ├── content.ts          # Injected into every page, enables remote DOM control
│   │   ├── sidepanel/          # Main UI (React) — dashboard, settings, submission flow
│   │   └── options/            # Full-page product profile editor
│   ├── agent/
│   │   ├── SubmitAgent.ts      # Core agent: builds prompt, runs ReAct loop
│   │   ├── RemotePageController.ts  # Bridges agent actions to content script
│   │   ├── TabsController.ts   # Opens/focuses/closes browser tabs
│   │   └── submit-prompt.md    # System prompt for the AI
│   ├── components/             # React components (Dashboard, SubmitFlow, Settings...)
│   ├── hooks/                  # React hooks (useProduct, useSites, useSubmitAgent...)
│   └── lib/                    # Storage, i18n, types, profile generator
├── sites.json                  # Symlinked from repo root
└── wxt.config.ts               # WXT + Vite configuration
```

### Data flow

```
Side Panel
 → creates SubmitAgent with product data + LLM config
 → agent.execute(task)
 → ReAct loop: observe page → LLM decides action → execute via content script
 → fires events → React updates UI
 → user reviews filled form → submits manually
```

## Tips

- **Submit high-DR sites first.** G2 (92), Crunchbase (91), Product Hunt (91) — one link from these is worth ten from smaller sites.
- **Descriptions are auto-rewritten**, but review them. The AI keeps your key selling points while making each version unique.
- **Prep your assets before starting.** Logo (square + landscape), screenshots, one-liner, founder bio, social links. Having everything ready keeps the momentum going.
- **Verify your backlinks after.** Use [Ahrefs Backlink Checker](https://ahrefs.com/backlink-checker) (free tier) to confirm which submissions actually produced dofollow links.

## License

[MIT](LICENSE)
