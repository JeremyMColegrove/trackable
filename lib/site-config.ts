const defaultSiteUrl = "https://trackables.org";

function normalizeSiteUrl(url: string) {
	if (/^https?:\/\//i.test(url)) {
		return url;
	}

	return `https://${url}`;
}

export const siteConfig = {
	name: "Trackables",
	title: "Trackables",
	description:
		"Create a trackable item, collect form responses or API usage events, and review everything in one place.",
	homeTitle: "Trackables: Forms, responses, and API usage tracking",
	homeHeading: "Forms, responses, and API usage in one place.",
	homeSummary:
		"Create one trackable item, choose how it collects data, and review every submission or usage event in one dashboard.",
	githubUrl: "https://github.com/JeremyMColegrove/trackables",
	securityContactEmail:
		process.env.SECURITY_CONTACT_EMAIL ??
		process.env.NEXT_PUBLIC_SECURITY_CONTACT_EMAIL ??
		null,
	securityContactUrl:
		process.env.SECURITY_CONTACT_URL ??
		"https://github.com/JeremyMColegrove/trackable/issues",
	securityPolicyUrl: process.env.SECURITY_POLICY_URL ?? null,
};

export function getSiteUrl() {
	const configuredUrl =
		process.env.NEXT_PUBLIC_APP_URL ??
		process.env.NEXT_PUBLIC_SITE_URL ??
		process.env.SITE_URL;

	try {
		return new URL(
			configuredUrl ? normalizeSiteUrl(configuredUrl) : defaultSiteUrl,
		);
	} catch {
		return new URL(defaultSiteUrl);
	}
}

export function buildAbsoluteUrl(pathname: string) {
	return new URL(pathname, getSiteUrl());
}
