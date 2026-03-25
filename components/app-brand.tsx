"use client";

import iosSmallIcon from "@/images/ios/AppIcon-20@3x.png";
import { T, useGT } from "gt-next";
import Image from "next/image";
import Link from "next/link";

type AppBrandProps = {
	href?: string;
	className?: string;
	collapseTextOnMobile?: boolean;
};

export function AppBrand({
	href = "/",
	className = "text-lg font-bold tracking-tighter",
	collapseTextOnMobile = false,
}: AppBrandProps) {
	const gt = useGT();
	return (
		<Link href={href} className={`flex items-center gap-2 ${className}`}>
			<Image
				src={iosSmallIcon}
				alt={gt("Trackable logo")}
				width={24}
				height={24}
				className="h-6 w-6 rounded-sm"
				priority
			/>
			<span className={collapseTextOnMobile ? "hidden sm:inline" : undefined}>
				<T>Trackable.</T>
			</span>
		</Link>
	);
}
