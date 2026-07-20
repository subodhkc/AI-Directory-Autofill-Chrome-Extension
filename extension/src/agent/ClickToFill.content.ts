import type { ProductProfile } from '@/lib/types'

const FIELD_KEYWORDS: Record<string, string[]> = {
	name: ['name', 'product name', 'app name', 'tool name', 'project name', 'title', 'product title'],
	url: ['url', 'website', 'link', 'homepage', 'product url', 'website url'],
	tagline: ['tagline', 'slogan', 'one-liner', 'subtitle', 'catchphrase'],
	shortDesc: ['short description', 'summary', 'brief', 'about', 'teaser', 'short bio'],
	longDesc: ['long description', 'detailed description', 'full description', 'details', 'bio', 'more info', 'description'],
	categories: ['category', 'categories', 'tag', 'tags', 'topic', 'topics', 'industry', 'niche', 'label', 'type'],
	founderName: ['founder', 'author', 'creator', 'your name', 'contact name', 'submitted by'],
	founderEmail: ['email', 'contact email', 'your email', 'email address'],
}

function getFieldKey(element: HTMLInputElement | HTMLTextAreaElement): string | null {
	const label = getFieldLabel(element)
	if (!label) return null
	const lower = label.toLowerCase().trim()

	for (const [key, keywords] of Object.entries(FIELD_KEYWORDS)) {
		for (const kw of keywords) {
			if (lower.includes(kw)) return key
		}
	}
	return null
}

function getFieldLabel(element: HTMLInputElement | HTMLTextAreaElement): string {
	// Check placeholder
	if (element.placeholder) return element.placeholder

	// Check aria-label
	if (element.getAttribute('aria-label')) return element.getAttribute('aria-label')!

	// Check associated <label> via id
	if (element.id) {
		const label = document.querySelector(`label[for="${element.id}"]`)
		if (label?.textContent) return label.textContent.trim()
	}

	// Check parent <label>
	let parent: HTMLElement | null = element.parentElement
	while (parent && parent.tagName !== 'FORM') {
		if (parent.tagName === 'LABEL') {
			return parent.textContent?.trim() ?? ''
		}
		parent = parent.parentElement
	}

	// Check preceding sibling
	let sibling: Element | null = element.previousElementSibling
	while (sibling) {
		if (sibling.tagName === 'LABEL' || sibling.getAttribute('role') === 'label') {
			return sibling.textContent?.trim() ?? ''
		}
		sibling = sibling.previousElementSibling
	}

	// Check data attributes
	if (element.getAttribute('data-label')) return element.getAttribute('data-label')!
	if (element.getAttribute('data-field')) return element.getAttribute('data-field')!

	return ''
}

function getProductValue(product: ProductProfile, fieldKey: string): string | null {
	switch (fieldKey) {
		case 'name': return product.name
		case 'url': return product.url
		case 'tagline': return product.tagline
		case 'shortDesc': return product.shortDesc
		case 'longDesc': return product.longDesc
		case 'categories': return product.categories.join(', ')
		case 'founderName': return product.founderName || null
		case 'founderEmail': return product.founderEmail || null
		default: return null
	}
}

let popup: HTMLDivElement | null = null
let currentField: HTMLInputElement | HTMLTextAreaElement | null = null
let cachedProduct: ProductProfile | null = null

async function getActiveProduct(): Promise<ProductProfile | null> {
	if (cachedProduct) return cachedProduct
	try {
		const response = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_PRODUCT' })
		if (response?.product) {
			cachedProduct = response.product as ProductProfile
			return cachedProduct
		}
	} catch {
		// Background not ready or no product
	}
	return null
}

