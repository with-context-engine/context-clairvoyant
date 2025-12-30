import ClairvoyantMobile from "./Clairvoyant";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const FEATURES = [
	{
		id: "weather",
		title: "Weather",
		image: "/illustrations/weather.png",
		description: "Get real-time weather information for any location.",
		howToUse: 'Ask "What\'s the weather in San Francisco?" or "Do I need an umbrella today?"',
		isPro: false,
	},
	{
		id: "web-search",
		title: "Web Search",
		image: "/illustrations/web_search.png",
		description: "Search the web for current events, news, and facts.",
		howToUse: 'Ask "Who won the game last night?" or "What\'s happening in tech news?"',
		isPro: true,
	},
	{
		id: "maps",
		title: "Maps / Nearby Places",
		image: "/illustrations/maps___nearby_places.png",
		description: "Find nearby businesses, restaurants, and get directions.",
		howToUse: 'Ask "Find me a coffee shop nearby" or "Where\'s the closest pharmacy?"',
		isPro: true,
	},
	{
		id: "knowledge",
		title: "Knowledge / Q&A",
		image: "/illustrations/knowledge___qanda.png",
		description: "Ask general knowledge questions and get instant answers.",
		howToUse: 'Ask "What is the capital of France?" or "How do mitochondria work?"',
		isPro: false,
	},
	{
		id: "memory-recall",
		title: "Memory Recall",
		image: "/illustrations/memory_recall.png",
		description: "Recall personal information you've previously shared.",
		howToUse: 'Ask "What\'s my sister\'s birthday?" or "What did I say about my preferences?"',
		isPro: true,
	},
	{
		id: "note-this",
		title: "Note This / Email Session",
		image: "/illustrations/note_this___email_session.png",
		description: "Save conversations as notes and email them to yourself.",
		howToUse: 'Say "Add this to a note" or "Email me this conversation"',
		isPro: true,
	},
	{
		id: "follow-up",
		title: "Follow Up / Bookmark",
		image: "/illustrations/follow_up___bookmark.png",
		description: "Bookmark topics to revisit later.",
		howToUse: 'Say "Follow up on this later" or "Bookmark this"',
		isPro: true,
	},
	{
		id: "proactive-hints",
		title: "Proactive Hints",
		image: "/illustrations/proactive_hints.png",
		description: "Get helpful hints based on your memories without asking.",
		howToUse: "Just talk naturally — Clairvoyant will chime in with relevant info from your memories.",
		isPro: true,
	},
	{
		id: "interactive-chat",
		title: "Interactive Chat",
		image: "/illustrations/interactive_chat.png",
		description: "Have back-and-forth conversations with memory context.",
		howToUse: "Have a natural conversation — Clairvoyant remembers the context and your preferences.",
		isPro: true,
	},
];

export function HomePage() {
	const freeFeatures = FEATURES.filter((f) => !f.isPro);
	const proFeatures = FEATURES.filter((f) => f.isPro);

	return (
		<div className="space-y-4 overflow-x-hidden">
			<div className="flex items-center justify-center overflow-hidden">
				<div className="scale-75 origin-center">
					<ClairvoyantMobile />
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Features</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div>
							<h3 className="font-heading text-sm mb-2">Free</h3>
							<ul className="space-y-2">
								{freeFeatures.map((feature) => (
									<li key={feature.id} className="flex items-start gap-2">
										<span className="text-main">●</span>
										<span>{feature.title}</span>
									</li>
								))}
							</ul>
						</div>
						<div>
							<h3 className="font-heading text-sm mb-2 flex items-center gap-2">
								Pro
								<span className="text-xs bg-main text-main-foreground px-2 py-0.5 rounded-base">
									Upgrade
								</span>
							</h3>
							<ul className="space-y-2">
								{proFeatures.map((feature) => (
									<li key={feature.id} className="flex items-start gap-2">
										<span className="text-main">●</span>
										<span>{feature.title}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>How to Use</CardTitle>
				</CardHeader>
				<CardContent className="px-0">
					<Accordion type="single" collapsible className="space-y-2 px-6">
						{FEATURES.map((feature) => (
							<AccordionItem key={feature.id} value={feature.id}>
								<AccordionTrigger>
									<div className="flex items-center gap-2">
										{feature.title}
										{feature.isPro && (
											<span className="text-xs bg-main text-main-foreground px-1.5 py-0.5 rounded-base">
												Pro
											</span>
										)}
									</div>
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-3">
										<img
											src={feature.image}
											alt={`${feature.title} illustration`}
											className="w-full rounded-base border-2 border-border"
										/>
										<p className="text-sm">{feature.description}</p>
										<div className="bg-main/10 p-3 rounded-base">
											<p className="text-sm font-heading">How to invoke:</p>
											<p className="text-sm">{feature.howToUse}</p>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</CardContent>
			</Card>
		</div>
	);
}
