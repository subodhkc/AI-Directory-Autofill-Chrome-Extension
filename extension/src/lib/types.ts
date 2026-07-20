/** Product profile stored in IndexedDB. User fills this once, agent uses it for every submission. */
export interface ProductProfile {
	id: string
	name: string
	url: string
	tagline: string
	shortDesc: string
	longDesc: string
	categories: string[]
	logoSquare?: string
	logoBanner?: string
	screenshots: string[]
	founderName: string
	founderEmail: string
	socialLinks: Record<string, string>
	createdAt: number
	updatedAt: number
}

export type SubmissionStatus =
	| 'not_started'
	| 'in_progress'
	| 'submitted'
	| 'approved'
	| 'rejected'
	| 'failed'
	| 'skipped'

/** Tracks per-site submission state in IndexedDB */
export interface SubmissionRecord {
	id: string
	siteName: string
	productId: string
	status: SubmissionStatus
	rewrittenDesc?: string
	submittedAt?: number
	notes?: string
	createdAt: number
	updatedAt: number
}

/** One entry from sites.json */
export interface SiteData {
	name: string
	submit_url: string | null
	category: string
	lang?: string
	dr: number | null
	monthly_traffic: string
	pricing: string
	status?: string
	notes?: string
}

/** sites.json top-level structure */
export interface SitesDatabase {
	meta: {
		name: string
		description: string
		last_updated: string
		total_sites: number
		license: string
		repository: string
	}
	sites: SiteData[]
}

/** LLM config persisted in chrome.storage.local */
export interface LLMSettings {
	apiKey: string
	baseUrl: string
	model: string
}

export type ProviderKey = 'builtin' | 'openai' | 'groq' | 'deepseek' | 'custom'

/** Per-provider LLM configs + active provider selection */
export interface ProviderConfigs {
	active: ProviderKey
	configs: Record<ProviderKey, LLMSettings>
}

/** Extension-wide settings persisted in chrome.storage.local */
export interface ExtSettings {
	llm: LLMSettings
	language: 'en' | 'zh'
	autoRewriteDesc: boolean
}

/** Message types for background <-> content script communication */
export type MessageType = 'PAGE_CONTROL' | 'TAB_CONTROL' | 'TAB_CHANGE' | 'SUBMIT_CONTROL' | 'GET_STATUS' | 'GET_ACTIVE_PRODUCT'

export interface ExtMessage {
	type: MessageType
	action: string
	payload?: unknown
	targetTabId?: number
}
