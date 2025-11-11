import { Link, useLocation } from "react-router-dom";

export function BottomTabBar() {
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	const tabs = [
		{ path: "/", label: "Home", icon: "🏠" },
		{ path: "/chat", label: "Chat", icon: "💬" },
		{ path: "/settings", label: "Settings", icon: "⚙️" },
		{ path: "/billing", label: "Billing", icon: "💳" },
	];

	return (
		<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50">
			<div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
				{tabs.map((tab) => (
					<Link
						key={tab.path}
						to={tab.path}
						className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
							isActive(tab.path)
								? "text-blue-500"
								: "text-gray-600 hover:text-gray-800"
						}`}
					>
						<span className="text-2xl mb-1">{tab.icon}</span>
						<span className="text-xs font-medium">{tab.label}</span>
					</Link>
				))}
			</div>
		</nav>
	);
}
