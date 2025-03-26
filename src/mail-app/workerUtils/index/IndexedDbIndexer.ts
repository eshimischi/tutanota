import {
	ENTITY_EVENT_BATCH_TTL_DAYS,
	getMembershipGroupType,
	GroupType,
	NOTHING_INDEXED_TIMESTAMP,
	OperationType,
} from "../../../common/api/common/TutanotaConstants.js"
import { ConnectionError, NotAuthorizedError, NotFoundError } from "../../../common/api/common/error/RestError.js"
import type { EntityUpdate, GroupMembership, User } from "../../../common/api/entities/sys/TypeRefs.js"
import { EntityEventBatch, EntityEventBatchTypeRef, UserTypeRef } from "../../../common/api/entities/sys/TypeRefs.js"
import type { DatabaseEntry, DbKey, DbTransaction } from "../../../common/api/worker/search/DbFacade.js"
import { b64UserIdHash, DbFacade } from "../../../common/api/worker/search/DbFacade.js"
import { contains, daysToMillis, defer, downcast, isNotNull, millisToDays, neverNull, noOp, ofClass, promiseMap } from "@tutao/tutanota-utils"
import {
	firstBiggerThanSecond,
	GENERATED_MAX_ID,
	generatedIdToTimestamp,
	getElementId,
	isSameId,
	timestampToGeneratedId,
} from "../../../common/api/common/utils/EntityUtils.js"
import { filterIndexMemberships } from "../../../common/api/worker/search/IndexUtils.js"
import type { Db, GroupData } from "../../../common/api/worker/search/SearchTypes.js"
import { IndexingErrorReason } from "../../../common/api/worker/search/SearchTypes.js"
import { ContactIndexer } from "./ContactIndexer.js"
import { ContactList, ContactListTypeRef, ContactTypeRef } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { MailIndexer } from "./MailIndexer.js"
import { IndexerCore } from "./IndexerCore.js"
import type { EntityRestClient } from "../../../common/api/worker/rest/EntityRestClient.js"
import { OutOfSyncError } from "../../../common/api/common/error/OutOfSyncError.js"
import { DbError } from "../../../common/api/common/error/DbError.js"
import type { QueuedBatch } from "../../../common/api/worker/EventQueue.js"
import { EventQueue } from "../../../common/api/worker/EventQueue.js"
import { CancelledError } from "../../../common/api/common/error/CancelledError.js"
import { MembershipRemovedError } from "../../../common/api/common/error/MembershipRemovedError.js"
import { InvalidDatabaseStateError } from "../../../common/api/common/error/InvalidDatabaseStateError.js"
import { EntityClient } from "../../../common/api/common/EntityClient.js"
import { deleteObjectStores } from "../../../common/api/worker/utils/DbUtils.js"
import { aes256EncryptSearchIndexEntry, aes256RandomKey, AesKey, decryptKey, IV_BYTE_LENGTH, random, unauthenticatedAesDecrypt } from "@tutao/tutanota-crypto"
import { CacheInfo } from "../../../common/api/worker/facades/LoginFacade.js"
import { InfoMessageHandler } from "../../../common/gui/InfoMessageHandler.js"
import {
	ElementDataOS,
	EncryptedIndexerMetaData,
	GroupDataOS,
	Metadata,
	MetaDataOS,
	SearchIndexMetaDataOS,
	SearchIndexOS,
	SearchIndexWordsIndex,
	SearchTermSuggestionsOS,
} from "../../../common/api/worker/search/IndexTables.js"
import { KeyLoaderFacade } from "../../../common/api/worker/facades/KeyLoaderFacade.js"
import { getIndexerMetaData, updateEncryptionMetadata } from "../../../common/api/worker/facades/lazy/ConfigurationDatabase.js"
import { encryptKeyWithVersionedKey, VersionedKey } from "../../../common/api/worker/crypto/CryptoWrapper.js"
import { EntityUpdateData, entityUpdatesAsData } from "../../../common/api/common/utils/EntityUpdateUtils"
import { Indexer, IndexerInitParams } from "./Indexer"

export type InitParams = {
	user: User
	keyLoaderFacade: KeyLoaderFacade
}

