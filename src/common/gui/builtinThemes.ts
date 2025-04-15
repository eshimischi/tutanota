/**
 * @file color/theme definitions for default themes.
 */
import { getCalendarLogoSvg, getMailLogoSvg, getTutaLogoSvg } from "./base/Logo"
import type { Theme, ThemeId } from "./theme"
import { assertMainOrNodeBoot, isApp } from "../api/common/Env"
import { client } from "../misc/ClientDetector.js"

assertMainOrNodeBoot()

/**
 * semantic colors light as defined in Figma primitives
 */
const SONNE = "#FFCB00"
/**
 * semantic colors dark as defined in Figma primitives
 */
const SONNE_70 = "#FFECB7"

/**
 *      light theme background
 */
const light_white = "#ffffff"
const grey_lighter_4 = "#f6f6f6"
const grey_lighter_3 = "#eaeaea"
const grey_lighter_2 = "#e1e1e1"
const grey_lighter_1 = "#d5d5d5"
const grey_lighter_0 = "#b8b8b8"
const grey = "#868686"
const grey_darker_0 = "#707070"
const grey_darker_1 = "#303030"
const red = "#850122"
const secondary_red = "#FF2222"
const red_nota = "#d93951"
const dunkel = "#410002"
const blue = "#003E85"
const secondary_blue = "#4282FF"
const blue_nota = "#3964d9"
const light_blue = "#ACC7FF"
const dark_purple = "#AC3E80"
const light_purple = "#FCBFDE"

/**
 *      dark theme background
 *
 *      Assuming the background is black #000000 (rgb(0,0,0)) and text is white #000000 (rgb(255, 255, 255)) and recommended opacity of 87%
 *        we get (x1 being foreground, x2 being background, x3 being result)
 *        x3 = x2 + (x1-x2)*a1 or x3 = 0 + (255 - 0) * 0.87 = 221
 *        rgb(221, 221, 221) = #DDDDDD
 *      https://stackoverflow.com/questions/12228548/finding-equivalent-color-with-opacity
 *
 */
const light_lighter_1 = "#DDDDDD"
const light_lighter_0 = "#aeaeae"
const light_grey = "#999999"
const dark_lighter_2 = "#4e4e4e"
const dark_lighter_1 = "#363636"
const dark_lighter_0 = "#232323"
const dark = "#222222"
const dark_darker_0 = "#111111"
const light_red = "#E99497"
const logo_text_bright_grey = "#c5c7c7"
const black = "#000000"

// These are constants that have been chosen because they work across themes
// This is even lighter than hover, for special cases like inactive search bar background
export const stateBgLike = "rgba(139,139,139,0.18)"
export const stateBgHover = "rgba(139,139,139,0.22)"
export const stateBgFocus = "rgba(139,139,139,0.29)"
export const stateBgActive = "rgba(139,139,139,0.38)"
export const logoDefaultGrey = logo_text_bright_grey
export const tutaRed = red
export const tutaDunkel = dunkel

type Themes = Record<ThemeId, Theme>

const getLogo = (isDark: boolean, isDefault: boolean) => {
	const isDarkOrDefault = isDark || !isDefault
	if (!isApp()) {
		return isDarkOrDefault ? getTutaLogoSvg(logo_text_bright_grey, logo_text_bright_grey) : getTutaLogoSvg(red, dunkel)
	}

	if (client.isCalendarApp()) {
		return isDarkOrDefault
			? getCalendarLogoSvg(logo_text_bright_grey, logo_text_bright_grey, logo_text_bright_grey)
			: getCalendarLogoSvg(blue, secondary_blue, black)
	}

	return isDarkOrDefault ? getMailLogoSvg(logo_text_bright_grey, logo_text_bright_grey, logo_text_bright_grey) : getMailLogoSvg(red, secondary_red, black)
}

