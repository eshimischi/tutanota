import { OfflineMigration } from "../OfflineStorageMigrator.js"
import { OfflineStorage } from "../OfflineStorage.js"
import { clearDatabase } from "../StandardMigrations"

export const sys126: OfflineMigration = {
	app: "sys",
	version: 126,
	async migrate(storage: OfflineStorage) {
		await clearDatabase(storage)
	},
}
