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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);
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
  }, [value, initialClientName, selectedClient]);

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
  }, [value, initialClientName, selectedClient]);

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

  // Handle deleting a client
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setDeletingClient(true);
    try {
      const token = getToken();
      const response = await fetch(`https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients/${clientToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // If the deleted client was selected, clear selection
        if (selectedClient?.id === clientToDelete.id) {
          setSelectedClient(null);
          onChange(0, '');
        }
        // Close the modal
        setIsDeleteModalOpen(false);
        setClientToDelete(null);
        // Refresh the clients list
        fetchClients(searchQuery);
        alert('Client deleted successfully!');
      } else {
        const errorText = await response.text();
        console.error('Error deleting client:', response.status, errorText);

        // Provide helpful error messages based on the error code
        if (response.status === 404) {
          alert(
            'Delete functionality is not available.\n\n' +
            'The DELETE endpoint for clients has not been configured in your Xano backend.\n\n' +
            'To enable client deletion, you need to:\n' +
            '1. Log into your Xano workspace\n' +
            '2. Go to the API for clients (api:a2ap84-I)\n' +
            '3. Add a DELETE endpoint for /clients/{id}\n' +
            '4. Configure it to delete the client record\n\n' +
            'Contact your backend administrator for assistance.'
          );
        } else {
          alert(`Error deleting client: ${errorText || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error deleting client. Please try again.');
    } finally {
      setDeletingClient(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the client when clicking delete
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
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
                <div
                  key={client.id}
                  className="flex items-center hover:bg-gray-50 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="flex-1 text-left px-4 py-2"
                  >
                    {client.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openDeleteModal(client, e)}
                    className="px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete client"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
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

      {/* Delete Client Confirmation Modal */}
      {isDeleteModalOpen && clientToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setClientToDelete(null);
            }}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-red-600">Delete Client</h2>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setClientToDelete(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-[var(--text-dark)] mb-2">
                Are you sure you want to delete the client <strong>{clientToDelete.name}</strong>?
              </p>
              <p className="text-sm text-red-600">
                Warning: This action cannot be undone. All jobs associated with this client may be affected.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setClientToDelete(null);
                }}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={deletingClient}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingClient ? 'Deleting...' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