const DB_VERSION: number = 3

export function newSearchIndexDB(): DbFacade {
	return new DbFacade(DB_VERSION, (event, db) => {
		if (event.oldVersion !== DB_VERSION && event.oldVersion !== 0) {
			deleteObjectStores(db, SearchIndexOS, ElementDataOS, MetaDataOS, GroupDataOS, SearchTermSuggestionsOS, SearchIndexMetaDataOS)
		}

		db.createObjectStore(SearchIndexOS, {
			autoIncrement: true,
		})
		const metaOS = db.createObjectStore(SearchIndexMetaDataOS, {
			autoIncrement: true,
			keyPath: "id",
		})
		db.createObjectStore(ElementDataOS)
		db.createObjectStore(MetaDataOS)
		db.createObjectStore(GroupDataOS)
		db.createObjectStore(SearchTermSuggestionsOS)
		metaOS.createIndex(SearchIndexWordsIndex, "word", {
			unique: true,
		})
	})
}

/**
 * Top-level orchestrator for search index.
 *  - Allows enabling/disabling mail indexing
 *  - Coordinates loading of events and dispatching of realtime events
 */
export class IndexedDbIndexer implements Indexer {
	private initDeferred = defer<void>()
	private _initParams!: InitParams

	/**
	 * Last batch id per group from initial loading.
	 * In case we get duplicate events from loading and websocket we want to filter them out to avoid processing duplicates.
	 * */
	_initiallyLoadedBatchIdsPerGroup: Map<Id, Id>

	/**
	 * Queue which gets all the websocket events and dispatches them to the other queue. It is paused until we load initial events to avoid
	 * putting events from websocket before initial events.
	 */
	_realtimeEventQueue: EventQueue
	_entity: EntityClient
	_entityRestClient: EntityRestClient
	_indexedGroupIds: Array<Id>

	private eventQueue = new EventQueue("indexer", true, (batch) => this._processEntityEvents(batch))

	constructor(
		entityRestClient: EntityRestClient,
		private db: Db,
		readonly _core: IndexerCore,
		private readonly infoMessageHandler: InfoMessageHandler,
		_entity: EntityClient,
		private readonly mailIndexer: MailIndexer,
		readonly _contactIndexer: ContactIndexer,
	) {
		// correctly initialized during init()
		this._entity = _entity
		this._entityRestClient = entityRestClient
		this._indexedGroupIds = []
		this._initiallyLoadedBatchIdsPerGroup = new Map()
		this._realtimeEventQueue = new EventQueue("indexer_realtime", false, (nextElement: QueuedBatch) => {
			// During initial loading we remember the last batch we loaded
			// so if we get updates from EventBusClient here for things that are already loaded we discard them
			const loadedIdForGroup = this._initiallyLoadedBatchIdsPerGroup.get(nextElement.groupId)

			if (loadedIdForGroup == null || firstBiggerThanSecond(nextElement.batchId, loadedIdForGroup)) {
				this.eventQueue.addBatches([nextElement])
			}

			return Promise.resolve()
		})

		this._realtimeEventQueue.pause()
	}

