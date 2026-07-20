import { initPageController } from '@/agent/RemotePageController.content'
import { initFloatButton } from '@/agent/FloatButton.content'
import { initClickToFill } from '@/agent/ClickToFill.content'
import { getFloatButtonEnabled } from '@/lib/storage'

export default defineContentScript({
	matches: ['<all_urls>'],
	runAt: 'document_end',

	async main() {
		console.debug('[Submit Agent] Content script loaded on', window.location.href)
		initPageController()
		const enabled = await getFloatButtonEnabled()
		initFloatButton(enabled)
		initClickToFill()
	},
})
