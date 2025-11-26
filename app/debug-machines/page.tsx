"use client";

import { useState } from "react";

export default function DebugMachinesPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMachines = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth_token="))
        ?.split("=")[1];

      if (!token) {
        throw new Error("No auth token found");
      }

      const response = await fetch(
        "https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb/machines",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(JSON.stringify(data, null, 2));
        return;
      }

      // Analyze the data
      const analysis = {
        total: data.length,
        withProcessType: data.filter(
          (m: any) => m.process_type_key && m.process_type_key.trim() !== ""
        ).length,
        withoutProcessType: data.filter(
          (m: any) => !m.process_type_key || m.process_type_key.trim() === ""
        ).length,
        uniqueProcessTypes: Array.from(
          new Set(
            data
              .map((m: any) => m.process_type_key)
              .filter((k: any) => k && k.trim() !== "")
          )
        ).sort(),
        machinesWithoutProcessType: data
          .filter(
            (m: any) => !m.process_type_key || m.process_type_key.trim() === ""
          )
          .map((m: any) => ({
            id: m.id,
            line: m.line,
            name: m.name,
            type: m.type,
            process_type_key: m.process_type_key,
          })),
        machinesWithWeirdProcessTypes: data
          .filter((m: any) => {
            const key = m.process_type_key?.toLowerCase() || "";
            return (
              key &&
              !["insert", "fold", "affix", "inkjet", "hppress", "laser", "data"].includes(
                key
              )
            );
          })
          .map((m: any) => ({
            id: m.id,
            line: m.line,
            name: m.name,
            type: m.type,
            process_type_key: m.process_type_key,
          })),
      };

      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Machine Debug Tool
        </h1>

        <button
          onClick={fetchMachines}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Fetching..." : "Fetch & Analyze Machines"}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-lg font-bold text-red-800 mb-2">Error</h2>
            <pre className="text-sm text-red-600 whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Machines</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {result.total}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">With Process Type</p>
                  <p className="text-3xl font-bold text-green-600">
                    {result.withProcessType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Without Process Type</p>
                  <p className="text-3xl font-bold text-red-600">
                    {result.withoutProcessType}
                  </p>
                </div>
              </div>
            </div>

            {/* Unique Process Types */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Unique Process Types Found
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.uniqueProcessTypes.map((type: string) => (
                  <span
                    key={type}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Machines Without Process Type */}
            {result.machinesWithoutProcessType.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-red-800 mb-4">
                  ⚠️ Machines Without Process Type (
                  {result.machinesWithoutProcessType.length})
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  These machines need to have their process_type_key field set
                  in Xano:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          ID
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Line
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Suggested Fix
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.machinesWithoutProcessType.map((m: any) => {
                        const type = m.type?.toLowerCase() || "";
                        let suggested = "insert";
                        if (type.includes("fold")) suggested = "fold";
                        else if (type.includes("affix") || type.includes("glue"))
                          suggested = "affix";
                        else if (type.includes("ink") || type.includes("jet"))
                          suggested = "inkjet";
                        else if (
                          type.includes("hp") ||
                          type.includes("press") ||
                          type.includes("laser")
                        )
                          suggested = "hpPress";
                        else if (type.includes("data")) suggested = "data";

                        return (
                          <tr key={m.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.id}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.line}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.name || "-"}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.type || "-"}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono bg-green-50 text-green-800">
                              {suggested}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Machines With Weird Process Types */}
            {result.machinesWithWeirdProcessTypes.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-yellow-800 mb-4">
                  ⚠️ Machines With Non-Standard Process Types (
                  {result.machinesWithWeirdProcessTypes.length})
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  These machines have unusual process_type_key values that
                  should be normalized:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          ID
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Line
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Current process_type_key
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Suggested Fix
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.machinesWithWeirdProcessTypes.map((m: any) => {
                        const key = m.process_type_key?.toLowerCase() || "";
                        let suggested = "insert";
                        if (key.includes("fold")) suggested = "fold";
                        else if (key.includes("affix") || key.includes("glue"))
                          suggested = "affix";
                        else if (key.includes("ink") || key.includes("jet"))
                          suggested = "inkjet";
                        else if (
                          key.includes("hp") ||
                          key.includes("press") ||
                          key.includes("laser")
                        )
                          suggested = "hpPress";
                        else if (key.includes("data")) suggested = "data";
                        else if (key.includes("insert")) suggested = "insert";

                        return (
                          <tr key={m.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.id}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {m.line}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono bg-yellow-50 text-yellow-800">
                              {m.process_type_key}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono bg-green-50 text-green-800">
                              {suggested}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-blue-900 mb-4">
                How to Fix in Xano
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Log into your Xano dashboard</li>
                <li>Go to Database → machines table</li>
                <li>
                  For each machine listed above, update the process_type_key
                  field to the suggested value
                </li>
                <li>
                  Valid values are: insert, fold, affix, inkjet, hpPress, data
                </li>
                <li>
                  After fixing all machines, refresh your Jetson app and it
                  should work!
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
