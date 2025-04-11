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
	view({ attrs }: Vnode<EvaluationPageAttrs>): Children {
		return m(ImageWithOptionsDialog, {
			image: `${window.tutao.appState.prefixWithoutFile}/images/rating/your-opinion-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
			imageStyle: { "max-width": "300px" },
			titleText: "ratingHowAreWeDoing_title",
			messageText: "ratingExplanation_msg",
			mainActionText: "ratingLoveIt_label",
			mainActionClick: () => this.onMainActionClick(attrs),
			subActionText: "ratingNeedsWork_label",
			subActionClick: () => this.onSubActionClick(attrs),
		})
	}

	private async onMainActionClick({ dialog, navigate, triggerType }: EvaluationPageAttrs) {
		completeEvaluationStage(triggerType, "LoveIt")

		const isBusinessUser = (await locator.logins.getUserController().loadCustomer()).businessUse

		const lastRatingPromptedDate = deviceConfig.getLastRatingPromptedDate()

		// Did the user rate within the last year already?
		const hasRated =
			lastRatingPromptedDate != null && DateTime.fromJSDate(lastRatingPromptedDate).diff(DateTime.fromJSDate(getCurrentDate()), ["years"]).years <= 1

		if (!hasRated || isBusinessUser) {
			if (isIOSApp()) {
				// We cannot get the result of the user rating on iOS, so we have to set the date here.
				deviceConfig.setLastRatingPromptedDate(getCurrentDate())
				dialog.close()
				void locator.systemFacade.requestInAppRating()
			} else {
				navigate("androidPlayStore")
			}
		} else {
			navigate("supportTuta")
		}
	}

	private onSubActionClick({ triggerType, navigate }: EvaluationPageAttrs) {
		completeEvaluationStage(triggerType, "NeedsWork")

		navigate("dissatisfaction")
	}
}
