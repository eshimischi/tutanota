import m, { Children, Component, Vnode } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { SectionButton } from "../../gui/base/buttons/SectionButton.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { UserSatisfactionDialogPage } from "../UserSatisfactionDialog.js"
import { writeSupportMail } from "../../../mail-app/mail/editor/MailEditor.js"
import { Icons } from "../../gui/base/icons/Icons.js"

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
				".text-center.h1",
				{
					style: {
						padding: "1em 0",
					},
				},
				"We are all ears!",
			),
			m("section", [
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Bell,
						title: "ratingSupportTuta_title", // TODO
					},
					text: lang.makeTranslation("", "Give suggestion"),
					onclick: () => {
						navigate("suggestion")
					},
				}),
				m(SectionButton, {
					leftIcon: {
						icon: Icons.Warning,
						title: "attachmentWarning_msg", // TODO
					},
					text: lang.makeTranslation("", "Need urgent help"),
					onclick: () => {
						dialog.close()
						void writeSupportMail("placeholder text")
					},
				}),
			]),
		]
	}
}
