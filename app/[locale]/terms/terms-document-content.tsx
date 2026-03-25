import { T } from "gt-next"

import type { LegalDocumentSection } from "@/components/legal-document-page"

type LegalDocumentContent = {
  effectiveDate: React.ReactNode
  sections: LegalDocumentSection[]
  title: React.ReactNode
}

export function getTermsDocumentContent(): LegalDocumentContent {
  return {
    title: <T>Terms of Service</T>,
    effectiveDate: <T>Effective date: March 18, 2026</T>,
    sections: [
      {
        heading: <T>Use of the service</T>,
        paragraphs: [
          <T key="terms-use-1">
            These Terms of Service govern access to and use of Trackables. By
            using the service, you agree to these terms.
          </T>,
          <T key="terms-use-2">
            You may use Trackables only in compliance with applicable laws and
            these terms. You are responsible for the content you create,
            collect, submit, or share through the service.
          </T>,
        ],
      },
      {
        heading: <T>Accounts</T>,
        paragraphs: [
          <T key="terms-accounts-1">
            You are responsible for maintaining the security of your account and
            any API keys issued through your account. You must notify us
            promptly if you believe your account or credentials have been
            compromised.
          </T>,
        ],
      },
      {
        heading: <T>Acceptable use</T>,
        paragraphs: [
          <T key="terms-acceptable-use-1">
            You may not use the service to violate the law, infringe the rights
            of others, interfere with the operation of the service, or attempt
            unauthorized access to data, accounts, or systems.
          </T>,
        ],
      },
      {
        heading: <T>User content</T>,
        paragraphs: [
          <T key="terms-user-content-1">
            You retain ownership of content you submit to the service. You
            grant us the limited rights necessary to host, process, store, and
            display that content for the purpose of operating and improving the
            service.
          </T>,
        ],
      },
      {
        heading: <T>Availability</T>,
        paragraphs: [
          <T key="terms-availability-1">
            We may modify, suspend, or discontinue all or part of the service
            at any time. We do not guarantee uninterrupted or error-free
            operation.
          </T>,
        ],
      },
      {
        heading: <T>Termination</T>,
        paragraphs: [
          <T key="terms-termination-1">
            We may suspend or terminate access to the service if these terms
            are violated or if use of the service creates risk for us, other
            users, or the platform.
          </T>,
        ],
      },
      {
        heading: <T>Disclaimer</T>,
        paragraphs: [
          <T key="terms-disclaimer-1">
            The service is provided &quot;as is&quot; and &quot;as available&quot;
            without warranties of any kind, whether express or implied, to the
            fullest extent permitted by law.
          </T>,
        ],
      },
      {
        heading: <T>Limitation of liability</T>,
        paragraphs: [
          <T key="terms-liability-1">
            To the fullest extent permitted by law, we are not liable for
            indirect, incidental, special, consequential, or punitive damages,
            or for loss of data, profits, or business opportunities arising
            from use of the service.
          </T>,
        ],
      },
      {
        heading: <T>Changes</T>,
        paragraphs: [
          <T key="terms-changes-1">
            We may update these terms from time to time. Continued use of the
            service after changes become effective constitutes acceptance of the
            updated terms.
          </T>,
        ],
      },
      {
        heading: <T>Contact</T>,
        paragraphs: [
          <T key="terms-contact-1">
            If you have questions about these terms, contact the service
            operator.
          </T>,
        ],
      },
    ],
  }
}
