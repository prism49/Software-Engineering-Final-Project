import { Layout, Menu, Button, Space, Typography, Avatar } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../store/auth';

const { Header, Content } = Layout;

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-brand">
          <Typography.Title level={4} style={{ margin: 0 }}>
            TeamSync
          </Typography.Title>
          <span>校园微团队协作平台</span>
        </div>

        <Menu
          mode="horizontal"
          selectable
          selectedKeys={location.pathname.startsWith('/projects') ? ['projects'] : []}
          items={[
            {
              key: 'projects',
              icon: <HomeOutlined />,
              label: <Link to="/projects">项目大厅</Link>,
            },
          ]}
          className="app-menu"
        />

        <Space size="large">
          {user ? (
            <Space size="small">
              <Avatar
                icon={<UserOutlined />}
                style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}
              />
              <div className="app-user-info">
                <Typography.Text>{user.nickname}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  @{user.username}
                </Typography.Text>
              </div>
            </Space>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 13, display: 'none' }}>
              游客可浏览项目，登录后可参与协作
            </Typography.Text>
          )}

          {isAuthenticated ? (
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/projects', { replace: true });
              }}
            >
              退出
            </Button>
          ) : (
            <Button icon={<LoginOutlined />} type="primary" onClick={() => navigate('/auth')}>
              登录 / 注册
            </Button>
          )}
        </Space>
      </Header>

      <Content className="app-content">{children}</Content>
    </Layout>
  );
}
