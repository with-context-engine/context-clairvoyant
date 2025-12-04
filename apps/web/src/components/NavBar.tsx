import { Brain, Home, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface NavTab {
	label: string;
	path: string;
	icon: React.ComponentType<{ className?: string }>;
}

export function NavBar() {
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	const linkClass = (path: string) =>
		`px-4 py-2 text-sm font-semibold rounded-base transition-all flex items-center justify-center gap-2 border-2 flex-1 ${
			isActive(path)
				? "bg-main text-main-foreground border-border translate-x-boxShadowX translate-y-boxShadowY shadow-shadow"
				: "bg-background text-foreground border-border hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow"
		}`;

	const tabs: NavTab[] = [
		{ path: "/", label: "Home", icon: Home },
		{ path: "/memory", label: "Memory", icon: Brain },
		{ path: "/settings", label: "Settings", icon: Settings },
	];

	return (
		<nav className="mb-6 border-b-2 border-border pb-4 safe-area-inset-top">
			<div className="flex gap-2 w-full">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<Link key={tab.path} to={tab.path} className={linkClass(tab.path)}>
							<Icon className="w-4 h-4" />
							{tab.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
