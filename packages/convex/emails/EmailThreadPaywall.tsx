import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

interface EmailThreadPaywallEmailProps {
	checkoutUrl: string;
	limit: number;
}

export function EmailThreadPaywallEmail({
	checkoutUrl,
	limit,
}: EmailThreadPaywallEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Your Clairvoyant email thread limit was reached</Preview>
			<Body style={main}>
				<Container style={container}>
					<Heading style={heading}>Email Thread Limit Reached</Heading>

					<Section>
						<Text style={paragraph}>
							You have reached your free monthly limit of {limit} email thread
							messages.
						</Text>
						<Text style={paragraph}>
							Subscribe to continue receiving threaded email responses.
						</Text>
					</Section>

					<Hr style={hr} />

					<Section style={buttonContainer}>
						<Button href={checkoutUrl} style={button}>
							Upgrade Email Threads
						</Button>
					</Section>

					<Hr style={hr} />

					<Text style={footer}>Sent by Clairvoyant</Text>
				</Container>
			</Body>
		</Html>
	);
}

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "40px 20px",
	maxWidth: "560px",
	borderRadius: "8px",
};

const heading = {
	fontSize: "24px",
	fontWeight: "600",
	color: "#1a1a1a",
	margin: "0 0 24px",
	padding: "0",
};

const paragraph = {
	fontSize: "14px",
	lineHeight: "24px",
	color: "#333333",
	margin: "0 0 16px",
	padding: "0",
};

const hr = {
	borderColor: "#e6e6e6",
	margin: "24px 0",
};

const buttonContainer = {
	textAlign: "center" as const,
};

const button = {
	backgroundColor: "#1a1a1a",
	borderRadius: "6px",
	color: "#ffffff",
	fontSize: "16px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "inline-block",
	padding: "12px 24px",
};

const footer = {
	fontSize: "12px",
	color: "#999999",
	textAlign: "center" as const,
	margin: "0",
	padding: "0",
};

export default EmailThreadPaywallEmail;
