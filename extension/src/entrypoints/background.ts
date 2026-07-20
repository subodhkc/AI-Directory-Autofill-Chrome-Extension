import { handlePageControlMessage } from '@/agent/RemotePageController.background'
import { handleTabControlMessage, setupTabChangeEvents } from '@/agent/TabsController.background'
import { setFloatButtonEnabled, getActiveProductId } from '@/lib/storage'
import { getProduct } from '@/lib/db'

export default defineBackground(() => {
	console.log('[Submit Agent] Background service worker started')

	setupTabChangeEvents()

	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

	chrome.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
		if (message.type === 'TAB_CONTROL') {
			return handleTabControlMessage(message, sender, sendResponse)
		} else if (message.type === 'PAGE_CONTROL') {
			return handlePageControlMessage(message, sender, sendResponse)
		} else if (message.type === 'SUBMIT_CONTROL') {
			return handleSubmitControl(message, sendResponse)
		} else if (message.type === 'FETCH_PAGE_CONTENT') {
			return handleFetchPageContent(message, sendResponse)
		} else if (message.type === 'FLOAT_BUTTON_TOGGLE') {
			return handleFloatButtonToggle(message, sendResponse)
		} else if (message.type === 'FLOAT_FILL') {
			return handleFloatFill(message, sender, sendResponse)
		} else if (message.type === 'GET_ACTIVE_PRODUCT') {
			return handleGetActiveProduct(sendResponse)
		} else {
			sendResponse({ error: 'Unknown message type' })
			return
		}
	})
})

function handleSubmitControl(
	message: { type: string; action: string; payload?: any },
	sendResponse: (response: unknown) => void
): true | undefined {
	switch (message.action) {
		case 'open_submit_page': {
			const url = message.payload as string
			if (!url) {
				sendResponse({ error: 'No URL provided' })
				return
			}
			chrome.tabs.create({ url, active: true }).then((tab) => {
				sendResponse({ ok: true, tabId: tab.id })
			})
			return true
		}
		default:
			sendResponse({ error: `Unknown SUBMIT_CONTROL action: ${message.action}` })
			return
	}
}

function handleFetchPageContent(
	message: { type: string; url: string },
	sendResponse: (response: unknown) => void
): true {
	const { url } = message
	fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SubmitAgent/1.0)' },
		signal: AbortSignal.timeout(15000),
	})
		.then(async (res) => {
			if (!res.ok) {
				sendResponse({ error: `HTTP ${res.status}` })
				return
			}
			const html = await res.text()
			sendResponse({ ok: true, html })
		})
		.catch((err) => {
			sendResponse({ error: err instanceof Error ? err.message : String(err) })
		})
	return true
}

function handleFloatFill(
	message: { type: string; action: string; payload?: any },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void
): true {
	const tabId = sender.tab?.id

	if (message.action === 'start' && tabId) {
		// Store requesting tab so sidepanel knows which tab to operate on
		chrome.storage.session.set({ floatFillTabId: tabId }).catch(() => {})
		// Auto-open sidepanel on this tab
		chrome.sidePanel.open({ tabId }).catch(() => {})
	}

	// Broadcast to sidepanel / relay back to content scripts
	chrome.runtime.sendMessage(message).catch(() => {})

	sendResponse({ ok: true })
	return true
}

function handleFloatButtonToggle(
	message: { type: string; enabled: boolean },
	sendResponse: (response: unknown) => void
): true {
	const { enabled } = message
	setFloatButtonEnabled(enabled).then(() => {
		chrome.tabs.query({}, (tabs) => {
			for (const tab of tabs) {
				if (tab.id) {
					chrome.tabs.sendMessage(tab.id, { type: 'FLOAT_BUTTON_TOGGLE', enabled }).catch(() => {})
				}
			}
		})
		sendResponse({ ok: true })
	})
	return true
}

function handleGetActiveProduct(
	sendResponse: (response: unknown) => void
): true {
	getActiveProductId().then(async (productId) => {
		if (!productId) {
			sendResponse({ product: null })
			return
		}
		const product = await getProduct(productId)
		sendResponse({ product: product ?? null })
	}).catch(() => {
		sendResponse({ product: null })
	})
	return true
}
