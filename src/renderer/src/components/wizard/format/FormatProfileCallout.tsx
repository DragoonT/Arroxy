import type {ReactNode} from 'react'
import {useTranslation} from 'react-i18next'
import {SlidersHorizontal, X} from 'lucide-react'
import {useAppStore} from '../../../store/useAppStore.js'
import {Alert, AlertAction, AlertDescription, AlertTitle} from '../../ui/alert.js'
import {Button} from '../../ui/button.js'

// One-time callout above the profile line: the Format step starts from the
// active profile, and nothing on screen says the menu and pencil beside it tune
// that profile without leaving the download. Opening either counts as having seen it.
export function FormatProfileCallout(): ReactNode {
	const {t} = useTranslation()
	const pending = useAppStore(state => state.settings !== null && state.settings.common?.formatProfileCalloutDismissed !== true)
	const dismiss = useAppStore(state => state.dismissFormatProfileCallout)
	if (!pending) return null
	return (
		<Alert variant="info" data-testid="format-profile-callout">
			<SlidersHorizontal aria-hidden />
			<AlertTitle>{t('wizard.formats.profile.calloutTitle')}</AlertTitle>
			<AlertDescription>{t('wizard.formats.profile.calloutBody')}</AlertDescription>
			<AlertAction>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={t('titleBar.close')} onClick={() => void dismiss()} data-testid="format-profile-callout-dismiss">
					<X />
				</Button>
			</AlertAction>
		</Alert>
	)
}
