import { BUILTIN_LLM_CONFIG } from '@/agent/constants'
import type { LLMSettings, ProviderKey } from '@/lib/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getProviderConfigs, setProviderConfigs, getFloatButtonEnabled } from '@/lib/storage'
import { useLocale, useT } from '@/hooks/useLanguage'
import { testLLMConnection, type TestResult } from '@/lib/llm-test'
import type { TranslationKey } from '@/lib/i18n'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'

interface SettingsPanelProps {
	onClose: () => void
}

const PROVIDER_LABELS: Record<ProviderKey, TranslationKey> = {
	builtin: 'settings.providerBuiltin',
	openai: 'settings.providerOpenAI',
	groq: 'settings.providerGroq',
	deepseek: 'settings.providerDeepSeek',
	custom: 'settings.providerCustom',
}

const PROVIDER_ORDER: ProviderKey[] = ['builtin', 'openai', 'groq', 'deepseek', 'custom']

const TEST_ERROR_KEYS: Record<string, TranslationKey> = {
	unreachable: 'settings.errUnreachable',
	unauthorized: 'settings.errUnauthorized',
	not_found: 'settings.errNotFound',
	model_not_found: 'settings.errModelNotFound',
	rate_limit: 'settings.errRateLimit',
	unknown: 'settings.errUnknown',
}

type TestState =
	| { status: 'idle' }
	| { status: 'testing' }
	| { status: 'success' }
	| { status: 'error'; result: TestResult & { ok: false } }

function EyeIcon({ open }: { open: boolean }) {
	if (open) {
		return (
			<svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M2.062 12.348a1 1 0 010-.696 10.75 10.75 0 0119.876 0 1 1 0 010 .696 10.75 10.75 0 01-19.876 0z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		)
	}
	return (
		<svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
		</svg>
	)
}

function CheckIcon() {
	return (
		<svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
			<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
		</svg>
	)
}