	/**
	 * Opens a new DbFacade and initializes the metadata if it is not there yet
	 */
	async init({ user, keyLoaderFacade, retryOnError, cacheInfo }: IndexerInitParams): Promise<void> {
		this._initParams = {
			user,
			keyLoaderFacade,
		}
		this.initDeferred = defer()

		try {
			await this.db.dbFacade.open(this.getDbId(user))
			await this.mailIndexer.init(user._id)
			const metaData = await getIndexerMetaData(this.db.dbFacade, MetaDataOS)
			if (metaData == null) {
				const userGroupKey = keyLoaderFacade.getCurrentSymUserGroupKey()
				// database was opened for the first time - create new tables
				await this.createIndexTables(user, userGroupKey)
			} else {
				const userGroupKey = await keyLoaderFacade.loadSymUserGroupKey(metaData.userGroupKeyVersion)
				await this.loadIndexTables(user, userGroupKey, metaData)
			}

			await this.infoMessageHandler.onSearchIndexStateUpdate({
				initializing: false,
				mailIndexEnabled: this.mailIndexer.mailIndexingEnabled,
				progress: 0,
				currentMailIndexTimestamp: this.mailIndexer.currentIndexTimestamp,
				aimedMailIndexTimestamp: this.mailIndexer.currentIndexTimestamp,
				indexedMailCount: 0,
				failedIndexingUpTo: null,
			})

			this._core.startProcessing()
			await this.indexOrLoadContactListIfNeeded(user, cacheInfo)
			await this.mailIndexer.mailboxIndexingPromise
			await this.mailIndexer.indexMailboxes(user, this.mailIndexer.currentIndexTimestamp)
			const groupIdToEventBatches = await this._loadPersistentGroupData(user)
			await this._loadNewEntities(groupIdToEventBatches).catch(ofClass(OutOfSyncError, (e) => this.disableMailIndexing()))
			this.initDeferred.resolve()
		} catch (e) {
			if (retryOnError !== false && (e instanceof MembershipRemovedError || e instanceof InvalidDatabaseStateError)) {
				// in case of MembershipRemovedError mail or contact group has been removed from user.
				// in case of InvalidDatabaseError no group id has been stored to the database.
				// disable mail indexing and init index again in both cases.
				// do not use this.disableMailIndexing() because db.initialized is not yet resolved.
				// initialized promise will be resolved in this.init later.
				console.log("disable mail indexing and init again", e)
				return this._reCreateIndex()
			} else {
				await this.infoMessageHandler.onSearchIndexStateUpdate({
					initializing: false,
					mailIndexEnabled: this.mailIndexer.mailIndexingEnabled,
					progress: 0,
					currentMailIndexTimestamp: this.mailIndexer.currentIndexTimestamp,
					aimedMailIndexTimestamp: this.mailIndexer.currentIndexTimestamp,
					indexedMailCount: 0,
					failedIndexingUpTo: this.mailIndexer.currentIndexTimestamp,
					error: e instanceof ConnectionError ? IndexingErrorReason.ConnectionLost : IndexingErrorReason.Unknown,
				})

				this.initDeferred.reject(e)
				throw e
			}
		}
	}

	private getDbId(user: User) {
		return b64UserIdHash(user._id)
	}

	private async indexOrLoadContactListIfNeeded(user: User, cacheInfo: CacheInfo | undefined) {
		try {
			const contactList: ContactList = await this._entity.loadRoot(ContactListTypeRef, user.userGroup.group)
			const indexTimestamp = await this._contactIndexer.getIndexTimestamp(contactList)
			if (indexTimestamp === NOTHING_INDEXED_TIMESTAMP) {
				await this._contactIndexer.indexFullContactList(contactList)
			}
			//If we do not have to index the contact list we might still need to download it so we cache it in the offline storage
			else if (cacheInfo?.isNewOfflineDb) {
				await this._entity.loadAll(ContactTypeRef, contactList.contacts)
			}
		} catch (e) {
			// external users have no contact list.
			if (!(e instanceof NotFoundError)) {
				throw e
			}
		}
	}

	enableMailIndexing(): Promise<void> {
		return this.initDeferred.promise.then(() => {
			return this.mailIndexer.enableMailIndexing(this._initParams.user).then(() => {
				// We don't have to disable mail indexing when it's stopped now
				this.mailIndexer.mailboxIndexingPromise.catch(ofClass(CancelledError, noOp))
			})
		})
	}

	async disableMailIndexing(): Promise<void> {
		await this.initDeferred.promise

		if (!this._core.isStoppedProcessing()) {
			await this.deleteIndex(this._initParams.user._id)
			await this.init({
				user: this._initParams.user,
				keyLoaderFacade: this._initParams.keyLoaderFacade,
			})
		}
	}

	async deleteIndex(userId: string): Promise<void> {
		await this.stopProcessing()
		await this.mailIndexer.disableMailIndexing()
	}

	private async stopProcessing() {
		// FIXME: have a way to wait for the current op
		// FIXME:
		this.eventQueue.pause()

		await this.eventQueue.waitForEmptyQueue()
	}

	extendMailIndex(newOldestTimestamp: number): Promise<void> {
		return this.mailIndexer.extendIndexIfNeeded(this._initParams.user, newOldestTimestamp)
	}

