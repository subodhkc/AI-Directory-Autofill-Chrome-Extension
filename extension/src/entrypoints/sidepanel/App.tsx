import { useState, useRef, useEffect } from 'react'
import type { SiteData } from '@/lib/types'
import type { Tab } from '@/components/Dashboard'
import { Dashboard } from '@/components/Dashboard'
import { QuickCreate } from '@/components/QuickCreate'
import { SubmitFlow } from '@/components/SubmitFlow'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Button } from '@/components/ui/Button'
import { useProduct } from '@/hooks/useProduct'
import { useSites } from '@/hooks/useSites'
import { useSubmitAgent } from '@/hooks/useSubmitAgent'
import { useT } from '@/hooks/useLanguage'

type View =
	| { name: 'dashboard' }
	| { name: 'quick-create' }
	| { name: 'site-detail'; site: SiteData }
	| { name: 'settings' }
	| { name: 'float-fill' }

export default function App() {
	const t = useT()
	const [view, setView] = useState<View>({ name: 'dashboard' })
	const [activeTab, setActiveTab] = useState<Tab>('all')
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const { products, activeProduct, loading: productLoading, createProduct, setActive } = useProduct()
	const { sites, submissions, loading: sitesLoading, markSubmitted, markSkipped } = useSites(activeProduct?.id ?? null)
	const { status: agentStatus, history, activity, startSubmission, startSubmissionOnCurrentTab, stop, reset } = useSubmitAgent()
	const [agentError, setAgentError] = useState<string | null>(null)

	// Listen for float-fill trigger from content script via background
	useEffect(() => {
		const handler = (message: any) => {
			if (message.type !== 'FLOAT_FILL') return
			if (message.action === 'start') {
				if (!activeProduct) {
					chrome.runtime.sendMessage({ type: 'FLOAT_FILL', action: 'no-product' }).catch(() => {})
					return
				}
				setView({ name: 'float-fill' })
				setAgentError(null)
				chrome.storage.session.get('floatFillTabId').then(async (res) => {
					const tabId = res.floatFillTabId as number | undefined
					let tabUrl = window.location.href
					if (tabId) {
						try {
							const tab = await chrome.tabs.get(tabId)
							tabUrl = tab.url ?? tabUrl
						} catch {}
					}
					startSubmissionOnCurrentTab(activeProduct, tabUrl)
						.then(() => {
							setView({ name: 'dashboard' })
						})
						.catch((err: Error) => {
							setAgentError(err.message)
						})
				})
			}
		}
		chrome.runtime.onMessage.addListener(handler)
		return () => chrome.runtime.onMessage.removeListener(handler)
	}, [activeProduct, startSubmissionOnCurrentTab])

	useEffect(() => {
		if (!dropdownOpen) return
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [dropdownOpen])

	if (view.name === 'settings') {
		return (
			<div className="flex flex-col h-screen bg-background">
				<SettingsPanel onClose={() => setView({ name: 'dashboard' })} />
			</div>
		)
	}

	if (view.name === 'quick-create') {
		return (
			<div className="flex flex-col h-screen bg-background">
				<header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
					<span className="text-base font-semibold">{t('common.submitAgent')}</span>
					<Button variant="ghost" size="sm" onClick={() => setView({ name: 'dashboard' })}>
						{t('common.back')}
					</Button>
				</header>
				<QuickCreate
					onSave={async (data) => {
						await createProduct(data)
						setView({ name: 'dashboard' })
					}}
					onSkip={() => chrome.runtime.openOptionsPage()}
					onOpenSettings={() => setView({ name: 'settings' })}
				/>
			</div>
		)
	}

	if (view.name === 'site-detail') {
		return (
			<div className="flex flex-col h-screen bg-background">
				<SubmitFlow
					site={view.site}
					product={activeProduct!}
					agentStatus={agentStatus}
					agentHistory={history}
					agentActivity={activity}
					agentError={agentError}
					onStartSubmit={async () => {
						setAgentError(null)
						try {
							const result = await startSubmission(view.site, activeProduct!)
							if (result.success) {
								markSubmitted(view.site.name, activeProduct!.id)
							}
						} catch (err) {
							setAgentError(err instanceof Error ? err.message : String(err))
						}
					}}
					onRetryOnCurrentTab={async () => {
										setAgentError(null)
										reset()
										try {
											const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
											const tabUrl = tab?.url ?? view.site.submit_url ?? ''
											const result = await startSubmissionOnCurrentTab(activeProduct!, tabUrl)
											if (result.success) {
												markSubmitted(view.site.name, activeProduct!.id)
											}
										} catch (err) {
											setAgentError(err instanceof Error ? err.message : String(err))
										}
									}}
					onStop={stop}
					onBack={() => { reset(); setAgentError(null); setView({ name: 'dashboard' }) }}
					onMarkSubmitted={() => markSubmitted(view.site.name, activeProduct!.id)}
					onSkip={() => markSkipped(view.site.name, activeProduct!.id)}
				/>
			</div>
		)
	}

	if (view.name === 'float-fill') {
		return (
			<div className="flex flex-col h-screen bg-background">
				<header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
					<span className="text-base font-semibold">{t('sidepanel.autoFilling')}</span>
					<Button variant="ghost" size="sm" onClick={() => { stop(); setView({ name: 'dashboard' }) }}>
						{t('common.cancel')}
					</Button>
				</header>
				<div className="flex-1 p-3 space-y-2">
					{agentError ? (
						<div className="text-xs text-destructive bg-destructive/10 rounded p-2">{agentError}</div>
					) : (
						<div className="text-xs text-muted-foreground">
							<div className="font-medium text-foreground mb-1">{t('sidepanel.product')} {activeProduct?.name}</div>
							<div>{t('sidepanel.status')} {agentStatus}</div>
							{activity && <div className="mt-1 text-xs">{activity.type}: {JSON.stringify(activity).slice(0, 80)}</div>}
						</div>
					)}
				</div>
			</div>
		)
	}

	const isLoading = productLoading || sitesLoading

	return (
		<div className="flex flex-col h-screen bg-background">
			<header className="border-b border-border/60 px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="relative" ref={dropdownRef}>
						<button
							type="button"
							className="text-base font-semibold flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
							onClick={() => setDropdownOpen((o) => !o)}
						>
							{activeProduct?.name ?? t('common.submitAgent')}
							<svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
							</svg>
						</button>
						{dropdownOpen && (
							<div className="absolute top-full left-0 mt-1.5 bg-popover border border-border/60 rounded-lg shadow-lg z-50 min-w-[180px] py-1.5">
								{products.map((p) => (
									<button
										key={p.id}
										type="button"
										className={`w-full text-left px-3.5 py-2 text-sm hover:bg-accent transition-colors cursor-pointer ${
											p.id === activeProduct?.id ? 'font-semibold text-primary' : ''
										}`}
										onClick={() => { setActive(p.id); setDropdownOpen(false) }}
									>
										{p.name}
									</button>
								))}
								<div className="border-t border-border/60 my-1" />
								<button
									type="button"
									className="w-full text-left px-3.5 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground cursor-pointer"
									onClick={() => { setView({ name: 'quick-create' }); setDropdownOpen(false) }}
								>
									{t('common.addProduct')}
								</button>
							</div>
						)}
					</div>
					<div className="flex items-center gap-0.5">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => chrome.runtime.openOptionsPage()}
						>
							{t('common.products')}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setView({ name: 'settings' })}
						>
							{t('common.settings')}
						</Button>
					</div>
				</div>
			</header>

			<main className={`flex-1 overflow-hidden ${activeProduct ? 'p-3' : ''}`}>
				{isLoading ? (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						{t('common.loading')}
					</div>
				) : !activeProduct ? (
					<QuickCreate
						onSave={async (data) => {
							await createProduct(data)
							setView({ name: 'dashboard' })
						}}
						onSkip={() => chrome.runtime.openOptionsPage()}
						onOpenSettings={() => setView({ name: 'settings' })}
					/>
				) : (
					<Dashboard
						sites={sites}
						submissions={submissions}
						activeTab={activeTab}
						onTabChange={setActiveTab}
						onSelectSite={(site) => { reset(); setAgentError(null); setView({ name: 'site-detail', site }) }}
					/>
				)}
			</main>
		</div>
	)
}
