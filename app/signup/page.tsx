"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const { signup, isLoading, error } = useAuth();
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();

  // Redirect if not logged in or not an admin
  useEffect(() => {
    if (!userLoading && (!user || !user.admin)) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");

    try {
      await signup({ email, password, admin: isAdmin });
      setSuccessMessage("User created successfully!");
      // Reset form
      setEmail("");
      setPassword("");
      setIsAdmin(false);
    } catch {
      // Error is handled by useAuth hook
    }
  };

  // Show loading while checking auth
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render if not admin (redirect will happen)
  if (!user || !user.admin) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Create New User
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Admin only - Create new user accounts
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="newuser@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center">
              <input
                id="admin"
                name="admin"
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="admin"
                className="ml-2 block text-sm text-gray-900"
              >
                Grant admin privileges
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating user..." : "Create User"}
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
