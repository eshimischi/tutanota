import { AssociationType, Cardinality, Type, ValueType } from "./EntityConstants.js"
import { TypeRef } from "@tutao/tutanota-utils"
import type { BlobElement, Element, ListElement } from "./utils/EntityUtils.js"
import { Nullable } from "@tutao/tutanota-utils/dist/Utils"
import { AppName } from "@tutao/tutanota-utils/dist/TypeRef"
import { BucketKey } from "../entities/sys/TypeRefs"
import { ClientModels } from "./EntityFunctions"

/**
 * Tuta Metamodel Entity Types
 *
 * this file contains some types that are used to define the communication between the server and the client and the
 * general structure of the objects a tuta application uses to represent user data.
 * Objects defined using the meta-model are compiled to the application model - the result corresponds to the types that
 * appear in the business logic and the communication between server and client.
 *
 * Since an app is expected to change over time, the meta-model includes the concept of a model version.
 * Data in one version of the model can be migrated to conform to the model in an older or newer version of the same
 * model.
 *
 * * each meta-model object has a [name:string / id:number] pair
 * * each object defined using the meta-model can be thought of having an address of the form
 *   * app-name for apps. (Apps also have a model version as explained above)
 *   * app-name/type-id for compound types (this is what is known as a TypeRef)
 *   * app-name/type-id/attribute-id for fields on a type. this is where the actual data lives.
 * * the ids are there to ensure it's possible to address the objects in case the human-friendly name changes.
 *
 *
 * during communication with the server, the instances go through the instance pipeline
 * which encrypts and serializes or decrypts and deserializes them.
 * the model information is gradually stripped until just the relatively unstructured wire format is left.
 * the wire format is not self-documenting, so to be used, received data has to be
 * combined with the type model describing its structure - most importantly type, cardinality and confidentiality of the
 * fields.
 */

// // //
//
// Metamodel Types - used to define the actual Model Types detailed below.
//
// // //

export type AttributeId = number
export type TypeId = number
export type AttributeName = string

/**
 * scalar fields on types in the model
 * these are currently never of Cardinality.Any
 */
export type ModelValue = {
	/* unique Id of the field in the model */
	id: AttributeId
	/* human-readable name */
	name: AttributeName
	/* the basic data type contained in the field*/
	type: Values<typeof ValueType>
	/* how many values can be assigned to the field */
	cardinality: Values<typeof Cardinality>
	/* whether the client is allowed to update the field */
	final: boolean
	/* whether the field should be encrypted with the containing types session key before being sent to the server. */
	encrypted: boolean
}

/**
 * metamodel representation of an association between types in the model.
 *
 * these are also fields on types in the model like ModelValue, but
 * * they can be of any cardinality
 * * they always reference another compound type defined in the model, so they're never just a basic type like a Date.
 */
export type ModelAssociation = {
	/* unique Id of the association in the model */
	id: AttributeId
	/* human-readable name */
	name: AttributeName
	/** if this is a reference or an aggregate. this determines the runtime representation of the containing type. */
	type: Values<typeof AssociationType>
	/** how many values can be assigned to the field */
	cardinality: Values<typeof Cardinality>
	/* the ID of the type of the values that this field contains */
	refTypeId: number
	/* whether the client is allowed to update the field */
	final: boolean
	/**
	 * From which model we import this association from. Currently,
	 * the field only exists for aggregates because they are only ones
	 * which can be imported across models.
	 */
	dependency?: AppName | null
}

/**
 * this type models how the main entity types in the model are defined.
 */
export type TypeModel = {
	/* unique Id of the type in the model */
	id: TypeId
	/** model version of the app the type first appeared in */
	since: number
	/**
	 * the top-level container for related types this type belongs in.
	 * it's mostly there to bundle related types and to
	 * make it harder to use types across applications.
	 */
	app: AppName
	/**
	 * the model version this type is defined in.
	 */
	version: string
	/** human-readable name */
	name: string
	/** the type of entity. this defines how (and if) the type is persisted. */
	type: Values<typeof Type>
	/** unused legacy field */
	versioned: boolean
	/** whether the type contains encrypted values */
	encrypted: boolean
	rootId: Id
	/** a map of scalar fields. the record keys are the ModelValue.id field of the record values */
	values: Record<AttributeId, ModelValue>
	/** a map of scalar fields. the record keys are the ModelAssociation.id field of the record values */
	associations: Record<AttributeId, ModelAssociation>
}

/**
 * Untyped Instance Stage - this is the result of deserializing a wire format representation of an entity instance.
 * it does not conform to a specific model type yet.
 */

/*
 * at this stage, all values are encoded as strings or not present.
 */
export type UntypedValue = Nullable<string>

