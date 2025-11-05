'use client';

import { useState, useEffect, useRef } from 'react';
import { getToken } from '@/lib/api';

interface Client {
  id: number;
  name: string;
  created_at: number;
}

interface SmartClientSelectProps {
  value: number | null;
  onChange: (clientId: number, clientName: string) => void;
  required?: boolean;
  initialClientName?: string;
}

export default function SmartClientSelect({ value, onChange, required = false, initialClientName }: SmartClientSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('SmartClientSelect - Props:', { value, initialClientName, selectedClient });

  // Fetch clients from API
  const fetchClients = async (search: string = '') => {
    setLoading(true);
    try {
      const token = getToken();
      const url = new URL('https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients');
      if (search) {
        url.searchParams.append('search', search);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        console.error('Error fetching clients:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Set initial client from props if provided
  useEffect(() => {
    if (value && value > 0 && initialClientName) {
      // Only update if the selected client doesn't match the value
      if (!selectedClient || selectedClient.id !== value) {
        console.log('Setting initial client:', { id: value, name: initialClientName }); // Debug
        setSelectedClient({ id: value, name: initialClientName, created_at: 0 });
      }
    } else if (!value) {
      setSelectedClient(null);
    }
  }, [value, initialClientName]);

  // Fetch and set the selected client when value changes (only if we don't have initialClientName)
  useEffect(() => {
    const fetchSelectedClient = async () => {
      // Skip fetching if we have initialClientName - it was already set in the previous useEffect
      if (initialClientName) {
        return;
      }
      
      if (value && value > 0) {
        // Don't fetch if we already have the correct client selected
        if (selectedClient && selectedClient.id === value) {
          return;
        }
        
        try {
          const token = getToken();
          const response = await fetch(`https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients/${value}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const client = await response.json();
            console.log('Fetched client:', client); // Debug log
            setSelectedClient(client);
          } else {
            console.error('Error fetching client:', response.status, await response.text());
          }
        } catch (error) {
          console.error('Error fetching client:', error);
        }
      } else if (value === null) {
        setSelectedClient(null);
      }
    };

    fetchSelectedClient();
  }, [value, initialClientName]);

  // Fetch clients on mount and when search changes
  useEffect(() => {
    if (isOpen) {
      fetchClients(searchQuery);
    }
  }, [searchQuery, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle client selection
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    onChange(client.id, client.name);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle adding new client
  const handleAddClient = async () => {
    if (!newClientName.trim()) return;

    setAddingClient(true);
    try {
      const token = getToken();
      const response = await fetch('https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newClientName }),
      });

      if (response.ok) {
        const newClient = await response.json();
        // Automatically select the newly created client
        setSelectedClient(newClient);
        onChange(newClient.id, newClient.name);
        setIsAddModalOpen(false);
        setNewClientName('');
        // Refresh the clients list
        fetchClients(searchQuery);
      } else {
        console.error('Error adding client:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error adding client:', error);
    } finally {
      setAddingClient(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Select Input with + Button */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={selectedClient ? selectedClient.name : ''}
            onClick={() => setIsOpen(!isOpen)}
            readOnly
            className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] cursor-pointer"
            placeholder="Select a client..."
            required={required}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          +
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              autoFocus
            />
          </div>

          {/* Client List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-[var(--text-light)]">Loading...</div>
            ) : clients.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-light)]">No clients found</div>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  {client.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setIsAddModalOpen(false);
              setNewClientName('');
            }}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-[var(--dark-blue)]">Add New Client</h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewClientName('');
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <div className="p-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                  placeholder="Enter client name..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddClient();
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewClientName('');
                }}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddClient}
                disabled={!newClientName.trim() || addingClient}
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingClient ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
