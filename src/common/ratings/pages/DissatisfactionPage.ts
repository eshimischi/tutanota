import m, { Children, Component, Vnode } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { Card } from "../../gui/base/Card.js"
import { LoginButton } from "../../gui/base/buttons/LoginButton.js"
import { createSurveyData, createSurveyDataPostIn } from "../../api/entities/sys/TypeRefs.js"
import { locator } from "../../api/main/CommonLocator.js"
import { showProgressDialog } from "../../gui/dialogs/ProgressDialog.js"
import { SurveyService } from "../../api/entities/sys/Services.js"
import { px } from "../../gui/size.js"

interface DissatisfactionPageAttrs {
	dialog: Dialog
}

export class DissatisfactionPage implements Component<DissatisfactionPageAttrs> {
	private dialog: Dialog | null = null
	private textFieldInput: string = ""

	oncreate(vnode: Vnode<DissatisfactionPageAttrs>): void {
		this.dialog = vnode.attrs.dialog
	}

	view({ attrs: { dialog } }: Vnode<DissatisfactionPageAttrs>): Children {
		return m(
			".flex.flex-column.pt.height-100p.gap-vpad",
			m(Card, m("", m("p.h4.m-0", "Tell us why"), m("p.m-0.mt-s", "lorem ipsum dolor sit amet"))),
			m(
				Card,
				{
					classes: ["child-text-editor", "rel", "height-100p"],
					style: {
						padding: "0",
					},
				},
				m(SimpleTextEditor, {
					oninput: (text) => {
						this.textFieldInput = text
					},
				}),
			),
			m(
				".flex.flex-column.gap-vpad.pb",
				{
					style: {
						marginTop: "auto",
					},
				},
				m(
					".align-self-center.full-width",
					m(LoginButton, {
						label: "send_action",
						disabled: this.textFieldInput.trim() === "",
						onclick: () => void this.onSendButtonClick(),
					}),
				),
			),
		)
	}

	private async onSendButtonClick() {
		const send = async () => {
			await locator.serviceExecutor.post(
				SurveyService,
				createSurveyDataPostIn({
					surveyData: createSurveyData({
						version: "0",
						category: "4", // 4 == "Other"
						details: this.textFieldInput,
						reason: "33", // 33 == "Provide details"
						type: `${SurveyDataType.SATISFACTION_EVALUATION}`,
					}),
				}),
			)
		}

		await showProgressDialog("sendingEvaluation_msg", send())

		this.dialog?.close()
	}
}

interface SimpleTextEditorAttrs {
	oninput: (value: string) => void
}

class SimpleTextEditor implements Component<SimpleTextEditorAttrs> {
	view(vnode: Vnode<SimpleTextEditorAttrs>) {
		return m("textarea.tutaui-text-field", {
			style: { "field-sizing": "content", resize: "none", "min-height": px(250) },
			placeholder: "What's wrong?",
			oninput: (event: InputEvent) => {
				const target = event.target
				vnode.attrs.oninput(target ? (target as HTMLTextAreaElement).value : "")
			},
		})
	}
}

export enum SurveyDataType {
	DOWNGRADE = 0,
	DELETE = 1,
	TERMINATION = 2, // used when terminating from the website form.
	SATISFACTION_EVALUATION = 3,
}
