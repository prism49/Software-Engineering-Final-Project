import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import 'antd/dist/reset.css';
import './styles/index.css';
import App from './App';
import { AuthProvider } from './store/auth';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1f883d',
          colorInfo: '#57606a',
          colorLink: '#24292f',
          colorLinkHover: '#1f2328',
          colorLinkActive: '#1f2328',
          colorSuccess: '#1f883d',
          colorWarning: '#9a6700',
          colorError: '#cf222e',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorText: '#1f2328',
          colorTextSecondary: '#656d76',
          colorBorder: '#d0d7de',
          boxShadow: '0 8px 24px rgba(140,149,159,0.2)',
        },
        components: {
          Card: {
            borderRadiusLG: 8,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
            fontWeight: 500,
          },
          Input: {
            controlHeight: 36,
            borderRadius: 8,
          },
          Select: {
            controlHeight: 36,
            borderRadius: 8,
          },
          Modal: {
            borderRadiusLG: 8,
          },
          Progress: {
            defaultColor: '#57606a',
          },
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
