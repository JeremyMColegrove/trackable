import {
	Body,
	Button,
	Container,
	Head,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

export interface TrackablesVerifyEmailProps {
	name?: string;
	verificationUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
const serifFontStyle = {
	fontFamily:
		'"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
};
const sansFontStyle = {
	fontFamily:
		'"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
};

export const VerifyEmail = ({
	name,
	verificationUrl,
}: TrackablesVerifyEmailProps) => {
	return (
		<Html>
			<Head />
			<Tailwind>
				<Body className="bg-[#f6f9fc] py-2.5">
					<Preview>Welcome to Trackables</Preview>
					<Container className="bg-white border border-solid border-[#f0f0f0] p-[45px]">
						<Img
							src={`${baseUrl}/static/logo.png`}
							width="40"
							height="33"
							alt="Trackables"
						/>
						<Section>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								Hi {name},
							</Text>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								Welcome to your new Trackables account! Let's verify your email
								so you can get tracking! Click here to verify your email:
							</Text>
							<Button
								className="bg-[#000] rounded text-white text-[15px] no-underline text-center block w-[210px] py-[14px] px-[7px]"
								style={sansFontStyle}
								href={verificationUrl}
							>
								Verify email
							</Button>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								If you didn&apos;t create an account, just ignore and delete
								this message.
							</Text>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								To keep your account secure, please don&apos;t forward this
								email to anyone. See our Help Center for{" "}
								<Link className="underline" href={verificationUrl}>
									more security tips.
								</Link>
							</Text>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								Happy Tracking!
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default VerifyEmail;