function SpinnerIcon() {
	return (
		<svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
			<circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
			<path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
		</svg>
	)
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
	const t = useT()
	const { locale, setLocale } = useLocale()
	const [activeProvider, setActiveProvider] = useState<ProviderKey>('builtin')
	const [configs, setConfigs] = useState<Record<ProviderKey, LLMSettings>>({
		builtin: { apiKey: '', baseUrl: '', model: '' },
		openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
		groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
		deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
		custom: { apiKey: '', baseUrl: '', model: '' },
	})
	const [lang, setLang] = useState(locale)
	const [floatEnabled, setFloatEnabled] = useState(true)
	const [saving, setSaving] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const [showApiKey, setShowApiKey] = useState(false)
	const [testState, setTestState] = useState<TestState>({ status: 'idle' })
	const successTimerRef = useRef<number | null>(null)

	useEffect(() => {
		Promise.all([getProviderConfigs(), getFloatButtonEnabled()]).then(([pc, floatBtn]) => {
			setActiveProvider(pc.active)
			setConfigs(pc.configs)
			setFloatEnabled(floatBtn)
			setLoaded(true)
		})
	}, [])

	useEffect(() => {
		return () => {
			if (successTimerRef.current) clearTimeout(successTimerRef.current)
		}
	}, [])

	const handleProviderSelect = useCallback((key: ProviderKey) => {
		setActiveProvider(key)
		setTestState({ status: 'idle' })
		setShowApiKey(false)
	}, [])

	const handleFieldChange = useCallback((field: keyof LLMSettings, value: string) => {
		setConfigs((prev) => ({
			...prev,
			[activeProvider]: { ...prev[activeProvider], [field]: value },
		}))
		setTestState({ status: 'idle' })
	}, [activeProvider])

	const handleTest = useCallback(async () => {
		const configToTest: LLMSettings = activeProvider === 'builtin'
			? BUILTIN_LLM_CONFIG
			: configs[activeProvider]

		if (!configToTest.baseUrl || !configToTest.model) return

		setTestState({ status: 'testing' })
		const result = await testLLMConnection(configToTest)

		if (result.ok) {
			setTestState({ status: 'success' })
			if (successTimerRef.current) clearTimeout(successTimerRef.current)
			successTimerRef.current = window.setTimeout(() => {
				setTestState({ status: 'idle' })
			}, 5000)
		} else {
			setTestState({ status: 'error', result })
		}
	}, [configs, activeProvider])

	const handleSave = useCallback(async () => {
		setSaving(true)
		try {
			await setProviderConfigs({ active: activeProvider, configs })
			setLocale(lang)
			chrome.runtime.sendMessage({ type: 'FLOAT_BUTTON_TOGGLE', enabled: floatEnabled }).catch(() => {})
			onClose()
		} finally {
			setSaving(false)
		}
	}, [activeProvider, configs, lang, floatEnabled, onClose, setLocale])

	const isBuiltinSelected = activeProvider === 'builtin'
	const currentConfig = configs[activeProvider]
	const hasValidConfig = !!(currentConfig.baseUrl && currentConfig.model)
	const canSave = isBuiltinSelected || hasValidConfig || (!currentConfig.baseUrl && !currentConfig.model)
	const canTest = isBuiltinSelected || hasValidConfig

	if (!loaded) {
		return <div className="p-4 text-xs text-muted-foreground">{t('common.loading')}</div>
	}

	return (
		<div className="flex flex-col h-full">
			<header className="flex items-center justify-between border-b px-3 py-2">
				<span className="text-sm font-semibold">{t('settings.title')}</span>
				<Button variant="ghost" size="sm" onClick={onClose}>
					{t('common.back')}
				</Button>
			</header>

			<div className="flex-1 overflow-y-auto p-3 space-y-4">
				{/* AI Model Configuration */}
				<div className="rounded-lg border border-border bg-card p-3 space-y-3">
					<div className="text-xs font-semibold text-foreground">{t('settings.aiModelConfig')}</div>

					{/* Provider preset pills */}
					<div className="flex flex-wrap gap-1.5">
						{PROVIDER_ORDER.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => handleProviderSelect(key)}
								className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
									activeProvider === key
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
								}`}
							>
								{t(PROVIDER_LABELS[key])}
							</button>
						))}
					</div>

					{/* Built-in active banner */}
					{isBuiltinSelected && (
						<div className="text-xs text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950 rounded-lg p-2.5 flex items-start gap-2">
							<svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
							</svg>
							<span>{t('settings.builtinActive')}</span>
						</div>
					)}

					{/* LLM fields — each provider has its own independent values */}
					<div className={`space-y-3 transition-opacity duration-150 ${isBuiltinSelected ? 'opacity-40 pointer-events-none' : ''}`}>
						<Input
							label={t('settings.baseUrl')}
							placeholder="https://api.openai.com/v1"
							value={currentConfig.baseUrl}
							onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
							disabled={isBuiltinSelected}
						/>

						<Input
							label={t('settings.apiKey')}
							placeholder={t('settings.apiKeyPlaceholder')}
							type={showApiKey ? 'text' : 'password'}
							value={currentConfig.apiKey}
							onChange={(e) => handleFieldChange('apiKey', e.target.value)}
							disabled={isBuiltinSelected}
							suffix={
								<button
									type="button"
									onClick={() => setShowApiKey((v) => !v)}
									className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5"
									tabIndex={-1}
								>
									<EyeIcon open={showApiKey} />
								</button>
							}
						/>

						<Input
							label={t('settings.model')}
							placeholder="gpt-4o-mini"
							value={currentConfig.model}
							onChange={(e) => handleFieldChange('model', e.target.value)}
							disabled={isBuiltinSelected}
						/>
					</div>

					{/* Test connection */}
					<div className="pt-1 space-y-2">
						<Button
							variant="outline"
							size="sm"
							className="w-full"
							disabled={!canTest || testState.status === 'testing'}
							onClick={handleTest}
						>
							{testState.status === 'testing' ? (
								<>
									<SpinnerIcon />
									{t('settings.testing')}
								</>
							) : (
								t('settings.testConnection')
							)}
						</Button>

						{testState.status === 'success' && (
							<div className="flex items-center gap-1.5 text-xs text-success animate-in fade-in duration-200">
								<CheckIcon />
								{t('settings.testSuccess')}
							</div>
						)}

						{testState.status === 'error' && (
							<div className="text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2 animate-in fade-in duration-200">
								<div className="font-medium mb-0.5">{t('settings.testFailed')}</div>
								<div className="text-destructive/80">
									{testState.result.code === 'unknown'
										? t(TEST_ERROR_KEYS[testState.result.code], { detail: testState.result.detail ?? '' })
										: t(TEST_ERROR_KEYS[testState.result.code])}
								</div>
							</div>
						)}
					</div>

					{/* Model required hint */}
					{!isBuiltinSelected && currentConfig.baseUrl && !currentConfig.model && (
						<div className="text-xs text-amber-600 dark:text-amber-400">
							{t('settings.modelRequired')}
						</div>
					)}
				</div>

				{/* Preferences */}
				<div className="rounded-lg border border-border bg-card p-3 space-y-3">
					<div className="text-xs font-semibold text-foreground">{t('settings.preferences')}</div>

					<Select
						label={t('settings.language')}
						value={lang}
						onChange={(e) => setLang(e.target.value as 'en' | 'zh')}
						options={[
							{ value: 'en', label: 'English' },
							{ value: 'zh', label: '中文' },
						]}
					/>

					<div className="flex items-center justify-between pt-1">
						<span className="text-xs font-medium text-foreground">{t('settings.showFloatButton')}</span>
						<button
							type="button"
							role="switch"
							aria-checked={floatEnabled}
							onClick={() => setFloatEnabled((v) => !v)}
							className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
								floatEnabled ? 'bg-primary' : 'bg-muted'
							}`}
						>
							<span
								className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
									floatEnabled ? 'translate-x-4' : 'translate-x-1'
								}`}
							/>
						</button>
					</div>
				</div>
			</div>

			<footer className="border-t p-3">
				<Button
					onClick={handleSave}
					disabled={saving || !canSave}
					className="w-full"
				>
					{saving ? t('common.saving') : t('settings.saveSettings')}
				</Button>
			</footer>
		</div>
	)
}
