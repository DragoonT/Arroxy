import type {ReactNode} from 'react'
import {useTranslation} from 'react-i18next'
import {MousePointerClick, X} from 'lucide-react'
import {Alert, AlertAction, AlertDescription, AlertTitle} from '../ui/alert.js'
import {Button} from '../ui/button.js'

// One-time callout above the page: the link menu is a right-click, which nothing on
// screen hints at. Takes its own row so the view below never covers it.
export function ExploreLinkCallout({onDismiss}: {onDismiss: () => void}): ReactNode {
	const {t} = useTranslation()
	return (
		<Alert variant="info" size="sm" data-testid="explore-link-callout">
			<MousePointerClick aria-hidden />
			<AlertTitle>{t('explore.linkCallout.title')}</AlertTitle>
			<AlertDescription>{t('explore.linkCallout.body')}</AlertDescription>
			<AlertAction>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={t('titleBar.close')} onClick={onDismiss} data-testid="explore-link-callout-dismiss">
					<X />
				</Button>
			</AlertAction>
		</Alert>
	)
}
