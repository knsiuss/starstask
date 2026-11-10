package id.starstask.mobile.ui.navigation

/** Base (unparameterized) route id, e.g. "assignments?openRequest={openRequest}" -> "assignments". */
fun baseRoute(route: String?): String? = route?.substringBefore('?')