/**
 * the server sends the values of associations as arrays, the cardinality is checked just
 * before the actual instance is assembled for use by the business logic.
 */
export type UntypedAssociation =
	/** reference(s) to an ElementEntity instance or a list of ListElementEntity instances */
	| Array<Id>
	/** reference(s) to a specific ListElementEntity instance */
	| Array<IdTuple>
	/** compound AggregatedEntity instance(s) defined directly in its parent */
	| Array<UntypedInstance>

/**
 * Compound values. the keys are Attribu
 */
export type UntypedInstance = Record<string, UntypedValue | UntypedAssociation>

/**
 * ParsedInstance stage. This exists in an encrypted and an unencrypted version.
 *
 * here the field values already conform to their types defined in the type model of the containing
 * entity.
 */

/** simple number separator to distinguish between ClientModelParsedInstance and ServerModelParsedInstance */
export type ClientModelTypeSeparator = 1

/** simple number separator to distinguish between ServerModelParsedInstance and ClientModelParsedInstance */
export type ServerModelTypeSeparator = 2

export type EncryptedParsedValue =
	| Id // element association or list association or _id
	| IdTuple // list element association
	| boolean // unencrypted
	| Date // unencrypted
	| number // unencrypted
	| string // unencrypted
	| Uint8Array // Either Bytes or encrypted value fixme: is this rather Base64

export type ClientModelEncryptedParsedAssociation =
	| Array<Id> // element references / list references
	| Array<IdTuple> // list element ref, card any
	| Array<ClientModelEncryptedParsedInstance> // aggregate

export type ServerModelEncryptedParsedAssociation =
	| Array<Id> // element references / list references
	| Array<IdTuple> // list element ref, card any
	| Array<ServerModelEncryptedParsedInstance> // aggregate

// this contains client model JS values except in encrypted fields, those are kept as a base64 string.
export type ClientModelEncryptedParsedInstance = Record<AttributeId, Nullable<EncryptedParsedValue> | ClientModelEncryptedParsedAssociation>

// this contains server model JS values except in encrypted fields, those are kept as a base64 string.
export type ServerModelEncryptedParsedInstance = Record<AttributeId, Nullable<EncryptedParsedValue> | ServerModelEncryptedParsedAssociation>

/** only defined here for documentation purposes */
export type ParsedValue = EncryptedParsedValue
/** only defined here for documentation purposes */
export type ParsedAssociation = ClientModelEncryptedParsedAssociation | ServerModelEncryptedParsedAssociation

/** a client model parsed instance after before going through encryption */
export type ClientModelParsedInstance = Record<AttributeId, Nullable<ParsedValue> | ParsedAssociation> &
	ClientModelTypeSeparator & {
		/** crypto errors that happened during serialization are stored here for debugging purposes */
		_errors?: Record<AttributeId, string>
		/** the ivs used to encrypt final fields on the instance */
		_finalIvs: Record<AttributeId, Nullable<Uint8Array>>
	}

/** a server model parsed instance after going through decryption */
export type ServerModelParsedInstance = Record<AttributeId, Nullable<ParsedValue> | ParsedAssociation> &
	ServerModelTypeSeparator & {
		/** crypto errors that happened during deserialization are stored here for debugging purposes */
		_errors?: Record<AttributeId, string>
		/** the ivs used to encrypt final fields on the instance */
		_finalIvs: Record<AttributeId, Nullable<Uint8Array>>
	}

// // //
//
// Model Types
//
// // //

/**
 * representation of an instance of a type defined in the model.
 * this interface is the bare minimum, actual entities need more fields in order to be useful.
 * these are added by defining ModelValues and ModelAssociations on the TypeModel.
 */
export interface Entity {
	/** the address of the TypeModel this entity conforms to. */
	_type: TypeRef<this>
	_finalIvs?: Record<number, Nullable<Uint8Array>>
	bucketKey?: null | BucketKey
	_ownerGroup?: null | Id
	_ownerEncSessionKey?: null | Uint8Array
	_ownerKeyVersion?: null | NumberString
	ownerEncSessionKey?: null | Uint8Array
	ownerEncSessionKeyVersion?: null | NumberString
	_permissions?: null | Id
	isAdapter?: boolean
}

/**
 * Entity types with instances that stand on their own, not being part of a list
 */
export interface ElementEntity extends Entity, Element {}

/**
 * Entity types with instances that are part of a list
 */
export interface ListElementEntity extends Entity, ListElement {}

/**
 * Entity types that are stored in an immutable blob storage
 */
export interface BlobElementEntity extends Entity, BlobElement {}

export type SomeEntity = ElementEntity | ListElementEntity | BlobElementEntity
