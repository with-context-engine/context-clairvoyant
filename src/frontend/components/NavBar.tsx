import { Link, useLocation } from "react-router-dom";

export function NavBar() {
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	const linkClass = (path: string) =>
		`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
			isActive(path)
				? "bg-blue-500 text-white"
				: "text-gray-700 hover:bg-gray-100"
		}`;

	return (
		<nav className="mb-6 border-b border-gray-200 pb-4">
			<div className="flex gap-2">
				<Link to="/" className={linkClass("/")}>
					Home
				</Link>
				<Link to="/chat" className={linkClass("/chat")}>
					Chat
				</Link>
				<Link to="/settings" className={linkClass("/settings")}>
					Settings
				</Link>
				<Link to="/billing" className={linkClass("/billing")}>
					Billing
				</Link>
			</div>
		</nav>
	);
}
