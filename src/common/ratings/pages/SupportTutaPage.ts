import m, { Children, Component, VnodeDOM } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { ImageWithOptionsDialog } from "../../gui/dialogs/ImageWithOptionsDialog.js"
import { client } from "../../misc/ClientDetector.js"
import { TranslationKeyType } from "../../misc/TranslationKey.js"
import { locator } from "../../api/main/CommonLocator.js"
import Stream from "mithril/stream"
import stream from "mithril/stream"
import { PlanType } from "../../api/common/TutanotaConstants.js"
import { showUpgradeDialog } from "../../gui/nav/NavFunctions.js"
import { windowFacade } from "../../misc/WindowFacade.js"

interface SupportTutaPageAttrs {
	dialog: Dialog
}

export class SupportTutaPage implements Component<SupportTutaPageAttrs> {
	private readonly currentPlan: Stream<PlanType | null> = stream(null)
	private dialog: Dialog | null = null

	view(): Children {
		if (!this.currentPlan()) {
			return null
		}

		return m(ImageWithOptionsDialog, {
			image: `${window.tutao.appState.prefixWithoutFile}/images/rating/rate-us-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
			titleText: "ratingSupportTuta_title",
			messageText: "emptyString_msg",
			mainActionText: this.getMainAction().langKey,
			mainActionClick: this.getMainAction().onClick,
			subActionText: this.getSubAction().langKey,
			subActionClick: this.getSubAction().onClick,
		})
	}

	private getMainAction(): { langKey: TranslationKeyType; onClick: VoidFunction } {
		switch (this.currentPlan()) {
			case PlanType.Free:
			case PlanType.Revolutionary: {
				return {
					langKey: "upgrade_action",
					onClick: () => {
						this.dialog?.close()
						void showUpgradeDialog()
					},
				}
			}
			case PlanType.Legend: {
				return {
					langKey: "referralSettings_label",
					onClick: () => {
						this.dialog?.close()
						windowFacade.openLink("/settings/referral")
					},
				}
			}
			default: {
				throw new Error("Unsupported plan type. Expected Free, Revolutionary or Legend.")
			}
		}
	}

	private getSubAction(): { langKey: TranslationKeyType; onClick: VoidFunction } {
		switch (this.currentPlan()) {
			case PlanType.Free:
			case PlanType.Legend: {
				return {
					langKey: "donate_action",
					onClick: () => {
						this.dialog?.close()
						windowFacade.openLink(`${locator.domainConfigProvider().getCurrentDomainConfig().websiteBaseUrl}/community#donate`)
					},
				}
			}
			case PlanType.Revolutionary: {
				return {
					langKey: "upgrade_action",
					onClick: () => {
						this.dialog?.close()
						windowFacade.openLink("/settings/referral")
					},
				}
			}
			default: {
				throw new Error("Unsupported plan type. Expected Free, Revolutionary or Legend.")
			}
		}
	}

	private async getCurrentPlan() {
		return await locator.logins.getUserController().getPlanType()
	}

	async oncreate(vnode: VnodeDOM<SupportTutaPageAttrs>) {
		this.currentPlan(await this.getCurrentPlan())
		this.dialog = vnode.attrs.dialog
	}
}