	cancelMailIndexing(): Promise<void> {
		return this.mailIndexer.cancelMailIndexing()
	}

	async processEntityEvents(updates: readonly EntityUpdateData[], batchId: Id, groupId: Id): Promise<void> {
		this._realtimeEventQueue.addBatches([{ events: updates, batchId, groupId }])
		this._realtimeEventQueue.resume()
	}

	startProcessing() {
		this.eventQueue.start()
	}

	async onVisibilityChanged(visible: boolean): Promise<void> {
		this._core.onVisibilityChanged(visible)
	}

	_reCreateIndex(): Promise<void> {
		const mailIndexingWasEnabled = this.mailIndexer.mailIndexingEnabled
		return this.mailIndexer.disableMailIndexing().then(() => {
			// do not try to init again on error
			return this.init({
				user: this._initParams.user,
				keyLoaderFacade: this._initParams.keyLoaderFacade,
				retryOnError: false,
			}).then(() => {
				if (mailIndexingWasEnabled) {
					return this.enableMailIndexing()
				}
			})
		})
	}

	private async createIndexTables(user: User, userGroupKey: VersionedKey): Promise<void> {
		this.db.key = aes256RandomKey()
		this.db.iv = random.generateRandomData(IV_BYTE_LENGTH)
		const groupBatches = await this._loadGroupData(user)
		const userEncDbKey = encryptKeyWithVersionedKey(userGroupKey, this.db.key)
		const transaction = await this.db.dbFacade.createTransaction(false, [MetaDataOS, GroupDataOS])
		await transaction.put(MetaDataOS, Metadata.userEncDbKey, userEncDbKey.key)
		await transaction.put(MetaDataOS, Metadata.mailIndexingEnabled, this.mailIndexer.mailIndexingEnabled)
		await transaction.put(MetaDataOS, Metadata.encDbIv, aes256EncryptSearchIndexEntry(this.db.key, this.db.iv))
		await transaction.put(MetaDataOS, Metadata.userGroupKeyVersion, userEncDbKey.encryptingKeyVersion)
		await transaction.put(MetaDataOS, Metadata.lastEventIndexTimeMs, this._entityRestClient.getRestClient().getServerTimestampMs())
		await this._initGroupData(groupBatches, transaction)
		await this._updateIndexedGroups()
	}

	private async loadIndexTables(user: User, userGroupKey: AesKey, metaData: EncryptedIndexerMetaData): Promise<void> {
		this.db.key = decryptKey(userGroupKey, metaData.userEncDbKey)
		this.db.iv = unauthenticatedAesDecrypt(this.db.key, neverNull(metaData.encDbIv), true)
		this.mailIndexer.mailIndexingEnabled = metaData.mailIndexingEnabled
		const groupDiff = await this._loadGroupDiff(user)
		await this._updateGroups(user, groupDiff)
		await this.mailIndexer.updateCurrentIndexTimestamp(user)
		await this._updateIndexedGroups()
		await this._contactIndexer.init()
	}

	async _updateIndexedGroups(): Promise<void> {
		const t: DbTransaction = await this.db.dbFacade.createTransaction(true, [GroupDataOS])
		const indexedGroupIds = await promiseMap(await t.getAll(GroupDataOS), (groupDataEntry: DatabaseEntry) => downcast<Id>(groupDataEntry.key))

		if (indexedGroupIds.length === 0) {
			// tried to index twice, this is probably not our fault
			console.log("no group ids in database, disabling indexer")
			this.disableMailIndexing()
		}

		this._indexedGroupIds = indexedGroupIds
	}

