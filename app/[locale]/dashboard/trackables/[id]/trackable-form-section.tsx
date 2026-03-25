"use client";

import { useGT } from "gt-next";
import { useTrackableDetails } from "./trackable-shell";
import { FormBuilder } from "./form-builder";
import {
	TrackablePageFrame,
	UnsupportedPageState,
} from "./components/trackable-page-frame";
import { SurveyShareDialog } from "./survey-share-dialog";

export function TrackableFormSection() {
	const gt = useGT();
	const trackable = useTrackableDetails();

	return (
		<TrackablePageFrame
			title={gt("Form Builder")}
			description={gt(
				"Build and update the public survey form shown to respondents.",
			)}
			headerActions={
				trackable.kind === "survey" && trackable.permissions.canManageForm ? (
					<SurveyShareDialog
						trackableId={trackable.id}
						activeForm={trackable.activeForm}
						shareLinks={trackable.shareSettings.shareLinks}
					/>
				) : null
			}
		>
			{trackable.kind !== "survey" ? (
				<UnsupportedPageState
					title={gt("Form builder unavailable")}
					description={gt("Only survey trackables have a form builder.")}
				/>
			) : !trackable.permissions.canManageForm ? (
				<UnsupportedPageState
					title={gt("Form builder restricted")}
					description={gt(
						"You have view access to this trackable, but only editors can change the form.",
					)}
				/>
			) : (
				<>
					<FormBuilder
						key={trackable.activeForm?.id ?? "empty-form"}
						trackableId={trackable.id}
						trackableName={trackable.name}
						trackableDescription={trackable.description}
						activeForm={trackable.activeForm}
					/>
				</>
			)}
		</TrackablePageFrame>
	);
}
