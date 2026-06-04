import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { AppLayout } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { UserHomePage } from './pages/UserHomePage';
import { useAuth } from './store/auth';

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const isSwitchingAccount = searchParams.get('switch') === '1';

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated && !isSwitchingAccount) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <AppLayout>
              <ProjectsPage mode="all" />
            </AppLayout>
          }
        />
        <Route
          path="/my-projects"
          element={
            <AppLayout>
              <UserHomePage />
            </AppLayout>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <AppLayout>
              <UserHomePage />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <AppLayout>
              <ProjectDetailPage />
            </AppLayout>
          }
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
