import m, { Children, Component, VnodeDOM } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { ImageWithOptionsDialog } from "../../gui/dialogs/ImageWithOptionsDialog.js"
import { client } from "../../misc/ClientDetector.js"
import { TranslationKeyType } from "../../misc/TranslationKey.js"
import { locator } from "../../api/main/CommonLocator.js"
import { PlanType } from "../../api/common/TutanotaConstants.js"
import { showUpgradeDialog } from "../../gui/nav/NavFunctions.js"
import { windowFacade } from "../../misc/WindowFacade.js"
import { progressIcon } from "../../gui/base/Icon.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { completeSupportTutaStage, SupportTutaButtonType } from "../UserSatisfactionUtils.js"
import { px } from "../../gui/size.js"

interface SupportTutaPageAttrs {
	dialog: Dialog
}

export class SupportTutaPage implements Component<SupportTutaPageAttrs> {
	private currentPlan: PlanType | null = null
	private dialog: Dialog | null = null

	async oncreate(vnode: VnodeDOM<SupportTutaPageAttrs>) {
		this.currentPlan = await this.getCurrentPlan()
		this.dialog = vnode.attrs.dialog
		m.redraw()
	}

	view(): Children {
		if (!this.currentPlan) {
			return m(
				".full-width.full-height.flex.justify-center.items-center.flex-column",
				m(".flex-center", progressIcon()),
				m("p.m-0.mt-s.text-center", lang.getTranslationText("loading_msg")),
			)
		}

		return m(ImageWithOptionsDialog, {
			image: `${window.tutao.appState.prefixWithoutFile}/images/rating/rate-us-${client.isCalendarApp() ? "calendar" : "mail"}.png`,
			imageStyle: { maxWidth: px(300) },
			titleText: "ratingSupportTuta_title",
			messageText: "emptyString_msg",
			mainActionText: this.getMainAction().langKey,
			mainActionClick: () => {
				const mainAction = this.getMainAction()
				completeSupportTutaStage(mainAction.buttonType, this.currentPlan!)
				mainAction.onClick()
			},
			subActionText: this.getSubAction().langKey,
			subActionClick: () => {
				const subAction = this.getSubAction()
				completeSupportTutaStage(subAction.buttonType, this.currentPlan!)
				subAction.onClick()
			},
		})
	}

	private getMainAction(): Action {
		switch (this.currentPlan) {
			case PlanType.Free:
			case PlanType.Revolutionary: {
				return {
					buttonType: "Upgrade",
					langKey: "upgrade_action",
					onClick: () => {
						this.dialog?.close()
						void showUpgradeDialog()
					},
				}
			}
			case PlanType.Legend: {
				return {
					buttonType: "Refer",
					langKey: "referralSettings_label",
					onClick: () => {
						this.dialog?.close()
						m.route.set("/settings/referral")
					},
				}
			}
			default: {
				throw new Error("Unsupported plan type. Expected Free, Revolutionary or Legend.")
			}
		}
	}

	private getSubAction(): Action {
		switch (this.currentPlan) {
			case PlanType.Free:
			case PlanType.Legend: {
				return {
					buttonType: "Donate",
					langKey: "donate_action",
					onClick: () => {
						this.dialog?.close()
						windowFacade.openLink(`${locator.domainConfigProvider().getCurrentDomainConfig().websiteBaseUrl}/community#donate`)
					},
				}
			}
			case PlanType.Revolutionary: {
				return {
					buttonType: "Refer",
					langKey: "referralSettings_label",
					onClick: () => {
						this.dialog?.close()
						m.route.set("/settings/referral")
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
}

type Action = { buttonType: SupportTutaButtonType; langKey: TranslationKeyType; onClick: VoidFunction }
