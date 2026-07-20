import type {
	AgentActivity,
	AgentStatus,
	HistoricalEvent,
} from '@page-agent/core'
import type { ProductProfile, SiteData, SubmissionRecord, SubmissionStatus } from '@/lib/types'
import type { TranslationKey } from '@/lib/i18n'
import { useState } from 'react'
import { useT } from '@/hooks/useLanguage'
import { Button } from './ui/Button'

interface SubmitFlowProps {
	site: SiteData
	product: ProductProfile | null
	submission?: SubmissionRecord
	agentStatus: AgentStatus
	agentActivity: AgentActivity | null
	agentHistory: HistoricalEvent[]
	agentError: string | null
	onStartSubmit: () => void
	onRetryOnCurrentTab: () => void
	onStop: () => void
	onMarkSubmitted: () => void
	onSkip: () => void
	onBack: () => void
}

function humanizeActivity(activity: AgentActivity, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
	switch (activity.type) {
		case 'thinking':
			return t('submitFlow.activity.thinking')
		case 'executing': {
			const tool = activity.tool
			if (tool === 'click') return t('submitFlow.activity.clicking')
			if (tool === 'type' || tool === 'input_text') return t('submitFlow.activity.typing')
			if (tool === 'scroll') return t('submitFlow.activity.scrolling')
			if (tool === 'navigate' || tool === 'goto') return t('submitFlow.activity.navigating')
			if (tool === 'select') return t('submitFlow.activity.selecting')
			if (tool === 'screenshot' || tool === 'snapshot') return t('submitFlow.activity.reading')
			return t('submitFlow.activity.running', { tool })
		}
		case 'executed': {
			const tool = activity.tool
			if (tool === 'click') return t('submitFlow.activity.clicked')
			if (tool === 'type' || tool === 'input_text') return t('submitFlow.activity.typed')
			if (tool === 'scroll') return t('submitFlow.activity.scrolled')
			if (tool === 'navigate' || tool === 'goto') return t('submitFlow.activity.navigated')
			if (tool === 'select') return t('submitFlow.activity.selected')
			if (tool === 'screenshot' || tool === 'snapshot') return t('submitFlow.activity.read')
			return t('submitFlow.activity.done', { tool })
		}
		case 'retrying':
			return t('submitFlow.activity.retrying', { attempt: activity.attempt, maxAttempts: activity.maxAttempts })
		case 'error':
			return t('submitFlow.activity.error', { message: activity.message })
		default:
			return ''
	}
}

function activityColor(activity: AgentActivity): string {
	switch (activity.type) {
		case 'thinking': return 'text-blue-700 dark:text-blue-200'
		case 'executing': return 'text-yellow-700 dark:text-yellow-300'
		case 'executed': return 'text-green-700 dark:text-green-300'
		case 'retrying': return 'text-amber-700 dark:text-amber-300'
		case 'error': return 'text-red-700 dark:text-red-300'
		default: return 'text-muted-foreground'
	}
}

function DebugLog({ history }: { history: HistoricalEvent[] }) {
	const t = useT()
	const [expanded, setExpanded] = useState(false)
	if (history.length === 0) return null
	return (
		<div className="mt-2">
			<button
				className="text-[10px] text-muted-foreground underline underline-offset-2"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? t('submitFlow.hideDetails') : t('submitFlow.viewDetails')}
			</button>
			{expanded && (
				<div className="mt-2 max-h-48 overflow-y-auto space-y-1 rounded border border-border bg-muted/40 p-2">
					{history.map((event, i) => {
						if (event.type === 'step') {
							return (
								<div key={i} className="text-[10px] text-muted-foreground border-b border-border pb-1">
									<span className="font-medium text-foreground">{t('submitFlow.stepLabel', { n: event.stepIndex + 1 })}</span>{' '}
									{event.action.name}
									{event.reflection.next_goal && (
										<div className="truncate">→ {event.reflection.next_goal}</div>
									)}
								</div>
							)
						}
						if (event.type === 'error') {
							return (
								<div key={i} className="text-[10px] text-red-500">
									{t('common.error')}: {event.message}
								</div>
							)
						}
						return null
					})}
				</div>
			)}
		</div>
	)
}

