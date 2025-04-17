//
//  Calendar.swift
//  calendar
//
//  Created by Tutao GmbH on 16.04.25.
//

import AppIntents
import TutanotaSharedFramework
import tutasdk

struct CalendarEntity: AppEntity {
	static var defaultQuery: CalendarQuery = CalendarQuery()

	var id: String
	var name: String
	var color: String

	static var typeDisplayRepresentation: TypeDisplayRepresentation = "Calendar"

	var displayRepresentation: DisplayRepresentation {
		DisplayRepresentation(title: LocalizedStringResource(stringLiteral: name))
	}

	static func fetchCalendars(_ userId: String) async throws -> [CalendarEntity] {
		TUTSLog("fetchCalendars for userId \(userId)")
		let urlSession: URLSession = makeUrlSession()

		let credentialsDb = try! CredentialsDatabase(dbPath: credentialsDatabasePath().absoluteString)
		let keychainManager = KeychainManager(keyGenerator: KeyGenerator())
		let keychainEncryption = KeychainEncryption(keychainManager: keychainManager)
		let credentialsFacade = IosNativeCredentialsFacade(keychainEncryption: keychainEncryption, credentialsDb: credentialsDb, cryptoFns: CryptoFunctions())
		let notificationStorage = NotificationStorage(userPreferencesProvider: UserPreferencesProviderImpl())
		guard let unencyptedCredentials = try await credentialsFacade.loadByUserId(userId) else { return [] }

		guard let origin = notificationStorage.sseInfo?.sseOrigin else { return [] }
		guard let encryptedPassphraseKey = unencyptedCredentials.encryptedPassphraseKey else { return [] }

		let credentials = tutasdk.Credentials(
			login: unencyptedCredentials.credentialInfo.login,
			userId: userId,
			accessToken: unencyptedCredentials.accessToken,
			encryptedPassphraseKey: encryptedPassphraseKey.data,
			credentialType: tutasdk.CredentialType.internal
		)
		let sdk = try await Sdk(baseUrl: origin, rawRestClient: SdkRestClient(urlSession: urlSession)).login(credentials: credentials)
		let calendars = await sdk.calendarFacade().getCalendarsRenderData()
		return calendars.map { calendarId, renderData in
			CalendarEntity(id: calendarId, name: renderData.name, color: renderData.color)
		}
	}
}

struct CalendarQuery: EntityQuery {
	@IntentParameterDependency<ConfigurationAppIntent>(
		\.$account
   	)
   	var config

	func entities(for identifiers: [CalendarEntity.ID]) async throws -> [CalendarEntity] {
		TUTSLog("fetch calendar entities")

		guard let userId = config?.account.id else { return [] }

		TUTSLog("WOW! Look this amazing account: \(userId)")

		return try await CalendarEntity.fetchCalendars(userId).filter { identifiers.contains($0.id) }
	}

	func suggestedEntities() async throws -> some ResultsCollection {
		TUTSLog("fetch suggested calendar entities")
		guard let userId = ConfigurationAppIntent().account?.id else { return [] as [CalendarEntity] }
		return try await CalendarEntity.fetchCalendars(userId)
	}

	func defaultResult() async -> CalendarEntity? {
		nil
	}
}
