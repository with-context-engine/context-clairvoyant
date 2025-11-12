import { CreditCard, Home, MessageSquare, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function BottomTabBar() {
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	const tabs = [
		{ path: "/", label: "Home", icon: Home },
		{ path: "/chat", label: "Chat", icon: MessageSquare },
		{ path: "/settings", label: "Settings", icon: Settings },
		{ path: "/billing", label: "Billing", icon: CreditCard },
	];

	return (
		<nav className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border safe-area-inset-bottom z-50">
			<div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<Link
							key={tab.path}
							to={tab.path}
							className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
								isActive(tab.path)
									? "text-main"
									: "text-foreground/60 hover:text-foreground"
							}`}
						>
							<Icon className="w-6 h-6 mb-1" />
							<span className="text-xs font-medium">{tab.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
