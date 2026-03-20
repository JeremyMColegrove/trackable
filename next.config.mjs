import { withGTConfig } from "gt-next/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "standalone",
};

export default withGTConfig(nextConfig);