	_loadGroupDiff(user: User): Promise<{
		deletedGroups: {
			id: Id
			type: GroupType
		}[]
		newGroups: {
			id: Id
			type: GroupType
		}[]
	}> {
		let currentGroups: Array<{
			id: Id
			type: GroupType
		}> = filterIndexMemberships(user).map((m) => {
			return {
				id: m.group,
				type: getMembershipGroupType(m),
			}
		})
		return this.db.dbFacade.createTransaction(true, [GroupDataOS]).then((t) => {
			return t.getAll(GroupDataOS).then(
				(
					loadedGroups: {
						key: DbKey
						value: GroupData
					}[],
				) => {
					if (!Array.isArray(loadedGroups)) {
						throw new InvalidDatabaseStateError("loadedGroups is not an array")
					}
					let oldGroups = loadedGroups.map((group) => {
						if (typeof group?.key !== "string" || typeof group?.value?.groupType !== "string") {
							throw new InvalidDatabaseStateError(`loaded group is malformed: ${group} ${JSON.stringify(group)}`)
						}
						const id: Id = group.key
						return {
							id,
							type: group.value.groupType,
						}
					})
					let deletedGroups = oldGroups.filter((oldGroup) => !currentGroups.some((m) => m.id === oldGroup.id))
					let newGroups = currentGroups.filter((m) => !oldGroups.some((oldGroup) => m.id === oldGroup.id))
					return {
						deletedGroups,
						newGroups,
					}
				},
			)
		})
	}

	/**
	 *
	 * Initializes the index db for new groups of the user, but does not start the actual indexing for those groups.
	 * If the user was removed from a contact or mail group the function throws a CancelledError to delete the complete mail index afterwards.
	 */
	_updateGroups(
		user: User,
		groupDiff: {
			deletedGroups: {
				id: Id
				type: GroupType
			}[]
			newGroups: {
				id: Id
				type: GroupType
			}[]
		},
	): Promise<void> {
		if (groupDiff.deletedGroups.some((g) => g.type === GroupType.Mail || g.type === GroupType.Contact)) {
			return Promise.reject(new MembershipRemovedError("user has been removed from contact or mail group")) // user has been removed from a shared group
		} else if (groupDiff.newGroups.length > 0) {
			return this._loadGroupData(
				user,
				groupDiff.newGroups.map((g) => g.id),
			).then(
				(
					groupBatches: {
						groupId: Id
						groupData: GroupData
					}[],
				) => {
					return this.db.dbFacade.createTransaction(false, [GroupDataOS]).then((t) => {
						return this._initGroupData(groupBatches, t)
					})
				},
			)
		}

		return Promise.resolve()
	}

	/**
	 * Provides a GroupData object including the last 100 event batch ids for all indexed membership groups of the given user.
	 */
	_loadGroupData(
		user: User,
		restrictToTheseGroups?: Id[],
	): Promise<
		{
			groupId: Id
			groupData: GroupData
		}[]
	> {
		let memberships = filterIndexMemberships(user)
		const restrictTo = restrictToTheseGroups // type check

		if (restrictTo) {
			memberships = memberships.filter((membership) => contains(restrictTo, membership.group))
		}

		return promiseMap(memberships, (membership: GroupMembership) => {
			// we only need the latest EntityEventBatch to synchronize the index state after reconnect. The lastBatchIds are filled up to 100 with each event we receive.
			return this._entity
				.loadRange(EntityEventBatchTypeRef, membership.group, GENERATED_MAX_ID, 1, true)
				.then((eventBatches) => {
					return {
						groupId: membership.group,
						groupData: {
							lastBatchIds: eventBatches.map((eventBatch) => eventBatch._id[1]),
							indexTimestamp: NOTHING_INDEXED_TIMESTAMP,
							groupType: getMembershipGroupType(membership),
						} as GroupData,
					}
				})
				.catch(
					ofClass(NotAuthorizedError, () => {
						console.log("could not download entity updates => lost permission on list")
						return null
					}),
				)
		}) // sequentially to avoid rate limiting
			.then((data) => data.filter(isNotNull))
	}

	/**
	 * creates the initial group data for all provided group ids
	 */
	_initGroupData(
		groupBatches: {
			groupId: Id
			groupData: GroupData
		}[],
		t2: DbTransaction,
	): Promise<void> {
		for (const groupIdToLastBatchId of groupBatches) {
			t2.put(GroupDataOS, groupIdToLastBatchId.groupId, groupIdToLastBatchId.groupData)
		}
		return t2.wait()
	}

