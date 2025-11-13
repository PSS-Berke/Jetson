"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect authenticated users to projections page
      router.push("/projections");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // If not authenticated, the middleware should redirect to login
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  );
}
