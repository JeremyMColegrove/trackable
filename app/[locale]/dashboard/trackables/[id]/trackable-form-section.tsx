"use client";

import { useTrackableDetails } from "./trackable-shell";
import { FormBuilder } from "./form-builder";
import {
	TrackablePageFrame,
	TrackableNarrowContent,
	TrackableSectionHeader,
	UnsupportedPageState,
} from "./components/trackable-page-frame";
import { useGT } from "gt-next";

export function TrackableFormSection() {
    const gt = useGT();
	const trackable = useTrackableDetails();

	return (
		<TrackablePageFrame
			eyebrow="Current trackable"
			title={gt("Form")}
			description={gt("Build and update the public survey form shown to respondents.")}
		>
			{trackable.kind !== "survey" ? (
				<UnsupportedPageState
					title={gt("Form builder unavailable")}
					description={gt("Only survey trackables have a form builder.")}
				/>
			) : (
				<TrackableNarrowContent>
					<TrackableSectionHeader
						title={gt("Form")}
						description={gt("Build and update the public form people use to submit responses.")}
					/>
					<FormBuilder
						key={trackable.activeForm?.id ?? "empty-form"}
						trackableId={trackable.id}
						trackableName={trackable.name}
						trackableDescription={trackable.description}
						activeForm={trackable.activeForm}
					/>
				</TrackableNarrowContent>
			)}
		</TrackablePageFrame>
	);
}
