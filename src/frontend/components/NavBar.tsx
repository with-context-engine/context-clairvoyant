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
				? "bg-blue-500 text-white"
				: "text-gray-700 hover:bg-gray-100"
		}`;

	const tabs: NavTab[] = [
		{ label: "Home", path: "/", icon: () => <span /> },
		{ label: "Settings", path: "/settings", icon: () => <span /> },
		{ label: "Billing", path: "/billing", icon: () => <span /> },
	];

	return (
		<nav className="mb-6 border-b-2 border-border pb-4">
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
