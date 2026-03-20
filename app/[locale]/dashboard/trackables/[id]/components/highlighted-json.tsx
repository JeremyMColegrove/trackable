import { tokenizeJson } from "../utils/usage-json-helpers";

export function HighlightedJson({ json }: { json: string }) {
	return (
		<>
			{tokenizeJson(json).map((token, index) => (
				<span key={`${index}-${token.value}`} className={token.className}>
					{token.value}
				</span>
			))}
		</>
	);
}
