import { styles } from "./styles.js"

export function responsiveCardHMargin() {
	return styles.isSingleColumnLayout() ? "mlr-s" : "mlr"
}

export function responsiveCardHPadding() {
	return styles.isSingleColumnLayout() ? "plr-s" : "plr"
}
