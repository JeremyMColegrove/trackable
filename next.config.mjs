import { withGTConfig } from "gt-next/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
	env: {
		ENABLE_SUBSCRIPTIONS: process.env.ENABLE_SUBSCRIPTIONS,
	},
	output: "standalone",
};

export default withGTConfig(nextConfig);
