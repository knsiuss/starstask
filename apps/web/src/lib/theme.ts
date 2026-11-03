/**
 * Resolves the persisted light/dark preference before first paint.
 *
 * Kept dependency-free so the root layout can inline it in <head>; the
 * interactive toggle in `components/ui/theme-toggle` mirrors this logic.
 */
export const THEME_STORAGE_KEY = "starstask:theme";

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`;