	async _loadNewEntities(
		groupIdToEventBatches: {
			groupId: Id
			eventBatchIds: Id[]
		}[],
	): Promise<void> {
		const batchesOfAllGroups: QueuedBatch[] = []
		const lastLoadedBatchIdInGroup = new Map<Id, Id>()
		const transaction = await this.db.dbFacade.createTransaction(true, [MetaDataOS])
		const lastIndexTimeMs: number | null = await transaction.get(MetaDataOS, Metadata.lastEventIndexTimeMs)
		await this._throwIfOutOfDate()

		try {
			for (let groupIdToEventBatch of groupIdToEventBatches) {
				if (groupIdToEventBatch.eventBatchIds.length > 0) {
					let startId = this._getStartIdForLoadingMissedEventBatches(groupIdToEventBatch.eventBatchIds)

					let eventBatchesOnServer: EntityEventBatch[] = []
					eventBatchesOnServer = await this._entity.loadAll(EntityEventBatchTypeRef, groupIdToEventBatch.groupId, startId)
					const batchesToQueue: QueuedBatch[] = []

					for (let batch of eventBatchesOnServer) {
						const batchId = getElementId(batch)

						if (groupIdToEventBatch.eventBatchIds.indexOf(batchId) === -1 && firstBiggerThanSecond(batchId, startId)) {
							batchesToQueue.push({
								groupId: groupIdToEventBatch.groupId,
								batchId,
								events: entityUpdatesAsData(batch.events),
							})
							const lastBatch = lastLoadedBatchIdInGroup.get(groupIdToEventBatch.groupId)

							if (lastBatch == null || firstBiggerThanSecond(batchId, lastBatch)) {
								lastLoadedBatchIdInGroup.set(groupIdToEventBatch.groupId, batchId)
							}
						}
					}

					// Good scenario: we know when we stopped, we can process events we did not process yet and catch up the server
					//
					//
					// [4, 3, 2, 1]                          - processed events, lastBatchId =1
					// load from lowest id 1 -1
					// [0.9, 1, 2, 3, 4, 5, 6, 7, 8]         - last X events from server
					// => [5, 6, 7, 8]                       - batches to queue
					//
					// Bad scenario: we don' know where we stopped, server doesn't have events to fill the gap anymore, we cannot fix the index.
					// [4, 3, 2, 1] - processed events, lastBatchId = 1
					// [7, 5, 9, 10] - last events from server
					// => [7, 5, 9, 10] - batches to queue - nothing has been processed before so we are out of sync
					// We only want to do this check for clients that haven't yet saved the index time
					// This can be removed in the future
					if (lastIndexTimeMs == null && eventBatchesOnServer.length === batchesToQueue.length) {
						// Bad scenario happened.
						// None of the events we want to process were processed before, we're too far away, stop the process and delete
						// the index.
						throw new OutOfSyncError(`We lost entity events for group ${groupIdToEventBatch.groupId}. start id was ${startId}`)
					}

					batchesOfAllGroups.push(...batchesToQueue)
				}
			}
		} catch (e) {
			if (e instanceof NotAuthorizedError) {
				console.log("could not download entity updates => lost permission on list")
				return
			}

			throw e
		}

		// add all batches of all groups in one step to avoid that just some groups are added when a ServiceUnavailableError occurs
		// Add them directly to the core so that they are added before the realtime batches
		this.eventQueue.addBatches(batchesOfAllGroups)

		// Add latest batches per group so that we can filter out overlapping realtime updates later
		this._initiallyLoadedBatchIdsPerGroup = lastLoadedBatchIdInGroup

		this._realtimeEventQueue.resume()

		this.startProcessing()
		await this._writeServerTimestamp()
	}

	_getStartIdForLoadingMissedEventBatches(lastEventBatchIds: Id[]): Id {
		let newestBatchId = lastEventBatchIds[0]
		let oldestBatchId = lastEventBatchIds[lastEventBatchIds.length - 1]
		// load all EntityEventBatches which are not older than 1 minute before the newest batch
		// to be able to get batches that were overtaken by the newest batch and therefore missed before
		let startId = timestampToGeneratedId(generatedIdToTimestamp(newestBatchId) - 1000 * 60)

		// do not load events that are older than the stored events
		if (!firstBiggerThanSecond(startId, oldestBatchId)) {
			// reduce the generated id by a millisecond in order to fetch the instance with lastBatchId, too (would throw OutOfSync, otherwise if the instance with lasBatchId is the only one in the list)
			startId = timestampToGeneratedId(generatedIdToTimestamp(oldestBatchId) - 1)
		}

		return startId
	}

