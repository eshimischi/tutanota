import { TypeMapper } from "./TypeMapper"
import { CryptoMapper } from "./CryptoMapper"
import { resolveTypeReference, TypeReferenceResolver } from "../../common/EntityFunctions"
import { ClientModelParsedInstance, Entity, ServerModelParsedInstance, UntypedInstance } from "../../common/EntityTypes"
import { ModelMapper } from "./ModelMapper"
import { downcast, TypeRef } from "@tutao/tutanota-utils"
import { AesKey } from "@tutao/tutanota-crypto"
import { Nullable } from "@tutao/tutanota-utils/dist/Utils"
import { client } from "../../../misc/ClientDetector"

export class InstancePipeline {
	readonly typeMapper: TypeMapper
	readonly cryptoMapper: CryptoMapper
	readonly modelMapper: ModelMapper

	constructor(private readonly clientTypeModel: TypeReferenceResolver, private readonly serverTypeModel: TypeReferenceResolver) {
		this.typeMapper = new TypeMapper(clientTypeModel, serverTypeModel)
		this.cryptoMapper = new CryptoMapper(clientTypeModel, serverTypeModel)
		this.modelMapper = new ModelMapper(clientTypeModel, serverTypeModel)
	}

	async mapToServerAndEncrypt<T extends Entity>(
		typeRef: TypeRef<T>,
		instance: T,
		sk: Promise<Nullable<AesKey>> | Nullable<AesKey>,
	): Promise<UntypedInstance> {
		const typeModel = await resolveTypeReference(typeRef)
		const parsedInstance: ClientModelParsedInstance = await this.modelMapper.mapToClientModelParsedInstance(downcast(typeRef), instance)

		const sessionKey = sk instanceof Promise ? await sk : sk

		const encryptedParsedInstance = await this.cryptoMapper.encryptParsedInstance(typeModel, parsedInstance, sessionKey)
		return await this.typeMapper.applyDbTypes(typeModel, encryptedParsedInstance)
	}

	/**
	 * Decrypts an object literal as received from the server and maps it to an entity instance (e.g. Mail)
	 * @param model The TypeModel of the instance
	 * @param instance The object literal as received from the DB
	 * @param sk The session key, must be provided for encrypted instances
	 * @returns The decrypted and mapped instance
	 */
	async decryptAndMapToClient<T extends Entity>(typeRef: TypeRef<T>, instance: UntypedInstance, sk: AesKey | null): Promise<T> {
		const typeModel = await resolveTypeReference(typeRef)
		const encryptedParsedInstance = await this.typeMapper.applyJsTypes(typeModel, instance)
		const parsedInstance = await this.cryptoMapper.decryptParsedInstance(typeModel, encryptedParsedInstance, sk)
		return await this.modelMapper.mapToInstance(typeRef, parsedInstance)
	}
}
