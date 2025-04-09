import { deviceConfig } from "../misc/DeviceConfig.js"
import { completeEvaluationStage, completeTriggerStage, createEvent, isEventHappyMoment, TriggerType } from "./InAppRatingUtils.js"
import { MultiPageDialog } from "../gui/dialogs/MultiPageDialog.js"
import { EvaluationPage } from "./pages/EvaluationPage.js"
import m from "mithril"
import { DateTime } from "luxon"
import { ButtonType } from "../gui/base/Button.js"
import { AndroidPlayStorePage } from "./pages/AndroidPlayStorePage.js"
import { Const } from "../api/common/TutanotaConstants.js"
import { DissatisfactionPage } from "./pages/DissatisfactionPage.js"

export type UserSatisfactionDialogPage = "evaluation" | "dissatisfaction" | "androidPlayStore"

export function showAppRatingDialog(triggerType: TriggerType): void {
	completeTriggerStage(triggerType)

	deviceConfig.setNextEvaluationDate(DateTime.now().plus({ month: 4 }).toJSDate())

	const dialog = new MultiPageDialog<UserSatisfactionDialogPage>("evaluation", (dialog, navigateToPage, _) => ({
		evaluation: {
			content: m(EvaluationPage, {
				triggerType,
				dialog,
				navigate: navigateToPage,
			}),
			rightAction: {
				label: "notNow_label",
				click: () => {
					dialog.close()
					deviceConfig.setNextEvaluationDate(DateTime.now().plus({ months: 1 }).toJSDate())
					completeEvaluationStage(triggerType, "NotNow")
				},
				title: "notNow_label",
				type: ButtonType.Secondary,
			},
			// onClose handler is here because on android, using the back gesture causes the dialog to close.
			// This interaction shall be interpreted as a "Not now" response.
			onClose: () => {
				dialog.close()
				deviceConfig.setNextEvaluationDate(DateTime.now().plus({ months: 1 }).toJSDate())
				completeEvaluationStage(triggerType, "NotNow")
			},
		},
		androidPlayStore: {
			content: m(AndroidPlayStorePage, { triggerType, dialog }),
			onClose: () => {
				dialog.close()
				deviceConfig.setNextEvaluationDate(DateTime.now().plus({ months: 1 }).toJSDate())
			},
		},
		dissatisfaction: {
			content: m(DissatisfactionPage),
			onClose: () => {
				dialog.close()
				deviceConfig.setNextEvaluationDate(DateTime.now().plus({ months: 1 }).toJSDate())
			},
		},
	})).getDialog()

	dialog.show()
}

/**
 * If the client is on any app (Tuta Mail or Tuta Calendar), we save the current date as an event to determine if we want to trigger a "rate Tuta" dialog.
 */
export async function handleRatingByEvent(triggerType: TriggerType) {
	// FIXME
	if (true) {
		createEvent(deviceConfig)
	}

	// Allow stubbing the current date via `Const` for testing purposes.
	const currentDate = Const.CURRENT_DATE ?? new Date()

	// FIXME
	// const disallowReasons = await evaluateRatingEligibility(currentDate, deviceConfig, isApp())

	// FIXME
	if (false) {
		return
	}

	if (isEventHappyMoment(currentDate, deviceConfig)) {
		showAppRatingDialog(triggerType)
	}
}
