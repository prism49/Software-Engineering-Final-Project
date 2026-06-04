import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/services';
import { useAuth } from '../store/auth';
import type { ProjectStatus, ProjectSummary, PublicUserSummary, Tag as TagItem } from '../types';
import { formatDate, projectStatusLabel } from '../utils/format';

const PROJECTS_CHANGED_EVENT = 'teamsync:projects-changed';

const projectStatusColor: Record<ProjectStatus, string> = {
  RECRUITING: 'blue',
  ACTIVE: 'green',
  CLOSED: 'default',
};

interface ProjectsPageProps {
  mode?: 'all' | 'mine';
}

export function ProjectsPage({ mode = 'all' }: ProjectsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyingProject, setApplyingProject] = useState<ProjectSummary | null>(null);
  const [filters, setFilters] = useState<{ status?: ProjectStatus; tag?: string }>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMode, setSearchMode] = useState<'project' | 'user'>('project');
  const [userSearchResults, setUserSearchResults] = useState<PublicUserSummary[]>([]);
  const [createForm] = Form.useForm();
  const [applyForm] = Form.useForm<{ apply_reason?: string }>();

  const formatProjectDisplayTitle = useCallback(
    (project: ProjectSummary) => `${project.leader.nickname}/${project.title}`,
    [],
  );
  const showLeaderAvatar = mode === 'all';
  const getUserHomePath = useCallback(
    (leaderUserId: number) => (user?.user_id === leaderUserId ? '/my-projects' : `/users/${leaderUserId}`),
    [user],
  );

  const renderLeaderIdentity = useCallback(
    (project: ProjectSummary) => {
      if (!showLeaderAvatar) {
        return <>{project.leader.nickname}</>;
      }

      return (
        <Link to={getUserHomePath(project.leader.user_id)} className="project-user-link">
          <Space size={8} className="project-user-link-inner">
            <Avatar size={20} icon={<UserOutlined />} />
            <span className="project-user-link-text">{project.leader.nickname}</span>
          </Space>
        </Link>
      );
    },
    [getUserHomePath, showLeaderAvatar],
  );

  const renderProjectDisplayTitle = useCallback(
    (project: ProjectSummary) => {
      if (!showLeaderAvatar) {
        return formatProjectDisplayTitle(project);
      }

      return (
        <Space size={8} wrap>
          <Link to={getUserHomePath(project.leader.user_id)} className="project-user-link">
            <Space size={8} className="project-user-link-inner">
              <Avatar size={20} icon={<UserOutlined />} />
              <span className="project-user-link-text">{project.leader.nickname}</span>
            </Space>
          </Link>
          <Typography.Text type="secondary">/</Typography.Text>
          <Link to={`/projects/${project.project_id}`} className="profile-repo-name-link">
            {project.title}
          </Link>
        </Space>
      );
    },
    [formatProjectDisplayTitle, getUserHomePath, showLeaderAvatar],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectData, tagData] = await Promise.all([
        api.getProjects(filters),
        api.getTags(),
      ]);
      setProjects(projectData);
      setAllTags(tagData);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, messageApi]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (mode !== 'all') {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== '1') {
      return;
    }

    if (!isAuthenticated) {
      messageApi.info('请先登录后再操作');
      navigate('/auth');
      return;
    }

    setCreateOpen(true);
    navigate('/projects', { replace: true });
  }, [isAuthenticated, location.search, messageApi, mode, navigate]);

  const scopedProjects = useMemo(
    () =>
      mode === 'mine'
        ? !user
          ? []
          : projects.filter(
              (project) =>
                project.leader.user_id === user.user_id ||
                project.members.some((member) => member.user_id === user.user_id && member.status !== 'REJECTED'),
            )
        : projects,
    [mode, projects, user],
  );

  const visibleProjects = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return scopedProjects;
    }

    return scopedProjects.filter((project) => {
      const searchableText = [
        project.title,
        project.description ?? '',
        project.leader.nickname,
        project.leader.username,
        ...project.tags.map((tag) => tag.name),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedKeyword);
    });
  }, [scopedProjects, searchKeyword]);

  useEffect(() => {
    if (mode !== 'all' || searchMode !== 'user') {
      setUserSearchResults([]);
      return;
    }

    const keyword = searchKeyword.trim();
    if (!keyword) {
      setUserSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api
        .getUsers(keyword)
        .then((users) => setUserSearchResults(users))
        .catch(() => setUserSearchResults([]));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mode, searchKeyword, searchMode]);

  const requireLogin = useCallback(() => {
    if (!isAuthenticated) {
      messageApi.info('请先登录后再操作');
      navigate('/auth');
      return false;
    }
    return true;
  }, [isAuthenticated, messageApi, navigate]);

  const handleCreateProject = async () => {
    if (!requireLogin()) {
      return;
    }

    try {
      const values = await createForm.validateFields();
      await api.createProject({
        ...values,
        deadline: values.deadline.format('YYYY-MM-DD'),
      });
      messageApi.success('项目创建成功');
      createForm.resetFields();
      setCreateOpen(false);
      await loadData();
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleApply = async () => {
    if (!applyingProject) {
      return;
    }

    try {
      const values = await applyForm.validateFields();
      const result = await api.applyToProject(applyingProject.project_id, values.apply_reason);
      messageApi.success(result.message);
      setApplyOpen(false);
      setApplyingProject(null);
      applyForm.resetFields();
      await loadData();
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  return (
    <div className="page-stack">
      {contextHolder}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card variant="borderless" className="page-toolbar-card">
          <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
            <Space wrap size="middle">
              <Select<ProjectStatus | undefined>
                allowClear
                placeholder="按状态筛选"
                style={{ minWidth: 160 }}
                value={filters.status}
                onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                options={[
                  { value: 'RECRUITING', label: '招募中' },
                  { value: 'ACTIVE', label: '进行中' },
                  { value: 'CLOSED', label: '已关闭' },
                ]}
              />
              <Select<string | undefined>
                allowClear
                showSearch
                placeholder="按标签筛选"
                style={{ minWidth: 180 }}
                value={filters.tag}
                onChange={(value) => setFilters((prev) => ({ ...prev, tag: value }))}
                options={allTags.map((tag) => ({ value: tag.name, label: tag.name }))}
              />
              <Button onClick={() => setFilters({})}>重置筛选</Button>
            </Space>
            <Space wrap size="middle">
              {mode === 'all' && (
                <Select<'project' | 'user'>
                  value={searchMode}
                  onChange={setSearchMode}
                  options={[
                    { value: 'project', label: '项目' },
                    { value: 'user', label: '用户' },
                  ]}
                  style={{ width: 110 }}
                />
              )}
              <Input.Search
                allowClear
                placeholder={searchMode === 'user' ? '搜索昵称或用户名' : '搜索项目名称、描述、作者或标签'}
                style={{ width: 320 }}
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
              <Button type="primary" onClick={() => (requireLogin() ? setCreateOpen(true) : null)}>
                创建项目
              </Button>
            </Space>
          </Flex>
        </Card>

        {mode === 'mine' && !isAuthenticated && (
          <Alert
            type="info"
            showIcon
            message="登录后可查看个人主页。"
            action={
              <Button size="small" type="primary" onClick={() => navigate('/auth')}>
                去登录
              </Button>
            }
          />
        )}

        <div className="project-list-shell">
          {loading ? (
            <div className="project-list-state">
              <Spin size="large" />
            </div>
          ) : mode === 'all' && searchMode === 'user' ? (
            searchKeyword.trim() ? (
              userSearchResults.length > 0 ? (
                <List
                  className="project-rect-list"
                  dataSource={userSearchResults}
                  renderItem={(searchUser) => (
                    <List.Item className="project-list-item" style={{ padding: '24px' }}>
                      <List.Item.Meta
                        avatar={<Avatar size={40} icon={<UserOutlined />} />}
                        title={
                          <Link
                            to={getUserHomePath(searchUser.user_id)}
                            className="project-user-link"
                          >
                            <Space size={8} className="project-user-link-inner">
                              <span className="project-user-link-text">{searchUser.nickname}</span>
                            </Space>
                          </Link>
                        }
                        description={
                          <Space direction="vertical" size={8} style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary">
                              @{searchUser.username}
                            </Typography.Text>
                            <Tag bordered={false} style={{ width: 'fit-content', margin: 0 }}>
                              {searchUser.role === 'TEACHER' ? '老师' : '学生'}
                            </Tag>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="project-list-state">
                  <Empty description="暂无符合条件的用户" />
                </div>
              )
            ) : (
              <div className="project-list-state">
                <Empty description="请输入昵称或用户名搜索用户" />
              </div>
            )
          ) : visibleProjects.length === 0 ? (
            <div className="project-list-state">
              <Empty description={mode === 'mine' ? '当前没有可展示的项目' : '暂无符合条件的项目'} />
            </div>
          ) : (
            <List
              className="project-rect-list"
              dataSource={visibleProjects}
              itemLayout="vertical"
              renderItem={(project) => {
                return (
                  <List.Item
                    className="project-list-item"
                    style={{ padding: '24px' }}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap size="middle" style={{ marginBottom: 4 }}>
                          <div className="project-display-title">
                            {renderProjectDisplayTitle(project)}
                          </div>
                          <Tag color={projectStatusColor[project.status]} style={{ margin: 0 }}>
                            {projectStatusLabel[project.status]}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                            {project.description || '暂无项目描述'}
                          </Typography.Text>

                          <Flex gap="large" wrap="wrap">
                            <Space>
                              <Typography.Text type="secondary">队长：</Typography.Text>
                              {renderLeaderIdentity(project)}
                            </Space>
                            <Space>
                              <Typography.Text type="secondary">截止日期：</Typography.Text>
                              <Typography.Text>{formatDate(project.deadline)}</Typography.Text>
                            </Space>
                            <Space>
                              <Typography.Text type="secondary">成员进度：</Typography.Text>
                              <Typography.Text>{project.member_count}/{project.max_members}</Typography.Text>
                            </Space>
                            <Space>
                              <Typography.Text type="secondary">任务总数：</Typography.Text>
                              <Typography.Text>{project.task_count}</Typography.Text>
                            </Space>
                          </Flex>

                          {project.tags.length > 0 && (
                            <Space wrap>
                              {project.tags.map((tag) => (
                                <Tag key={tag.tag_id} bordered={false} style={{ background: 'rgba(255, 255, 255, 0.58)', color: '#475569' }}>
                                  {tag.name}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </Space>

      <Modal
        title="创建项目"
        open={createOpen}
        onOk={() => void handleCreateProject()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={createForm}
          initialValues={{ max_members: 5, tag_ids: [] }}
        >
          <Form.Item
            label="项目名称"
            name="title"
            rules={[
              { required: true, whitespace: true, message: '请输入项目名称' },
              { min: 1, max: 100, message: '项目名称长度需为 1-100 位' },
            ]}
          >
            <Input placeholder="例如：软件工程课设" maxLength={100} showCount />
          </Form.Item>
          <Form.Item
            label="项目描述"
            name="description"
            rules={[{ max: 1000, message: '项目描述长度不能超过 1000 位' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入项目描述" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item
            label="人数上限"
            name="max_members"
            rules={[{ required: true, message: '请输入人数上限' }]}
          >
            <InputNumber min={2} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="截止日期"
            name="deadline"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
            <DatePicker style={{ width: '100%' }} disabledDate={(current) => current.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item label="项目标签" name="tag_ids">
            <Select
              mode="multiple"
              options={allTags.map((tag) => ({ value: tag.tag_id, label: tag.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          applyingProject ? (
            <Space size={8}>
              <span>申请加入：</span>
              {showLeaderAvatar ? <Avatar size={20} icon={<UserOutlined />} /> : null}
              <span>{formatProjectDisplayTitle(applyingProject)}</span>
            </Space>
          ) : (
            '申请加入项目'
          )
        }
        open={applyOpen}
        onOk={() => void handleApply()}
        onCancel={() => {
          setApplyOpen(false);
          setApplyingProject(null);
          applyForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form layout="vertical" form={applyForm}>
          <Form.Item label="申请理由" name="apply_reason">
            <Input.TextArea rows={4} placeholder="可选，向队长说明你的能力和意愿" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
