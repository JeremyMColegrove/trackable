import { LegalDocumentPage } from "@/components/legal-document-page";
import { readLegalDocument } from "@/lib/legal-documents";
import { buildAbsoluteUrl, siteConfig } from "@/lib/site-config";
import { getGT } from "gt-node";
import type { Metadata } from "next";

const pathname = "/privacy";

export const metadata: Metadata = {
	title: "Privacy Statement",
	description: `Privacy Statement for ${siteConfig.name}.`,
	alternates: {
		canonical: buildAbsoluteUrl(pathname).toString(),
	},
};

export default async function PrivacyPage() {
	const gt = await getGT();
	const content = await readLegalDocument("privacy");

	return (
		<LegalDocumentPage
			title={gt("Privacy Statement") ?? "Privacy Statement"}
			content={content}
		/>
	);
}
