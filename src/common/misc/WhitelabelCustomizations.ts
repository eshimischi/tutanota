import type { BaseThemeId, Theme } from "../gui/theme"
import { assertMainOrNodeBoot } from "../api/common/Env"
import type { WhitelabelConfig } from "../api/entities/sys/TypeRefs.js"

assertMainOrNodeBoot()
export type ThemeCustomizations = Partial<Theme> & {
	base: BaseThemeId | null
}
export type ThemeKey = keyof Theme
export type CustomizationKey = keyof ThemeCustomizations

export type WhitelabelCustomizations = {
	theme: ThemeCustomizations | null
	germanLanguageCode: string
	registrationDomains: string[] | null
	imprintUrl: string | null
	privacyStatementUrl: string | null
}

/**
 * window.whitelabelCustomizations is defined when the user has logged in via a whitelabel domain. index.js is rewritten to have the definition
 * this happens at WhitelabelResourceRewriter.java
 */
export function getWhitelabelCustomizations(window: Window): WhitelabelCustomizations | null {
	// @ts-ignore
	return mapColorTokens(window.whitelabelCustomizations)
}

/**
 * TODO: Map over the old color tokens to the new color tokens.
 * If there are explicitly defined colours for the new tokens, they will be respected and the mapping will not be happen.
 */
function mapColorTokens(whitelabelCustomizations: WhitelabelCustomizations): WhitelabelCustomizations | null {
	if (!whitelabelCustomizations) {
		return null
	}
	return whitelabelCustomizations
}

export function getThemeCustomizations(whitelabelConfig: WhitelabelConfig): ThemeCustomizations {
	return JSON.parse(whitelabelConfig.jsonTheme, (k, v) => (k === "__proto__" ? undefined : v))
}
