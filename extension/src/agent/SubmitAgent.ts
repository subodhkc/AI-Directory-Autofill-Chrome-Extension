import { type AgentConfig, PageAgentCore } from '@page-agent/core'
import type { ProductProfile } from '@/lib/types'

import { RemotePageController } from './RemotePageController'
import { TabsController } from './TabsController'
import SUBMIT_PROMPT from './submit-prompt.md?raw'
import { createTabTools } from './tabTools'
import { submitTools } from './tools'

export interface SubmitAgentConfig extends AgentConfig {
	product: ProductProfile
	siteName: string
	includeInitialTab?: boolean
}

function detectLanguage(): 'en-US' | 'zh-CN' {
	const lang = navigator.language || navigator.languages?.[0] || 'en-US'
	return lang.startsWith('zh') ? 'zh-CN' : 'en-US'
}

/**
 * SubmitAgent extends PageAgentCore for automated form submission.
 *
 * Follows the same runtime pattern as MultiPageAgent:
 * - Constructs RemotePageController + TabsController internally
 * - Heartbeat + mask lifecycle via storage polling
 * - Tab tools for multi-tab navigation
 * - Product-specific system prompt and form-filling tools
 */
export class SubmitAgent extends PageAgentCore {
	readonly product: ProductProfile
	readonly siteName: string

	constructor(config: SubmitAgentConfig) {
		const tabsController = new TabsController()
		const pageController = new RemotePageController(tabsController)
		const tabTools = createTabTools(tabsController)

		const language = config.language ?? detectLanguage()
		const targetLanguage = language === 'zh-CN' ? '中文' : 'English'
		const systemPrompt =
			SUBMIT_PROMPT.replace(
				/Default working language: \*\*.*?\*\*/,
				`Default working language: **${targetLanguage}**`
			)

		const includeInitialTab = config.includeInitialTab ?? true

		let heartBeatInterval: null | number = null

		super({
			...config,
			pageController: pageController as any,
			customTools: { ...tabTools, ...submitTools },
			customSystemPrompt: systemPrompt,
			maxSteps: config.maxSteps ?? 50,

			onBeforeTask: async (agent) => {
				await tabsController.init(includeInitialTab)

				heartBeatInterval = window.setInterval(() => {
					chrome.storage.local.set({ agentHeartbeat: Date.now() })
				}, 1_000)

				await chrome.storage.local.set({ isAgentRunning: true })
			},

			onAfterTask: async () => {
				if (heartBeatInterval) {
					window.clearInterval(heartBeatInterval)
					heartBeatInterval = null
				}
				await chrome.storage.local.set({ isAgentRunning: false })
			},

			onBeforeStep: async () => {
				if (!tabsController.currentTabId) return
				await tabsController.waitUntilTabLoaded(tabsController.currentTabId!)
			},

			onDispose: () => {
				if (heartBeatInterval) {
					window.clearInterval(heartBeatInterval)
					heartBeatInterval = null
				}
				chrome.storage.local.set({ isAgentRunning: false })
				tabsController.dispose()
			},
		})

		this.product = config.product
		this.siteName = config.siteName
	}
}

export function buildProductContext(product: ProductProfile): string {
	const lines = [
		'## Product Data',
		'',
		`**Name:** ${product.name}`,
		`**URL:** ${product.url}`,
		`**Tagline:** ${product.tagline}`,
		'',
		'**Short Description:**',
		product.shortDesc,
		'',
		'**Long Description:**',
		product.longDesc,
		'',
		`**Categories:** ${product.categories.join(', ')}`,
	]

	if (product.founderName) {
		lines.push(`**Founder:** ${product.founderName}`)
	}
	if (product.founderEmail) {
		lines.push(`**Email:** ${product.founderEmail}`)
	}

	const socialEntries = Object.entries(product.socialLinks).filter(([_, v]) => v)
	if (socialEntries.length > 0) {
		lines.push('', '**Social Links:**')
		for (const [platform, url] of socialEntries) {
			lines.push(`- ${platform}: ${url}`)
		}
	}

	const assets: string[] = []
	if (product.logoSquare) assets.push(`Logo (square): ${product.logoSquare}`)
	if (product.logoBanner) assets.push(`Logo (banner): ${product.logoBanner}`)
	if (product.screenshots?.length) {
		product.screenshots.forEach((s, i) => assets.push(`Screenshot ${i + 1}: ${s}`))
	}
	if (assets.length > 0) {
		lines.push('', '**Product Assets (for manual upload):**')
		for (const a of assets) lines.push(`- ${a}`)
	}

	return lines.join('\n')
}

const SITE_HINTS: Record<string, string> = {
	'Medium': 'This is a blogging platform. The submission form is a story editor. Fill the title with the product name and the body with an adapted version of the long description formatted as a blog post with paragraphs.',
	'Product Hunt': 'This is a product launch platform. Fill the product name, tagline, URL, and description. The description should be punchy and community-oriented. Topics/tags should match the product category.',
	'G2': 'This is a software review platform. Fill product name, URL, and description. Categories should match software categories. You may need to select a product type from a dropdown.',
	'Crunchbase': 'This is a company database. Fill company name, URL, description, categories, and founder info. Select the appropriate company type and stage from dropdowns.',
	'SourceForge': 'This is an open-source software directory. Fill project name, URL, description, and tags. Select appropriate categories from dropdowns.',
	'Behance': 'This is a creative portfolio platform. Fill project name, description, and tags. The description should be creative-oriented.',
	'Issuu': 'This is a digital publishing platform. Fill publication title, description, and tags.',
	'GitHub': 'This is a code hosting platform. If the form is an Awesome List submission, fill the repository URL and a short description.',
	'Dev.to': 'This is a developer blogging platform. Fill the title with the product name and the body with a technical-oriented article about the product.',
	'HackerNews': 'This is a news aggregator. Fill the title with a concise product description and the URL. Keep the title under 80 characters.',
}

export function getSiteHints(siteName: string): string {
	const hint = SITE_HINTS[siteName]
	if (!hint) return ''
	return `\n**Site-specific hint for ${siteName}:**\n${hint}\n`
}
