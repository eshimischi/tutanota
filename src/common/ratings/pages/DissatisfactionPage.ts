import m, { Children, Component, Vnode } from "mithril"
import { client } from "../../misc/ClientDetector.js"
import { Dialog } from "../../gui/base/Dialog.js"
import { isIOSApp } from "../../api/common/Env.js"
import { deviceConfig } from "../../misc/DeviceConfig.js"
import { locator } from "../../api/main/CommonLocator.js"
import { completeEvaluationStage, TriggerType } from "../InAppRatingUtils.js"
import { DateTime } from "luxon"
import { ImageWithOptionsDialog } from "../../gui/dialogs/ImageWithOptionsDialog"

interface DissatisfactionPageAttrs {
	dialog: Dialog
}

export class DissatisfactionPage implements Component<DissatisfactionPageAttrs> {
	view({ attrs: { dialog } }: Vnode<DissatisfactionPageAttrs>): Children {
		return m(
			"",
			{ style: { height: "666px" } },
			m(ImageWithOptionsDialog, {
				image: `${window.tutao.appState.prefixWithoutFile}/images/rating/your-opinion-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
				titleText: "ratingHowAreWeDoing_title",
				messageText: "ratingExplanation_msg",
				mainActionText: "ratingLoveIt_label",
				mainActionClick: () => {
					dialog.close()
				},
				subActionText: "ratingNeedsWork_label",
				subActionClick: () => {
					dialog.close()
				},
			}),
		)
	}
}
