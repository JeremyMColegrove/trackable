import assert from "node:assert/strict"
import test from "node:test"

import { buildSubmissionSnapshot } from "@/lib/trackable-form-submission"

test("buildSubmissionSnapshot keeps youtube fields in the form but excludes them from answers", () => {
  const result = buildSubmissionSnapshot(
    {
      id: "form-1",
      version: 1,
      title: "Demo form",
      description: null,
      status: "published",
      submitLabel: "Submit",
      successMessage: null,
      fields: [
        {
          id: "field-video",
          key: "youtube_video_1",
          kind: "youtube_video",
          label: "Watch this intro",
          description: null,
          required: false,
          position: 0,
          config: {
            kind: "youtube_video",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        },
        {
          id: "field-notes",
          key: "notes_1",
          kind: "notes",
          label: "What did you think?",
          description: null,
          required: true,
          position: 1,
          config: {
            kind: "notes",
            maxLength: 500,
          },
        },
      ],
    },
    [
      {
        fieldId: "field-video",
        value: "ignored",
      },
      {
        fieldId: "field-notes",
        value: "Helpful walkthrough",
      },
    ]
  )

  assert.equal(result.snapshot.form.fields.length, 2)
  assert.equal(result.snapshot.answers.length, 1)
  assert.deepEqual(result.answers, [
    {
      fieldId: "field-notes",
      value: {
        kind: "notes",
        value: "Helpful walkthrough",
      },
    },
  ])
})
