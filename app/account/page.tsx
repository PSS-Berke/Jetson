"use client";

import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "../components/PageHeader";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user, isLoading } = useUser();
  const { logout } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    router.push("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <PageHeader user={user} showAddJobButton={false} onLogout={logout} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-blue)] mx-auto"></div>
            <p className="mt-4 text-[var(--text-light)]">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PageHeader user={user} showAddJobButton={false} onLogout={logout} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--dark-blue)] mb-2">
            Account Settings
          </h1>
          <p className="text-[var(--text-light)]">
            Manage your account information and preferences
          </p>
        </div>

        {/* Account Information Card */}
        <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
          {/* Card Header */}
          <div className="bg-gray-50 border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-xl font-semibold text-[var(--text-dark)]">
              Account Information
            </h2>
          </div>

          {/* Card Content */}
          <div className="px-6 py-6">
            <div className="space-y-6">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-light)] mb-2">
                  Email Address
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 bg-gray-50 border border-[var(--border)] rounded-lg text-[var(--text-dark)]">
                    {user?.email || "Not available"}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Verified</span>
                  </div>
                </div>
              </div>

              {/* User ID Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-light)] mb-2">
                  User ID
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-[var(--border)] rounded-lg text-[var(--text-dark)] font-mono text-sm">
                  {user?.id || "Not available"}
                </div>
              </div>

              {/* Account Type Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-light)] mb-2">
                  Account Type
                </label>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-3 bg-gray-50 border border-[var(--border)] rounded-lg text-[var(--text-dark)]">
                    {user?.admin ? "Administrator" : "Standard User"}
                  </div>
                  {user?.admin && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Admin Access</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information Note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Need to update your information?
              </h3>
              <p className="text-sm text-blue-700">
                Contact your system administrator to make changes to your email
                address or account permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