export function SubmitFlow({
	site,
	product,
	submission,
	agentStatus,
	agentActivity,
	agentHistory,
	agentError,
	onStartSubmit,
	onRetryOnCurrentTab,
	onStop,
	onMarkSubmitted,
	onSkip,
	onBack,
}: SubmitFlowProps) {
	const t = useT()
	const submissionStatus: SubmissionStatus = submission?.status ?? 'not_started'
	const isAgentRunning = agentStatus === 'running'
	const isCompleted = agentStatus === 'completed'
	const isError = agentStatus === 'error' || !!agentError
	const stepCount = agentHistory.filter((e) => e.type === 'step').length
	const alreadySubmitted = submissionStatus === 'submitted' || submissionStatus === 'approved'

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<button
					className="text-muted-foreground hover:text-foreground disabled:opacity-40 text-sm"
					onClick={onBack}
					disabled={isAgentRunning}
				>
					←
				</button>
				<span className="text-sm font-semibold truncate flex-1">{site.name}</span>
				<span className="text-xs text-muted-foreground shrink-0">
					DR {site.dr}
				</span>
				{site.pricing && (
					<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">
						{site.pricing.startsWith('Free') ? 'Free' : 'Paid'}
					</span>
				)}
			</header>

			{/* Body */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3">

				{/* === IDLE: not started or previously submitted === */}
				{!isAgentRunning && !isCompleted && !isError && (
					<>
						{/* Site info */}
						<div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-muted-foreground shrink-0">{site.category}</span>
							</div>
							<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">{t('submitFlow.traffic')}</span>
									<span className="font-medium">{site.monthly_traffic || '—'}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">{t('submitFlow.pricing')}</span>
									<span className="font-medium capitalize">{site.pricing}</span>
								</div>
							</div>
							{site.notes && (
								<p className="text-[11px] text-muted-foreground italic border-t border-border pt-2">{site.notes}</p>
							)}
						</div>

						{/* Already submitted notice */}
						{alreadySubmitted && (
							<div className="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950 p-3 text-xs text-green-700 dark:text-green-300">
								{t('submitFlow.alreadySubmitted')}
							</div>
						)}

						{/* Submitting as */}
						{product ? (
							<div className="rounded-lg border border-border p-3 space-y-1">
								<div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t('submitFlow.submittingAs')}</div>
								<div className="text-xs font-medium text-foreground">{product.name}</div>
								{(product.tagline || product.shortDesc) && (
									<div className="text-xs text-muted-foreground line-clamp-2">{product.tagline || product.shortDesc}</div>
								)}
							</div>
						) : (
							<div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-700 dark:text-amber-300">
								{t('submitFlow.noProduct')}
							</div>
						)}
					</>
				)}

				{/* === RUNNING === */}
				{isAgentRunning && (
					<div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 space-y-3">
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
							</span>
							<span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t('submitFlow.agentWorking')}</span>
							{stepCount > 0 && (
								<span className="ml-auto text-[10px] text-blue-500 dark:text-blue-400">{t('submitFlow.steps', { count: stepCount })}</span>
							)}
						</div>
						{agentActivity ? (
							<div className={`text-xs ${activityColor(agentActivity)}`}>
								{humanizeActivity(agentActivity, t)}
							</div>
						) : (
							<div className="text-xs text-blue-500 dark:text-blue-400">{t('submitFlow.initializing')}</div>
						)}
						<DebugLog history={agentHistory} />
					</div>
				)}

				{/* === COMPLETED === */}
				{isCompleted && !isError && (
					<div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4 space-y-2">
						<div className="flex items-center gap-2">
							<span className="text-green-600 dark:text-green-400 text-base">✓</span>
							<span className="text-xs font-medium text-green-700 dark:text-green-300">
								{t('submitFlow.formFilled')}
							</span>
						</div>
						<p className="text-xs text-green-600 dark:text-green-400">
							{t('submitFlow.formFilledDesc')}
						</p>
						<DebugLog history={agentHistory} />
					</div>
				)}

				{/* === ERROR === */}
				{isError && (
					<div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 space-y-2">
						<div className="flex items-center gap-2">
							<span className="text-red-500 text-base">✕</span>
							<span className="text-xs font-medium text-red-700 dark:text-red-300">{t('submitFlow.somethingWrong')}</span>
						</div>
						{agentError && (
							<p className="text-xs text-red-600 dark:text-red-400">
								{agentError}
							</p>
						)}
						<DebugLog history={agentHistory} />
					{agentError && /login|sign.?in|auth/i.test(agentError) && (
						<p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
							{t('submitFlow.loginRequired')}
						</p>
					)}
					</div>
				)}

			</div>

			{/* Footer actions */}
			<footer className="border-t p-3 space-y-2">
				{/* Running: only show Stop */}
				{isAgentRunning && (
					<Button variant="outline" size="sm" className="w-full" onClick={onStop}>
						{t('submitFlow.stop')}
					</Button>
				)}

				{/* Completed: primary = open & submit, secondary = mark done */}
				{isCompleted && !isError && (
					<>
						{site.submit_url && (
							<Button
								className="w-full"
								onClick={() => window.open(site.submit_url!, '_blank')}
							>
								{t('submitFlow.openPageSubmit')}
							</Button>
						)}
						<Button variant="outline" size="sm" className="w-full" onClick={onMarkSubmitted}>
							{t('submitFlow.markSubmitted')}
						</Button>
					</>
				)}

				{/* Idle / Error: primary = start, secondary = open manually */}
				{!isAgentRunning && !isCompleted && (
					<>
						{site.submit_url ? (
							<Button
								className="w-full"
								disabled={!product}
								onClick={onStartSubmit}
							>
								{isError ? t('submitFlow.retryAutoSubmit') : alreadySubmitted ? t('submitFlow.reSubmit') : t('submitFlow.startAutoSubmit')}
							</Button>
						) : (
							<div className="text-xs text-muted-foreground text-center py-1">
								{t('submitFlow.noSubmitUrl')}
							</div>
						)}
					{isError && (
						<Button variant="outline" size="sm" className="w-full" onClick={onRetryOnCurrentTab}>
							{t('submitFlow.retryOnCurrentTab')}
						</Button>
					)}
						<div className="flex gap-2">
							{site.submit_url && (
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onClick={() => window.open(site.submit_url!, '_blank')}
								>
									{t('submitFlow.openManually')}
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="flex-1"
								onClick={onSkip}
							>
								{t('common.skip')}
							</Button>
						</div>
					</>
				)}
			</footer>
		</div>
	)
}
