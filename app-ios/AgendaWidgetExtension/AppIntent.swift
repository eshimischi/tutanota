//
//  AppIntent.swift
//  AgendaWidget
//
//  Created by Tutao GmbH on 15.04.25.
//

import WidgetKit
import AppIntents
import TutanotaSharedFramework

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Select an account and calendars" }
    static var description: IntentDescription { "This is an example widget." }

	@Parameter(title: "User", description: "User to load calendars from")
	var account: Credential?
}