export const themes = (): Themes => {
	const isCalendarApp = client.isCalendarApp()
	const lightRed = Object.freeze({
		themeId: !isCalendarApp ? "light" : "light_secondary",
		logo: getLogo(false, !isCalendarApp),
		// Campaign colors
		tuta_color_nota: red_nota,
		content_accent_tuta_bday: dark_purple,
		content_accent_secondary_tuta_bday: light_purple,
		content_bg_tuta_bday: dark,

		// New color tokens
		primary: red,
		on_primary: light_white,
		secondary: grey_lighter_3,
		on_secondary: grey_darker_1,
		error: SONNE,

		surface: light_white,
		surface_container: grey_lighter_4,
		on_surface_fade: grey_lighter_0,
		on_surface: grey_darker_1,
		on_surface_variant: grey_darker_0,

		// optimised until here //
		outline: grey_lighter_1,
		outline_variant: grey_lighter_3,
		shadow: grey_darker_1, // Only used for modal now, there are other box shadow definition in main-style.ts
	})
	const darkRed = Object.freeze({
		themeId: !isCalendarApp ? "dark" : "dark_secondary",
		logo: getLogo(true, !isCalendarApp),
		// Campaign colors
		tuta_color_nota: red_nota,
		content_accent_tuta_bday: light_purple,
		content_accent_secondary_tuta_bday: dark_purple,
		content_bg_tuta_bday: light_white,

		// New color tokens
		primary: light_red,
		on_primary: dark_lighter_0,
		secondary: dark_lighter_2,
		on_secondary: light_lighter_1,
		error: SONNE_70,

		surface: dark_darker_0,
		surface_container: dark_lighter_0,
		on_surface_fade: dark_lighter_2,
		on_surface: light_lighter_1,
		on_surface_variant: light_lighter_0,

		outline: dark_lighter_1,
		outline_variant: dark_lighter_1,
		shadow: dark_darker_0,
	})
	const lightBlue = Object.freeze({
		themeId: isCalendarApp ? "light" : "light_secondary",
		// blue is not really our brand color, treat blue like whitelabel color
		logo: getLogo(false, isCalendarApp),
		// Campaign colors
		tuta_color_nota: red_nota,
		content_accent_tuta_bday: dark_purple,
		content_accent_secondary_tuta_bday: light_purple,
		content_bg_tuta_bday: dark,

		// New color tokens
		primary: blue,
		on_primary: light_white,
		secondary: grey_lighter_3,
		on_secondary: grey_darker_1,
		error: SONNE,

		surface: light_white,
		surface_container: grey_lighter_4,
		on_surface_fade: grey_lighter_0,
		on_surface: grey_darker_1,
		on_surface_variant: grey_darker_0,

		outline: grey_lighter_1,
		outline_variant: grey_lighter_2,
		shadow: grey_darker_1,
	})
	const darkBlue = Object.freeze({
		themeId: isCalendarApp ? "dark" : "dark_secondary",
		logo: getLogo(true, isCalendarApp),
		// Campaign colors
		tuta_color_nota: red_nota,
		content_accent_tuta_bday: light_purple,
		content_accent_secondary_tuta_bday: dark_purple,
		content_bg_tuta_bday: light_white,

		// New color tokens
		primary: light_blue,
		on_primary: dark_lighter_0,
		secondary: dark_lighter_2,
		on_secondary: light_lighter_1,
		error: SONNE_70,

		surface: dark_darker_0,
		surface_container: dark_lighter_0,
		on_surface_fade: dark_lighter_2,
		on_surface: light_lighter_1,
		on_surface_variant: light_lighter_0,

		outline: dark_lighter_1,
		outline_variant: dark_lighter_1,
		shadow: dark_darker_0,
	})

	return {
		light: isCalendarApp ? lightBlue : lightRed,
		dark: isCalendarApp ? darkBlue : darkRed,
		light_secondary: isCalendarApp ? lightRed : lightBlue,
		dark_secondary: isCalendarApp ? darkRed : darkBlue,
	}
}
