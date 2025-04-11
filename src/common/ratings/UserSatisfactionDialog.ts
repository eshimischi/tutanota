import { deviceConfig } from "../misc/DeviceConfig.js"
import {
	completeEvaluationStage,
	completeTriggerStage,
	createEvent,
	evaluateRatingEligibility,
	isEventHappyMoment,
	TriggerType,
} from "./UserSatisfactionUtils.js"
import { MultiPageDialog } from "../gui/dialogs/MultiPageDialog.js"
import { EvaluationPage } from "./pages/EvaluationPage.js"
import m from "mithril"
import { DateTime } from "luxon"
import { ButtonType } from "../gui/base/Button.js"
import { AndroidPlayStorePage } from "./pages/AndroidPlayStorePage.js"
import { getCurrentDate } from "../api/common/TutanotaConstants.js"
import { DissatisfactionPage } from "./pages/DissatisfactionPage.js"
import { lang } from "../misc/LanguageViewModel.js"
import { writeSupportMail } from "../../mail-app/mail/editor/MailEditor.js"
import { SupportTutaPage } from "./pages/SupportTutaPage.js"
import { isApp } from "../api/common/Env.js"
import { isEmpty } from "@tutao/tutanota-utils"

export type UserSatisfactionDialogPage = "evaluation" | "dissatisfaction" | "androidPlayStore" | "supportTuta"

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
		},
		dissatisfaction: {
			content: m(DissatisfactionPage, {
				dialog,
			}),
			leftAction: {
				label: lang.makeTranslation("", "Contact support"),
				click: () => {
					dialog.close()

					void writeSupportMail("placeholder text")
				},
				type: ButtonType.Secondary,
			},
			rightAction: {
				label: "notNow_label",
				click: () => dialog.close(),
				title: "notNow_label",
				type: ButtonType.Secondary,
			},
		},
		supportTuta: {
			content: m(SupportTutaPage, { dialog }),
			rightAction: {
				label: "notNow_label",
				type: ButtonType.Secondary,
				click: () => dialog.close(),
			},
		},
	})).getDialog()

	dialog.show()
}

/**
 * If the client is on any app (Tuta Mail or Tuta Calendar), we save the current date as an event to determine if we want to trigger a "rate Tuta" dialog.
 */
export async function handleRatingByEvent(triggerType: TriggerType) {
	if (isApp()) {
		createEvent(deviceConfig)
	}

	const disallowReasons = await evaluateRatingEligibility(getCurrentDate(), deviceConfig, isApp())

	if (!isEmpty(disallowReasons)) {
		return
	}

	if (isEventHappyMoment(getCurrentDate(), deviceConfig)) {
		showAppRatingDialog(triggerType)
	}
}
