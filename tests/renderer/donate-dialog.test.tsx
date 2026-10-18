// @vitest-environment jsdom
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vite-plus/test'
import {App} from '@renderer/App.js'
import {useAppStore} from '@renderer/store/useAppStore.js'
import {DONATION_ADDRESSES, defaultAppSettings} from '@shared/constants.js'
import {buildMockAppApi} from '../shared/mockAppApi.js'

describe('Donate dialog', () => {
	const writeText = vi.fn().mockResolvedValue(undefined)

	beforeEach(() => {
		window.history.replaceState(null, '', '/')
		window.appApi = buildMockAppApi()
		window.platform = 'linux'
		Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true})
		useAppStore.setState({initialized: true, initializing: false, settings: defaultAppSettings('/tmp'), donateDialogOpen: false})
		vi.clearAllMocks()
	})

	it('opens from the footer and shows every full address with a QR code each', async () => {
		render(<App />)
		expect(screen.queryByTestId('donate-dialog')).not.toBeInTheDocument()

		fireEvent.click(await screen.findByTestId('btn-donate'))

		const dialog = await screen.findByTestId('donate-dialog')
		for (const {id, address} of DONATION_ADDRESSES) {
			const card = within(dialog).getByTestId(`donate-${id}`)
			expect(within(card).getByTestId(`donate-${id}-address`)).toHaveTextContent(address)
			expect(within(card).getByRole('img')).toHaveAttribute('src')
		}
		expect(within(dialog).getAllByRole('img')).toHaveLength(DONATION_ADDRESSES.length)
	})

	it.each(DONATION_ADDRESSES)('copies the $id address to the clipboard', async ({id, address}) => {
		useAppStore.setState({donateDialogOpen: true})
		render(<App />)

		fireEvent.click(await screen.findByTestId(`donate-${id}-copy`))

		await waitFor(() => expect(writeText).toHaveBeenCalledWith(address))
		expect(await screen.findByTestId(`donate-${id}-copy`)).toHaveTextContent('Copied')
	})
})
