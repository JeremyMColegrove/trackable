import { LegalDocumentPage } from "@/components/legal-document-page";
import { readLegalDocument } from "@/lib/legal-documents";
import { buildAbsoluteUrl, siteConfig } from "@/lib/site-config";
import { getGT } from "gt-node";
import type { Metadata } from "next";

const pathname = "/terms";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: `Terms of Service for ${siteConfig.name}.`,
	alternates: {
		canonical: buildAbsoluteUrl(pathname).toString(),
	},
};

export default async function TermsPage() {
	const gt = await getGT();
	const content = await readLegalDocument("terms");

	return (
		<LegalDocumentPage
			title={gt("Terms of Service") ?? "Terms of Service"}
			content={content}
		/>
	);
}
