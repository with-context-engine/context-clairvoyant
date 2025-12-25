import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

interface SessionNoteEmailProps {
	title: string;
	summary: string;
	keyPoints: string[];
	sessionDate: string;
}

export function SessionNoteEmail({
	title,
	summary,
	keyPoints,
	sessionDate,
}: SessionNoteEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{title}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Heading style={heading}>{title}</Heading>
					<Text style={dateText}>{sessionDate}</Text>

					<Section style={section}>
						<Heading as="h2" style={subheading}>
							Summary
						</Heading>
						<Text style={paragraph}>{summary}</Text>
					</Section>

					<Hr style={hr} />

					<Section style={section}>
						<Heading as="h2" style={subheading}>
							Key Points
						</Heading>
						{keyPoints.map((point) => (
							<Text key={point} style={bulletPoint}>
								• {point}
							</Text>
						))}
					</Section>

					<Hr style={hr} />

					<Text style={replyHint}>
						💬 Reply to this email to continue the conversation
					</Text>

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
	margin: "0 0 8px",
	padding: "0",
};

const dateText = {
	fontSize: "14px",
	color: "#666666",
	margin: "0 0 24px",
	padding: "0",
};

const section = {
	margin: "0",
	padding: "0",
};

const subheading = {
	fontSize: "16px",
	fontWeight: "600",
	color: "#1a1a1a",
	margin: "0 0 12px",
	padding: "0",
};

const paragraph = {
	fontSize: "14px",
	lineHeight: "24px",
	color: "#333333",
	margin: "0",
	padding: "0",
};

const bulletPoint = {
	fontSize: "14px",
	lineHeight: "24px",
	color: "#333333",
	margin: "0 0 8px",
	padding: "0",
};

const hr = {
	borderColor: "#e6e6e6",
	margin: "24px 0",
};

const replyHint = {
	fontSize: "14px",
	color: "#666666",
	textAlign: "center" as const,
	margin: "0 0 16px",
	padding: "12px",
	backgroundColor: "#f0f7ff",
	borderRadius: "6px",
};

const footer = {
	fontSize: "12px",
	color: "#999999",
	textAlign: "center" as const,
	margin: "0",
	padding: "0",
};

export default SessionNoteEmail;
