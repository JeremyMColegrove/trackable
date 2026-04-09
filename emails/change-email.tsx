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

export interface TrackablesChangeEmailProps {
	name?: string;
	confirmationUrl?: string;
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

export const ChangeEmail = ({
	name,
	confirmationUrl,
}: TrackablesChangeEmailProps) => {
	return (
		<Html>
			<Head />
			<Tailwind>
				<Body className="bg-[#f6f9fc] py-2.5">
					<Preview>Trackables reset your password</Preview>
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
								Someone recently requested an email change for your Trackables
								account. If this was you, please click here to verify this
								email:
							</Text>
							<Button
								className="bg-[#000] rounded text-white text-[15px] no-underline text-center block w-[210px] py-[14px] px-[7px]"
								style={sansFontStyle}
								href={confirmationUrl}
							>
								Verify email
							</Button>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								If you don&apos;t want to change your email or didn&apos;t
								request this, just ignore and delete this message.
							</Text>
							<Text
								className="text-base font-light text-[#404040] leading-[26px]"
								style={serifFontStyle}
							>
								To keep your account secure, please don&apos;t forward this
								email to anyone. See our Help Center for{" "}
								<Link className="underline" href={confirmationUrl}>
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

export default ChangeEmail;
