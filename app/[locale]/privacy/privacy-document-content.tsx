import { T } from "gt-next"

import type { LegalDocumentSection } from "@/components/legal-document-page"

type LegalDocumentContent = {
  effectiveDate: React.ReactNode
  sections: LegalDocumentSection[]
  title: React.ReactNode
}

export function getPrivacyDocumentContent(): LegalDocumentContent {
  return {
    title: <T>Privacy Statement</T>,
    effectiveDate: <T>Effective date: March 18, 2026</T>,
    sections: [
      {
        heading: <T>Information we collect</T>,
        paragraphs: [
          <T key="privacy-collect-1">
            This Privacy Statement explains how Trackables collects, uses, and
            stores information when you use the service.
          </T>,
          <T key="privacy-collect-2">
            We may collect account information, content you create or submit,
            form responses, usage tracking events, technical metadata, and
            communications you send to us.
          </T>,
        ],
      },
      {
        heading: <T>How we use information</T>,
        paragraphs: [
          <T key="privacy-use-1">
            We use information to provide and maintain the service, authenticate
            users, process submissions, record usage activity, improve the
            product, secure the platform, and comply with legal obligations.
          </T>,
        ],
      },
      {
        heading: <T>Sharing</T>,
        paragraphs: [
          <T key="privacy-sharing-1">
            We do not sell personal information. We may share information with
            service providers that help us operate the platform, when required
            by law, or when necessary to protect rights, safety, and the
            integrity of the service.
          </T>,
        ],
      },
      {
        heading: <T>Data retention</T>,
        paragraphs: [
          <T key="privacy-retention-1">
            We retain information for as long as necessary to operate the
            service, comply with legal obligations, resolve disputes, and
            enforce agreements.
          </T>,
        ],
      },
      {
        heading: <T>Security</T>,
        paragraphs: [
          <T key="privacy-security-1">
            We use reasonable administrative, technical, and organizational
            measures to protect information, but no method of transmission or
            storage is completely secure.
          </T>,
        ],
      },
      {
        heading: <T>Your choices</T>,
        paragraphs: [
          <T key="privacy-choices-1">
            You may request access, correction, or deletion of your information
            where applicable. You may also stop using the service at any time.
          </T>,
        ],
      },
      {
        heading: <T>Children</T>,
        paragraphs: [
          <T key="privacy-children-1">
            The service is not intended for children under 13, and we do not
            knowingly collect personal information from children under 13.
          </T>,
        ],
      },
      {
        heading: <T>Changes</T>,
        paragraphs: [
          <T key="privacy-changes-1">
            We may update this Privacy Statement from time to time. Continued
            use of the service after an update becomes effective constitutes
            acceptance of the revised statement.
          </T>,
        ],
      },
      {
        heading: <T>Contact</T>,
        paragraphs: [
          <T key="privacy-contact-1">
            If you have questions about this Privacy Statement, contact the
            service operator.
          </T>,
        ],
      },
    ],
  }
}
