import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { FlagListPage } from '@/pages/FlagListPage';
import { FlagCreatePage } from '@/pages/FlagCreatePage';
import { FlagEditPage } from '@/pages/FlagEditPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { ExperimentListPage } from '@/pages/ExperimentListPage';
import { ExperimentDetailPage } from '@/pages/ExperimentDetailPage';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<FlagListPage />} />
            <Route path="/flags/new" element={<FlagCreatePage />} />
            <Route path="/flags/:key" element={<FlagEditPage />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/experiments" element={<ExperimentListPage />} />
            <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