	/**
	 * @private a map from group id to event batches
	 */
	_loadPersistentGroupData(user: User): Promise<
		{
			groupId: Id
			eventBatchIds: Id[]
		}[]
	> {
		return this.db.dbFacade.createTransaction(true, [GroupDataOS]).then((t) => {
			return Promise.all(
				filterIndexMemberships(user).map((membership) => {
					return t.get(GroupDataOS, membership.group).then((groupData: GroupData | null) => {
						if (groupData) {
							return {
								groupId: membership.group,
								eventBatchIds: groupData.lastBatchIds,
							}
						} else {
							throw new InvalidDatabaseStateError(
								"no group data for group " + membership.group + " indexedGroupIds: " + this._indexedGroupIds.join(","),
							)
						}
					})
				}),
			)
		})
	}

	_processEntityEvents(batch: QueuedBatch): Promise<any> {
		const { groupId, batchId, events } = batch

		return this.initDeferred.promise
			.then(async () => {
				// FIXME: this check should be elsewhere
				// if (!this.db.dbFacade.indexingSupported) {
				// 	return Promise.resolve()
				// }

				// FIXME: not sure if this should be done here, there's also another check below
				if (
					!filterIndexMemberships(this._initParams.user)
						.map((m) => m.group)
						.includes(groupId)
				) {
					return
				}

				if (!this._indexedGroupIds.includes(groupId)) {
					return
				}

				await this.mailIndexer.processEntityEvents(events, groupId, batchId)
				await this._contactIndexer.processEntityEvents(events, groupId, batchId)
				await this._core.writeGroupDataBatchId(groupId, batchId)
			})
			.catch(ofClass(CancelledError, noOp))
			.catch(
				ofClass(DbError, (e) => {
					if (this._core.isStoppedProcessing()) {
						console.log("Ignoring DBerror when indexing is disabled", e)
					} else {
						throw e
					}
				}),
			)
			.catch(
				ofClass(InvalidDatabaseStateError, (e) => {
					console.log("InvalidDatabaseStateError during _processEntityEvents")

					this.stopProcessing()

					return this._reCreateIndex()
				}),
			)
	}

	/**
	 * @VisibleForTesting
	 * @param events
	 */
	async _processUserEntityEvents(events: EntityUpdate[]): Promise<void> {
		for (const event of events) {
			if (!(event.operation === OperationType.UPDATE && isSameId(this._initParams.user._id, event.instanceId))) {
				continue
			}
			this._initParams.user = await this._entity.load(UserTypeRef, event.instanceId)
			await updateEncryptionMetadata(this.db.dbFacade, this._initParams.keyLoaderFacade, MetaDataOS)
		}
	}

	async _throwIfOutOfDate(): Promise<void> {
		const transaction = await this.db.dbFacade.createTransaction(true, [MetaDataOS])
		const lastIndexTimeMs = await transaction.get(MetaDataOS, Metadata.lastEventIndexTimeMs)

		if (lastIndexTimeMs != null) {
			const now = this._entityRestClient.getRestClient().getServerTimestampMs()

			const timeSinceLastIndex = now - lastIndexTimeMs

			if (timeSinceLastIndex >= daysToMillis(ENTITY_EVENT_BATCH_TTL_DAYS)) {
				throw new OutOfSyncError(
					`we haven't updated the index in ${millisToDays(timeSinceLastIndex)} days. last update was ${new Date(
						neverNull(lastIndexTimeMs),
					).toString()}`,
				)
			}
		}
	}

	async _writeServerTimestamp() {
		const transaction = await this.db.dbFacade.createTransaction(false, [MetaDataOS])

		const now = this._entityRestClient.getRestClient().getServerTimestampMs()

		await transaction.put(MetaDataOS, Metadata.lastEventIndexTimeMs, now)
	}
}
