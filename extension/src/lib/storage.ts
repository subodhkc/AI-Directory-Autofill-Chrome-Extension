import { BUILTIN_LLM_CONFIG } from '@/agent/constants'
import type { ExtSettings, LLMSettings, ProviderConfigs, ProviderKey } from './types'

const STORAGE_KEYS = {
	llmConfig: 'submitAgent_llmConfig',
	providerConfigs: 'submitAgent_providerConfigs',
	language: 'submitAgent_language',
	autoRewrite: 'submitAgent_autoRewrite',
	activeProductId: 'submitAgent_activeProductId',
	floatButtonEnabled: 'submitAgent_floatButtonEnabled',
} as const

const EMPTY_LLM: LLMSettings = { apiKey: '', baseUrl: '', model: '' }

function defaultProviderConfigs(): ProviderConfigs {
	return {
		active: 'builtin',
		configs: {
			builtin: { ...EMPTY_LLM },
			openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
			groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
			deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
			custom: { ...EMPTY_LLM },
		},
	}
}

export async function getProviderConfigs(): Promise<ProviderConfigs> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.providerConfigs)
	const stored = result[STORAGE_KEYS.providerConfigs] as ProviderConfigs | undefined
	if (stored?.active && stored?.configs) return stored
	return defaultProviderConfigs()
}

export async function setProviderConfigs(configs: ProviderConfigs): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.providerConfigs]: configs })
}

/** Resolves the active provider config into a single LLMSettings for the agent to use */
export async function getLLMConfig(): Promise<LLMSettings> {
	const pc = await getProviderConfigs()
	if (pc.active === 'builtin') {
		return BUILTIN_LLM_CONFIG
	}
	const cfg = pc.configs[pc.active]
	if (!cfg || (!cfg.baseUrl && !cfg.model)) {
		return BUILTIN_LLM_CONFIG
	}
	return cfg
}

export async function setLLMConfig(config: LLMSettings): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.llmConfig]: config })
}

export async function getLanguage(): Promise<'en' | 'zh'> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.language)
	return (result[STORAGE_KEYS.language] as 'en' | 'zh') ?? 'en'
}

export async function setLanguage(lang: 'en' | 'zh'): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.language]: lang })
}

export async function getAutoRewrite(): Promise<boolean> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.autoRewrite)
	return (result[STORAGE_KEYS.autoRewrite] as boolean) ?? true
}

export async function setAutoRewrite(value: boolean): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.autoRewrite]: value })
}

export async function getFloatButtonEnabled(): Promise<boolean> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.floatButtonEnabled)
	return (result[STORAGE_KEYS.floatButtonEnabled] as boolean) ?? true
}

export async function setFloatButtonEnabled(value: boolean): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.floatButtonEnabled]: value })
}

export async function getActiveProductId(): Promise<string | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.activeProductId)
	return (result[STORAGE_KEYS.activeProductId] as string) ?? null
}

export async function setActiveProductId(id: string | null): Promise<void> {
	if (id === null) {
		await chrome.storage.local.remove(STORAGE_KEYS.activeProductId)
	} else {
		await chrome.storage.local.set({ [STORAGE_KEYS.activeProductId]: id })
	}
}

export async function getExtSettings(): Promise<ExtSettings> {
	const [llm, language, autoRewriteDesc] = await Promise.all([
		getLLMConfig(),
		getLanguage(),
		getAutoRewrite(),
	])
	return { llm, language, autoRewriteDesc }
}
