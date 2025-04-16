import { assertWorkerOrNode } from "../../common/Env.js"
import { signWithEd25519, generateEd25519KeyPair, verifyEd25519Signature, initializeEd25519WasmModule } from "@tutao/tutanota-crypto"

assertWorkerOrNode()

/**
 * due to wasm generating number: [] from crypto-primitive crate
 * which api is responsible for converting those number arrays
 * tutanota-crypto or this facade ?
 *
 * should we find a way to export directly uint8array from rust?
 */

export type Ed25519PublicKey = Uint8Array
export type Ed25519PrivateKey = Uint8Array

export type SigningKeyPair = Ed25519KeyPair
export type SigningPublicKey = Ed25519PublicKey

export type Ed25519Signature = Uint8Array

export type Ed25519KeyPair = {
	publicKey: Uint8Array
	privateKey: Uint8Array
}

/**
 * Implementation of EdDSA based on Ed25519.
 */
export class Ed25519Facade {
	private initialized = false

	private async initialize() {
		if (!this.initialized) {
			await initializeEd25519WasmModule()
			this.initialized = true
		}
	}

	async generateKeypair(): Promise<Ed25519KeyPair> {
		await this.initialize()
		let generated = generateEd25519KeyPair()
		return {
			publicKey: new Uint8Array(generated.public_key),
			privateKey: new Uint8Array(generated.private_key),
		}
	}

	async sign(privateKey: Ed25519PrivateKey, message: Uint8Array): Promise<Ed25519Signature> {
		await this.initialize()
		return new Uint8Array(signWithEd25519([...privateKey], message))
	}

	async verify(publicKey: Ed25519PublicKey, message: Uint8Array, signature: Ed25519Signature): Promise<boolean> {
		await this.initialize()
		return verifyEd25519Signature([...publicKey], message, [...signature])
	}
}
