'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface User {
  email: string;
  admin: boolean;
}

interface PageHeaderProps {
  currentPage: 'machines' | 'projections';
  user?: User | null;
  onAddJobClick?: () => void;
  showAddJobButton?: boolean;
  onLogout: () => void;
}

export default function PageHeader({
  currentPage,
  user,
  onAddJobClick,
  showAddJobButton = false,
  onLogout,
}: PageHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="bg-white shadow-sm border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/machines" className="flex items-center cursor-pointer">
            <Image
              src="/logo.png"
              alt="Jetson Marketing Solutions"
              width={200}
              height={56}
              className="h-14 w-auto"
              priority
            />
          </Link>

          <nav className="flex gap-2 relative z-10">
            <Link
              href="/machines"
              onClick={() => console.log('Machines link clicked')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                currentPage === 'machines'
                  ? 'bg-[var(--primary-blue)] text-white'
                  : 'text-[var(--text-dark)] hover:bg-gray-100'
              }`}
            >
              Machines
            </Link>
            <Link
              href="/projections"
              onClick={() => console.log('Projections link clicked')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                currentPage === 'projections'
                  ? 'bg-[var(--primary-blue)] text-white'
                  : 'text-[var(--text-dark)] hover:bg-gray-100'
              }`}
            >
              Projections
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {user?.admin && (
              <button
                onClick={() => router.push('/signup')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Create User
              </button>
            )}
            {showAddJobButton && onAddJobClick && (
              <button
                onClick={() => {
                  console.log('Add New Job button clicked');
                  onAddJobClick();
                }}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-2 cursor-pointer relative z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Job
              </button>
            )}

            {/* Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Profile menu"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--primary-blue)] flex items-center justify-center text-white font-semibold">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <svg
                  className={`w-4 h-4 text-[var(--text-light)] transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <div className="text-sm text-[var(--text-light)]">Logged in as</div>
                    <div className="text-sm font-medium text-[var(--text-dark)] truncate">{user?.email}</div>
                    {user?.admin && (
                      <span className="inline-block mt-1 text-xs text-blue-600 font-semibold">Admin</span>
                    )}
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
