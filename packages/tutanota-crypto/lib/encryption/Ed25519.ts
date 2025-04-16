export {
	default as initializeEd25519WasmModule,
	ed25519_generate_keypair as generateEd25519KeyPair,
	ed25519_sign as signWithEd25519,
	ed25519_verify as verifyEd25519Signature,
} from "../../../../tuta-sdk/rust/crypto-primitives/pkg/crypto_primitives.js"
