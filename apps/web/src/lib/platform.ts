/**
 * Detect if the app is running on a mobile device or in a webview
 */
export function isMobile(): boolean {
	if (typeof window === "undefined") return false;

	// Check user agent for mobile devices
	const userAgent = navigator.userAgent || navigator.vendor;
	const mobileRegex =
		/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

	return mobileRegex.test(userAgent.toLowerCase());
}

/**
 * Detect if running in a webview (as opposed to a regular mobile browser)
 */
export function isWebView(): boolean {
	if (typeof window === "undefined") return false;

	const userAgent = navigator.userAgent || navigator.vendor;

	// Common webview indicators
	const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(
		userAgent,
	);
	const isAndroidWebView = /wv|Android.*Version\/[\d.]+.*Chrome/i.test(
		userAgent,
	);

	return isIOSWebView || isAndroidWebView;
}

/**
 * Check if the viewport is mobile-sized (even on desktop)
 */
export function isMobileViewport(): boolean {
	if (typeof window === "undefined") return false;
	return window.innerWidth < 768;
}

/**
 * Determine if we should show mobile UI
 * True if: mobile device OR mobile viewport OR webview
 */
export function shouldShowMobileUI(): boolean {
	return isMobile() || isWebView() || isMobileViewport();
}
