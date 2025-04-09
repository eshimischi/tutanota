import m, { Children, Component, Vnode } from "mithril"
import { Dialog } from "../../gui/base/Dialog.js"
import { Card } from "../../gui/base/Card.js"
import { LoginButton } from "../../gui/base/buttons/LoginButton.js"
import { HtmlEditor } from "../../gui/editor/HtmlEditor.js"
import { createSurveyData, createSurveyDataPostIn } from "../../api/entities/sys/TypeRefs.js"
import { locator } from "../../api/main/CommonLocator.js"
import { SurveyDataService } from "../../api/entities/sys/Services.js"

interface DissatisfactionPageAttrs {
	dialog: Dialog
}

export class DissatisfactionPage implements Component<DissatisfactionPageAttrs> {
	private htmlEditor: HtmlEditor | null = null

	oncreate(vnode: Vnode<DissatisfactionPageAttrs>): void {
		this.htmlEditor = new HtmlEditor().setMinHeight(250).setEnabled(true)

		void locator.serviceExecutor.post(
			SurveyDataService,
			createSurveyDataPostIn({
				surveyData: createSurveyData({
					version: "0",
					category: "Other",
					details: "Something",
					reason: "Something",
				}),
			}),
		)
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
				this.htmlEditor?.isEmpty() && !this.htmlEditor?.isActive() && m("span.text-editor-placeholder", "Whats on your mind?"),
				this.htmlEditor != null && m(this.htmlEditor),
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
						disabled: false,
						onclick: async () => {
							alert("hi")
						},
					}),
				),
			),
		)
	}
}
