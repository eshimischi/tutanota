import m, { Children, Component, Vnode } from "mithril"
import { client } from "../../misc/ClientDetector.js"
import { Dialog } from "../../gui/base/Dialog.js"
import { isIOSApp } from "../../api/common/Env.js"
import { deviceConfig } from "../../misc/DeviceConfig.js"
import { locator } from "../../api/main/CommonLocator.js"
import { completeEvaluationStage, TriggerType } from "../UserSatisfactionUtils.js"
import { DateTime } from "luxon"
import { ImageWithOptionsDialog } from "../../gui/dialogs/ImageWithOptionsDialog"
import { getCurrentDate } from "../../api/common/TutanotaConstants.js"
import { UserSatisfactionDialogPage } from "../UserSatisfactionDialog.js"

interface EvaluationPageAttrs {
	triggerType: TriggerType
	dialog: Dialog
	navigate: (page: UserSatisfactionDialogPage) => void
}

export class EvaluationPage implements Component<EvaluationPageAttrs> {
	view({ attrs: { triggerType, dialog, navigate } }: Vnode<EvaluationPageAttrs>): Children {
		return m(ImageWithOptionsDialog, {
			image: `${window.tutao.appState.prefixWithoutFile}/images/rating/your-opinion-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
			titleText: "ratingHowAreWeDoing_title",
			messageText: "ratingExplanation_msg",
			mainActionText: "ratingLoveIt_label",
			mainActionClick: () => {
				completeEvaluationStage(triggerType, "LoveIt")

				const lastRatingPromptedDate = deviceConfig.getLastRatingPromptedDate()
				if (
					lastRatingPromptedDate == null ||
					DateTime.fromJSDate(lastRatingPromptedDate).diff(DateTime.fromJSDate(getCurrentDate()), ["years"]).years > 1
				) {
					if (isIOSApp()) {
						deviceConfig.setLastRatingPromptedDate(getCurrentDate())
						void locator.systemFacade.requestInAppRating()
						dialog.close()
					} else {
						navigate("androidPlayStore")
					}
				} else {
					// user rated already in the last year. Go to contribution dialog...
				}
			},
			subActionText: "ratingNeedsWork_label",
			subActionClick: () => {
				completeEvaluationStage(triggerType, "NeedsWork") //Fixme

				navigate("dissatisfaction")
			},
		})
	}
}
