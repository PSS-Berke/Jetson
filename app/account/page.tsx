"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "../components/PageHeader";
import { useRouter } from "next/navigation";
import { updateNotesColor } from "@/lib/api";

export default function AccountPage() {
  const { user, isLoading, refetch } = useUser();
  const { logout } = useAuth();
  const router = useRouter();
  const [notesColor, setNotesColor] = useState<string>("#000000");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync notes color with user data
  useEffect(() => {
    if (user?.notes_color) {
      setNotesColor(user.notes_color);
    } else {
      setNotesColor("#000000");
    }
  }, [user?.notes_color]);

  // Handle save button click
  const handleSave = async () => {
    // Validate hex color format
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const trimmedColor = notesColor.trim();
    
    if (!hexPattern.test(trimmedColor)) {
      setSaveError("Please enter a valid hex color (e.g., #FF5733)");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateNotesColor(trimmedColor);
      await refetch(); // Refresh user data
      setSaveSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update notes color:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save notes color. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle hex input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNotesColor(value);
    // Clear errors when user starts typing
    if (saveError) setSaveError(null);
    if (saveSuccess) setSaveSuccess(false);
  };

  // Handle color picker change
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotesColor(e.target.value);
    // Clear errors when user changes color
    if (saveError) setSaveError(null);
    if (saveSuccess) setSaveSuccess(false);
  };

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

              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-light)] mb-2">
                  Name
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-[var(--border)] rounded-lg text-[var(--text-dark)]">
                  {user?.name || "Not available"}
                </div>
              </div>

              {/* Notes Color Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-light)] mb-2">
                  Notes Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={notesColor}
                    onChange={handleColorPickerChange}
                    className="w-16 h-12 border border-[var(--border)] rounded-lg cursor-pointer"
                    disabled={isSaving}
                  />
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={notesColor}
                      onChange={handleHexInputChange}
                      className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-lg text-[var(--text-dark)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] focus:border-transparent"
                      placeholder="#000000"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      maxLength={7}
                      disabled={isSaving}
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 bg-[var(--primary-blue)] text-white rounded-lg font-medium hover:bg-[var(--dark-blue)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save</span>
                    )}
                  </button>
                </div>
                {saveError && (
                  <p className="mt-2 text-sm text-red-600">{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="mt-2 text-sm text-green-600">
                    Notes color saved successfully!
                  </p>
                )}
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
