import m, { Children, Component, Vnode } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { SectionButton } from "../../gui/base/buttons/SectionButton.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { UserSatisfactionDialogPage } from "../UserSatisfactionDialog.js"
import { writeSupportMail } from "../../../mail-app/mail/editor/MailEditor.js"
import { Icons } from "../../gui/base/icons/Icons.js"
import { Card } from "../../gui/base/Card.js"

interface DissatisfactionPageAttrs {
	dialog: Dialog
	navigate: (page: UserSatisfactionDialogPage) => void
}

export class DissatisfactionPage implements Component<DissatisfactionPageAttrs> {
	private dialog: Dialog | null = null

	oncreate(vnode: Vnode<DissatisfactionPageAttrs>): void {
		this.dialog = vnode.attrs.dialog
	}

	view({ attrs: { dialog, navigate } }: Vnode<DissatisfactionPageAttrs>): Children {
		return m(
			"div.flex.flex-column.height-100p.gap-vpad",
			{
				style: {
					padding: "1em 0",
				},
			},
			m("img.pb.block.full-width", {
				src: `${window.tutao.appState.prefixWithoutFile}/images/leaving-wizard/other.png`,
				alt: "",
				rel: "noreferrer",
				loading: "lazy",
				decoding: "async",
			}),
			m(
				".text-center",
				{
					style: {
						padding: "1em 0",
					},
				},
				[m(".h1", lang.get("ratingDissatisfied_title")), m("p", { style: { margin: 0 } }, lang.get("ratingDissatisfied_msg"))],
			),
			m(Card, { shouldDivide: true, classes: ["mt-auto"] }, [
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Bulb,
						title: "ratingSuggestion_label",
					},
					text: "ratingSuggestion_label",
					onclick: () => {
						navigate("suggestion")
					},
				}),
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Warning,
						title: "ratingNeedUrgentHelp_label",
					},
					text: "ratingNeedUrgentHelp_label",
					rightIcon: { icon: Icons.Open, title: "sendMail_label" },
					onclick: () => {
						dialog.close()
						void writeSupportMail("")
					},
				}),
			]),
		)
	}
}
