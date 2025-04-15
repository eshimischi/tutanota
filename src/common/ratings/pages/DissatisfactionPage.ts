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
		return [
			m(
				".mt-l.mb-s",
				m("img.pb.block.full-width.height-100p", {
					src: `${window.tutao.appState.prefixWithoutFile}/images/leaving-wizard/other.png`,
					alt: "",
					rel: "noreferrer",
					loading: "lazy",
					decoding: "async",
				}),
			),
			m(
				".text-center",
				{
					style: {
						padding: "1em 0",
					},
				},
				[
					m(".h1", "We are all ears!"),
					m("p", { style: { margin: 0 } }, "Got feedback or facing an issue? We're here for you."),
					// m("p", "We're listening - Whether it's a bright idea or an issue.")
				],
			),
			m(Card, { shouldDivide: true, classes: ["mt"] }, [
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Bulb,
						title: "ratingSupportTuta_title", // FIXME
					},
					text: lang.makeTranslation("", "I have a suggestion"), // FIXME
					onclick: () => {
						navigate("suggestion")
					},
				}),
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Warning,
						title: "attachmentWarning_msg", // FIXME
					},
					text: lang.makeTranslation("", "I need urgent help"), // FIXME
					rightIcon: { icon: Icons.Open, title: "sendMail_label" },
					onclick: () => {
						dialog.close()
						void writeSupportMail("placeholder text") // FIXME
					},
				}),
			]),
		]
	}
}
