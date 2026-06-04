import {
  Layout,
  Menu,
  Button,
  Space,
  Typography,
  Avatar,
  Form,
  Modal,
  Select,
  Tag as AntTag,
  Dropdown,
  Empty,
  Spin,
  Tooltip,
  message,
} from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/services';
import type { ProjectSummary, Tag } from '../types';

const { Sider, Header, Content } = Layout;
const PROJECTS_CHANGED_EVENT = 'teamsync:projects-changed';

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [myTags, setMyTags] = useState<Tag[]>([]);
  const [sidebarProjects, setSidebarProjects] = useState<ProjectSummary[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [tagForm] = Form.useForm<{ tag_ids: number[] }>();

  useEffect(() => {
    if (!isAuthenticated) {
      setMyTags([]);
      setSidebarProjects([]);
      return;
    }

    const loadMyTags = async () => {
      try {
        const myTagData = await api.getMyTags();
        setMyTags(myTagData);
      } catch (error) {
        if (error instanceof Error) {
          messageApi.error(error.message);
        }
      }
    };

    void loadMyTags();
  }, [isAuthenticated, messageApi]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSidebarProjects([]);
      return;
    }

    const loadSidebarProjects = async () => {
      setSidebarLoading(true);
      try {
        const allProjectData = await api.getProjects();
        const myProjectData = allProjectData.filter(
          (project) =>
            project.leader.user_id === user.user_id ||
            project.members.some(
              (member) => member.user_id === user.user_id && member.status !== 'REJECTED',
            ),
        );
        setSidebarProjects(myProjectData);
      } catch (error) {
        if (error instanceof Error) {
          messageApi.error(error.message);
        }
      } finally {
        setSidebarLoading(false);
      }
    };

    const handleProjectsChanged = () => {
      void loadSidebarProjects();
    };

    void loadSidebarProjects();
    window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);

    return () => {
      window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
    };
  }, [isAuthenticated, messageApi, user]);

  const handleOpenTagModal = () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    const loadTagData = async () => {
      setTagLoading(true);
      try {
        const [tagData, myTagData] = await Promise.all([api.getTags(), api.getMyTags()]);
        setAllTags(tagData);
        setMyTags(myTagData);
        tagForm.setFieldsValue({ tag_ids: myTagData.map((tag) => tag.tag_id) });
        setTagModalOpen(true);
      } catch (error) {
        if (error instanceof Error) {
          messageApi.error(error.message);
        }
      } finally {
        setTagLoading(false);
      }
    };

    void loadTagData();
  };

  const handleSaveTags = async () => {
    try {
      const values = await tagForm.validateFields();
      const updatedTags = await api.updateMyTags(values.tag_ids ?? []);
      setMyTags(updatedTags);
      messageApi.success('技能标签已更新');
      setTagModalOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleSwitchAccount = () => {
    navigate('/auth?switch=1');
  };

  const handleConfirmLogout = () => {
    modalApi.confirm({
      title: '确认退出登录？',
      icon: <ExclamationCircleOutlined />,
      content: '退出后将返回项目大厅，需要重新登录才能继续进行协作操作。',
      okText: '确认退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        logout();
        navigate('/projects', { replace: true });
      },
    });
  };

  const userMenuItems = [
    {
      key: 'tags',
      icon: <SettingOutlined />,
      label: '设置技能标签',
    },
    {
      key: 'switch',
      icon: <SwapOutlined />,
      label: '切换账号',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const topbarTitle = useMemo(() => {
    if (location.pathname.startsWith('/my-projects') || location.pathname.startsWith('/users/')) {
      return '个人主页';
    }
    if (location.pathname.startsWith('/projects/')) {
      return '项目详情';
    }
    return '项目大厅';
  }, [location.pathname]);

  const formatProjectDisplayTitle = useMemo(
    () => (project: ProjectSummary) => `${project.leader.nickname}/${project.title}`,
    [],
  );

  const skillTagSummary = useMemo(() => myTags.map((tag) => tag.name).join(' / '), [myTags]);

  return (
    <Layout className="github-shell">
      {contextHolder}
      {modalContextHolder}
      <Sider width={296} className="github-sidebar" theme="light">
        <div className="github-sidebar-brand">
          <Typography.Title level={4} style={{ margin: 0 }}>
            TeamSync
          </Typography.Title>
          <Typography.Text type="secondary">校园微团队协作平台</Typography.Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[
            location.pathname.startsWith('/my-projects') || location.pathname.startsWith('/users/')
              ? 'my-projects'
              : location.pathname.startsWith('/projects')
                ? 'projects'
                : '',
          ]}
          items={[
            {
              key: 'projects',
              icon: <HomeOutlined />,
              label: <Link to="/projects">项目大厅</Link>,
            },
            {
              key: 'my-projects',
              icon: <AppstoreOutlined />,
              label: <Link to="/my-projects">个人主页</Link>,
            },
          ]}
          className="github-sidebar-menu"
        />

        <div className="github-sidebar-section">
          <div className="github-sidebar-section-header">
            <Typography.Text strong>我的项目</Typography.Text>
            {isAuthenticated ? (
              <Button type="link" size="small" onClick={() => navigate('/my-projects')}>
                全部
              </Button>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <div className="github-sidebar-empty">
              <Typography.Text type="secondary">登录后查看自己的项目</Typography.Text>
            </div>
          ) : sidebarLoading ? (
            <div className="github-sidebar-loading">
              <Spin size="small" />
            </div>
          ) : sidebarProjects.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目" />
          ) : (
            <div className="github-sidebar-projects">
              {sidebarProjects.slice(0, 10).map((project) => (
                <Link
                  key={project.project_id}
                  to={`/projects/${project.project_id}`}
                  className={`github-project-link${
                    location.pathname === `/projects/${project.project_id}` ? ' is-active' : ''
                  }`}
                >
                  <span>{formatProjectDisplayTitle(project)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Sider>

      <Layout className="github-main">
        <Header className="github-topbar">
          <div className="github-topbar-title">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {topbarTitle}
            </Typography.Title>
          </div>

          <Space size="middle" className="github-topbar-actions">
            {user ? (
              <>
                <Tooltip
                  title={myTags.length > 0 ? skillTagSummary : undefined}
                  placement="bottom"
                  overlayClassName="skill-tags-tooltip"
                >
                  <div className="app-skill-tags">
                    {myTags.length > 0 ? (
                      myTags.map((tag) => (
                        <AntTag key={tag.tag_id} bordered={false} className="app-skill-tag">
                          {tag.name}
                        </AntTag>
                      ))
                    ) : (
                      <Typography.Text type="secondary" className="app-skill-empty">
                        暂未设置技能标签
                      </Typography.Text>
                    )}
                  </div>
                </Tooltip>
                <Dropdown
                  trigger={['hover']}
                  menu={{
                    items: userMenuItems,
                    onClick: ({ key }) => {
                      if (key === 'tags') {
                        handleOpenTagModal();
                      } else if (key === 'switch') {
                        handleSwitchAccount();
                      } else if (key === 'logout') {
                      handleConfirmLogout();
                      }
                    },
                  }}
                >
                  <div className="github-user-trigger">
                    <Avatar icon={<UserOutlined />} className="app-user-avatar" />
                    <div className="app-user-info">
                      <Typography.Text>{user.nickname}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                        @{user.username}
                      </Typography.Text>
                    </div>
                  </div>
                </Dropdown>
              </>
            ) : (
              <Button icon={<LoginOutlined />} type="primary" onClick={() => navigate('/auth')}>
                登录 / 注册
              </Button>
            )}
          </Space>
        </Header>

        <Content className="github-content">{children}</Content>
      </Layout>

      <Modal
        title="设置自己的技能标签"
        open={tagModalOpen}
        onOk={() => void handleSaveTags()}
        onCancel={() => setTagModalOpen(false)}
        confirmLoading={tagLoading}
        destroyOnHidden
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item name="tag_ids" label="技能标签">
            <Select
              mode="multiple"
              placeholder="请选择你的技能标签"
              loading={tagLoading}
              options={allTags.map((tag) => ({ value: tag.tag_id, label: tag.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
