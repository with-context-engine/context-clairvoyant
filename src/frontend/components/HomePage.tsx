export function HomePage() {
	return (
		<div>
			<h2>Welcome to Clairvoyant</h2>
			<p className="text-gray-600">
				Voice-powered AI assistant for your smart glasses.
			</p>

			<div className="mt-6 p-5 border-2 border-gray-200 rounded-lg bg-gray-50">
				<h3 className="mt-0">Features</h3>
				<ul className="list-disc list-inside space-y-2 text-gray-700">
					<li>Real-time weather information</li>
					<li>Web search capabilities</li>
					<li>Location-based services</li>
					<li>Personalized preferences</li>
				</ul>
			</div>

			<div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
				<p className="text-sm text-blue-800">
					💡 <strong>Tip:</strong> Use the Settings page to customize your
					weather unit preference (Celsius or Fahrenheit).
				</p>
			</div>
		</div>
	);
}
