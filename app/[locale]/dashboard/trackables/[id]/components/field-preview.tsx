import { TrackableAssetAnswer } from "@/components/trackable-asset-answer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { TrackableAssetRecord } from "@/db/schema/types"
import {
  createCheckboxOption,
  createOptionValue,
  type EditableTrackableFormField,
} from "@/lib/project-form-builder"
import { toTrackableAssetReference } from "@/lib/trackable-assets"
import { buildYouTubeEmbedUrl } from "@/lib/youtube"
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { T, useGT } from "gt-next"
import { formatFieldKind } from "../display-utils"
import {
  isCheckboxesField,
  isFileUploadField,
  isNotesField,
  isRatingField,
  isShortTextField,
  isYouTubeVideoField,
} from "../utils/form-field-utils"

export function FieldPreview({
  trackableId,
  field,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  trackableId: string
  field: EditableTrackableFormField
  index: number
  total: number
  onChange: (nextField: EditableTrackableFormField) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
}) {
  const gt = useGT()
  const [isEditing, setIsEditing] = useState(false)
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const isDisplayOnlyField =
    isYouTubeVideoField(field) || isFileUploadField(field)
  const youtubeEmbedUrl = isYouTubeVideoField(field)
    ? buildYouTubeEmbedUrl(field.config.url)
    : null

  async function handleAssetUpload(file: File | null) {
    if (!file || !isFileUploadField(field)) {
      return
    }

    setAssetUploadError(null)
    setIsUploadingAsset(true)

    try {
      const formData = new FormData()
      formData.set("trackableId", trackableId)
      formData.set("file", file)

      const response = await fetch("/api/trackable-assets", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as
        | TrackableAssetRecord
        | { error?: string }

      if (!response.ok || "error" in payload || !("id" in payload)) {
        throw new Error(
          ("error" in payload && payload.error) || "Unable to upload file."
        )
      }

      onChange({
        ...field,
        required: false,
        config: {
          ...field.config,
          asset: toTrackableAssetReference(payload),
        },
      })
    } catch (error) {
      setAssetUploadError(
        error instanceof Error ? error.message : "Unable to upload file."
      )
    } finally {
      setIsUploadingAsset(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="block text-left text-lg font-medium transition-colors hover:text-foreground/80"
              onClick={() => setIsEditing(true)}
            >
              {field.label || "Untitled field"}
            </button>
            <Badge variant="outline" className="rounded-full">
              {field.required ? gt("Required") : formatFieldKind(field.kind, gt)}
            </Badge>
          </div>
          {field.description ? (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="size-3.5" />

                <T>Edit</T>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  <T>Field</T>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>
                    <T>Label</T>
                  </Label>
                  <Input
                    value={field.label}
                    placeholder={gt("Field label")}
                    onChange={(event) =>
                      onChange({ ...field, label: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    <T>Description</T>
                  </Label>
                  <Textarea
                    value={field.description ?? ""}
                    placeholder={gt("Description")}
                    onChange={(event) =>
                      onChange({
                        ...field,
                        description: event.target.value || null,
                      })
                    }
                    className="min-h-20 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-1">
                    <Label>
                      <T>Required</T>
                    </Label>
                    {isDisplayOnlyField ? (
                      <p className="text-xs text-muted-foreground">
                        <T>Display-only fields are never required.</T>
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={field.required}
                    disabled={isDisplayOnlyField}
                    onCheckedChange={(checked) =>
                      onChange({ ...field, required: checked })
                    }
                  />
                </div>

                {isRatingField(field) ? (
                  <div className="space-y-2">
                    <Label>
                      <T>Scale</T>
                    </Label>
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      value={field.config.scale}
                      placeholder={gt("Scale")}
                      onChange={(event) =>
                        onChange({
                          ...field,
                          config: {
                            ...field.config,
                            scale: Number(event.target.value) || 3,
                          },
                        })
                      }
                    />
                  </div>
                ) : null}

                {isNotesField(field) || isShortTextField(field) ? (
                  <div className="space-y-2">
                    <Label>
                      <T>Placeholder</T>
                    </Label>
                    <Input
                      value={field.config.placeholder ?? ""}
                      placeholder={gt("Placeholder")}
                      onChange={(event) =>
                        onChange({
                          ...field,
                          config: {
                            ...field.config,
                            placeholder: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ) : null}

                {isYouTubeVideoField(field) ? (
                  <div className="space-y-2">
                    <Label>
                      <T>YouTube link</T>
                    </Label>
                    <Input
                      type="url"
                      value={field.config.url}
                      placeholder={gt("https://www.youtube.com/watch?v=...")}
                      onChange={(event) =>
                        onChange({
                          ...field,
                          required: false,
                          config: {
                            ...field.config,
                            url: event.target.value,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      <T>Paste a standard YouTube video URL to embed it.</T>
                    </p>
                  </div>
                ) : null}

                {isFileUploadField(field) ? (
                  <div className="space-y-3">
                    <Label>
                      <T>Upload file or image</T>
                    </Label>

                    {field.config.asset ? (
                      <TrackableAssetAnswer asset={field.config.asset} />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        <T>Upload a file or image to display in the survey.</T>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        type="file"
                        disabled={isUploadingAsset}
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null
                          void handleAssetUpload(nextFile)
                          event.target.value = ""
                        }}
                      />
                      {field.config.asset ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            onChange({
                              ...field,
                              required: false,
                              config: {
                                ...field.config,
                                asset: null,
                              },
                            })
                          }
                        >
                          <T>Remove file</T>
                        </Button>
                      ) : null}
                    </div>

                    {isUploadingAsset ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        <T>Uploading...</T>
                      </div>
                    ) : null}

                    {assetUploadError ? (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {assetUploadError}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isCheckboxesField(field) ? (
                  <div className="space-y-2">
                    <Label>
                      <T>Options</T>
                    </Label>
                    {field.config.options.map((option, optionIndex) => (
                      <div
                        key={option.id}
                        className="grid gap-2 md:grid-cols-[1fr_auto]"
                      >
                        <Input
                          value={option.label}
                          placeholder={`Option ${optionIndex + 1}`}
                          onChange={(event) => {
                            const nextOptions = [...field.config.options]
                            const nextLabel = event.target.value

                            nextOptions[optionIndex] = {
                              ...nextOptions[optionIndex],
                              label: nextLabel,
                              value: createOptionValue(nextLabel),
                            }

                            onChange({
                              ...field,
                              config: {
                                ...field.config,
                                options: nextOptions,
                              },
                            })
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => {
                            const nextOptions = field.config.options.filter(
                              (_, indexToKeep) => indexToKeep !== optionIndex
                            )

                            onChange({
                              ...field,
                              config: {
                                ...field.config,
                                options:
                                  nextOptions.length > 0
                                    ? nextOptions
                                    : [createCheckboxOption("Option 1")],
                              },
                            })
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onChange({
                          ...field,
                          config: {
                            ...field.config,
                            options: [
                              ...field.config.options,
                              createCheckboxOption(
                                `Option ${field.config.options.length + 1}`
                              ),
                            ],
                          },
                        })
                      }
                    >
                      <Plus className="size-4" />

                      <T>Add option</T>
                    </Button>
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {isRatingField(field) ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: field.config.scale }).map((_, indexValue) => (
            <button
              key={indexValue}
              type="button"
              disabled
              className="flex size-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
            >
              <Star className="size-4" />
            </button>
          ))}
        </div>
      ) : null}

      {isCheckboxesField(field) ? (
        <div className="space-y-2">
          {field.config.options.map((option) => (
            <label key={option.id} className="flex items-center gap-3 text-sm">
              <Checkbox disabled />
              <span>{option.label}</span>
            </label>
          ))}
          {field.config.allowOther ? (
            <label className="flex items-center gap-3 text-sm">
              <Checkbox disabled />
              <span>
                <T>Other</T>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {isNotesField(field) ? (
        <Textarea
          disabled
          className="min-h-24 resize-none"
          placeholder={field.config.placeholder ?? "Write your response..."}
        />
      ) : null}

      {isShortTextField(field) ? (
        <Input
          disabled
          placeholder={field.config.placeholder ?? "Type your answer..."}
        />
      ) : null}

      {isFileUploadField(field) ? (
        field.config.asset ? (
          <TrackableAssetAnswer asset={field.config.asset} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            <T>Upload a file or image to preview it here.</T>
          </div>
        )
      ) : null}

      {isYouTubeVideoField(field) ? (
        youtubeEmbedUrl ? (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
            <div className="aspect-video w-full">
              <iframe
                src={youtubeEmbedUrl}
                title={field.label || "Embedded YouTube video"}
                className="size-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            <T>Add a valid YouTube link to preview the embed.</T>
          </div>
        )
      ) : null}
    </div>
  )
}
