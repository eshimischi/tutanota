import m, { Children, Component, Vnode } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { client } from "../../misc/ClientDetector.js"
import { windowFacade } from "../../misc/WindowFacade.js"
import { TUTA_CALENDAR_GOOGLE_PLAY_URL, TUTA_MAIL_GOOGLE_PLAY_URL } from "../../api/common/TutanotaConstants.js"
import { completeRatingStage, TriggerType } from "../UserSatisfactionUtils.js"
import { deviceConfig } from "../../misc/DeviceConfig.js"
import { ImageWithOptionsDialog } from "../../gui/dialogs/ImageWithOptionsDialog"
import { px } from "../../gui/size.js"

interface AndroidPlayStorePageAttrs {
	triggerType: TriggerType
	dialog: Dialog
}

export class AndroidPlayStorePage implements Component<AndroidPlayStorePageAttrs> {
	view({ attrs: { dialog, triggerType } }: Vnode<AndroidPlayStorePageAttrs>): Children {
		return m(ImageWithOptionsDialog, {
			image: `${window.tutao.appState.prefixWithoutFile}/images/rating/rate-us-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
			imageStyle: { maxWidth: px(300) },
			titleText: "ratingGooglePlay_title",
			messageText: "ratingGooglePlay_msg",
			mainActionText: "rateUs_action",
			mainActionClick: () => {
				dialog.close()
				deviceConfig.setLastRatingPromptedDate(new Date())
				completeRatingStage(triggerType, "RateUs")
				windowFacade.openLink(client.isCalendarApp() ? TUTA_CALENDAR_GOOGLE_PLAY_URL : TUTA_MAIL_GOOGLE_PLAY_URL)
			},
			subActionText: "maybeLater_action",
			subActionClick: () => {
				dialog.close()
				completeRatingStage(triggerType, "MaybeLater")
			},
		})
	}
}
