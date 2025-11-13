"use client";

import { useSearchParams } from "next/navigation";
import { apiExchangeMSCodeForToken } from "@/lib/services/MicrosoftService";
import { useEffect } from "react";

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const handleExchangeMSCodeForToken = async () => {
    if (code && state) {
      try {
        const response = await apiExchangeMSCodeForToken({ code, state });
        console.log(response);
      } catch (error) {
        console.error(error);
      }
    }
  };
  useEffect(() => {
    handleExchangeMSCodeForToken();
  }, [code, state]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center text-gray-600">
          <p>Please wait while we connect you to the system.</p>
          <p className="mt-2 text-sm">Connecting your microsoft account...</p>
        </div>
      </div>
    </div>
  );
}