function showPopup(element: HTMLInputElement | HTMLTextAreaElement, product: ProductProfile, fieldKey: string, value: string) {
	hidePopup()

	const rect = element.getBoundingClientRect()
	popup = document.createElement('div')
	popup.id = 'submit-agent-fill-popup'
	popup.style.cssText = `
		position: fixed;
		top: ${rect.bottom + 4}px;
		left: ${rect.left}px;
		z-index: 2147483647;
		background: #1a1a2e;
		color: #e0e0e0;
		border: 1px solid #4a4a6a;
		border-radius: 8px;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 13px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		max-width: ${Math.max(rect.width, 300)}px;
		overflow: hidden;
	`

	const header = document.createElement('div')
	header.style.cssText = `
		padding: 6px 10px;
		font-size: 11px;
		color: #8888aa;
		border-bottom: 1px solid #333355;
		display: flex;
		align-items: center;
		gap: 6px;
	`
	header.innerHTML = `<span style="font-size: 14px;">📋</span> Submit Agent — <strong style="color:#aaaadd;">${fieldKey}</strong>`
	popup.appendChild(header)

	const preview = document.createElement('div')
	preview.style.cssText = `
		padding: 8px 10px;
		max-height: 120px;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-word;
		color: #c8c8d8;
		line-height: 1.4;
	`
	preview.textContent = value.length > 200 ? value.slice(0, 200) + '...' : value
	popup.appendChild(preview)

	const actions = document.createElement('div')
	actions.style.cssText = `
		padding: 6px 10px;
		display: flex;
		gap: 8px;
		border-top: 1px solid #333355;
	`
	const fillBtn = document.createElement('button')
	fillBtn.textContent = 'Fill'
	fillBtn.style.cssText = `
		background: #4a6cf7;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 4px 12px;
		font-size: 12px;
		cursor: pointer;
		font-weight: 500;
	`
	fillBtn.addEventListener('click', (e) => {
		e.preventDefault()
		e.stopPropagation()
		fillField(element, value)
		hidePopup()
	})

	const dismissBtn = document.createElement('button')
	dismissBtn.textContent = 'Dismiss'
	dismissBtn.style.cssText = `
		background: transparent;
		color: #8888aa;
		border: 1px solid #444466;
		border-radius: 4px;
		padding: 4px 10px;
		font-size: 12px;
		cursor: pointer;
	`
	dismissBtn.addEventListener('click', (e) => {
		e.preventDefault()
		e.stopPropagation()
		hidePopup()
	})

	actions.appendChild(fillBtn)
	actions.appendChild(dismissBtn)
	popup.appendChild(actions)

	document.body.appendChild(popup)

	// Adjust position if popup goes below viewport
	const popupRect = popup.getBoundingClientRect()
	if (popupRect.bottom > window.innerHeight) {
		popup.style.top = `${rect.top - popupRect.height - 4}px`
	}
	if (popupRect.right > window.innerWidth) {
		popup.style.left = `${window.innerWidth - popupRect.width - 8}px`
	}
}

function fillField(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
		element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
		'value'
	)?.set
	if (nativeInputValueSetter) {
		nativeInputValueSetter.call(element, value)
	} else {
		element.value = value
	}
	element.dispatchEvent(new Event('input', { bubbles: true }))
	element.dispatchEvent(new Event('change', { bubbles: true }))
}

function hidePopup() {
	if (popup) {
		popup.remove()
		popup = null
	}
	currentField = null
}

export function initClickToFill() {
	let focusTimeout: number | null = null

	document.addEventListener('focusin', async (e) => {
		if (focusTimeout) clearTimeout(focusTimeout)
		hidePopup()

		const target = e.target
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
		if (target.type === 'hidden' || target.type === 'submit' || target.type === 'button' || target.type === 'checkbox' || target.type === 'radio') return

		focusTimeout = window.setTimeout(async () => {
			const fieldKey = getFieldKey(target)
			if (!fieldKey) return

			const product = await getActiveProduct()
			if (!product) return

			const value = getProductValue(product, fieldKey)
			if (!value) return

			currentField = target
			showPopup(target, product, fieldKey, value)
		}, 300)
	})

	document.addEventListener('focusout', (e) => {
		// Delay hide to allow clicking the fill button
		window.setTimeout(() => {
			if (popup && !popup.matches(':hover')) {
				hidePopup()
			}
		}, 200)
	})

	// Hide on scroll or resize
	window.addEventListener('scroll', () => hidePopup(), { passive: true })
	window.addEventListener('resize', () => hidePopup(), { passive: true })

	// Invalidate cached product on storage change
	chrome.storage.onChanged.addListener((changes) => {
		if (changes['submitAgent_activeProductId']) {
			cachedProduct = null
		}
	})
}
