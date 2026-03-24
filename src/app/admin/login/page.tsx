"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.push("/admin");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light text-gray-900 text-center mb-8">
          Admin Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm text-gray-600 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-gray-600 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm py-2 rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
