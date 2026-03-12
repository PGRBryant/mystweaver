import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <NavLink to="/" className="text-lg font-bold text-gray-900">
                Mystweaver
              </NavLink>
              <nav className="flex gap-4">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`
                  }
                >
                  Flags
                </NavLink>
                <NavLink
                  to="/experiments"
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`
                  }
                >
                  Experiments
                </NavLink>
                <NavLink
                  to="/audit"
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`
                  }
                >
                  Audit log
                </NavLink>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
