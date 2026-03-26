"use client";

import dashboardDarkImage from "@/images/dashboard-dark.webp";
import dashboardLightImage from "@/images/dashboard-light.webp";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

export function LandingDashboardPreview() {
	const [theme, setTheme] = useState<"dark" | string>("light");
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		if (resolvedTheme) {
			setTheme(resolvedTheme);
		}
	}, [resolvedTheme]);

	if (theme === "dark") {
		return (
			<Image
				key="dark-image"
				src={dashboardDarkImage}
				alt="Trackables dashboard preview"
				width={dashboardDarkImage.width}
				height={dashboardDarkImage.height}
				className="h-auto w-full"
				priority
			/>
		);
	}

	return (
		<Image
			key="light-image"
			src={dashboardLightImage}
			alt="Trackables dashboard preview"
			width={dashboardLightImage.width}
			height={dashboardLightImage.height}
			className="h-auto w-full"
			priority
		/>
	);

	// return resolvedTheme == '' ? <Image
	// 		src={imageAsset.src}
	// 		alt="Trackables dashboard preview"
	// 		width={imageAsset.width}
	// 		height={imageAsset.height}
	// 		className="h-auto w-full"
	// 		priority
	// 	/>
	// );
}
