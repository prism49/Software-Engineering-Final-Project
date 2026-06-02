import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/services';
import { useAuth } from '../store/auth';
import type { ProjectStatus, ProjectSummary, Tag as TagItem } from '../types';
import { formatDate, projectStatusLabel } from '../utils/format';

const projectStatusColor: Record<ProjectStatus, string> = {
  RECRUITING: 'blue',
  ACTIVE: 'green',
  CLOSED: 'default',
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [myTags, setMyTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyingProject, setApplyingProject] = useState<ProjectSummary | null>(null);
  const [filters, setFilters] = useState<{ status?: ProjectStatus; tag?: string }>({});
  const [createForm] = Form.useForm();
  const [tagForm] = Form.useForm<{ tag_ids: number[] }>();
  const [applyForm] = Form.useForm<{ apply_reason?: string }>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectData, tagData] = await Promise.all([
        api.getProjects(filters),
        api.getTags(),
      ]);
      setProjects(projectData);
      setAllTags(tagData);

      if (isAuthenticated) {
        const userTagData = await api.getMyTags();
        setMyTags(userTagData);
        tagForm.setFieldsValue({ tag_ids: userTagData.map((tag) => tag.tag_id) });
      } else {
        setMyTags([]);
      }
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, isAuthenticated, messageApi, tagForm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableProjects = useMemo(
    () => projects.filter((project) => project.status !== 'CLOSED'),
    [projects],
  );

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
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleUpdateMyTags = async () => {
    if (!requireLogin()) {
      return;
    }

    try {
      const values = await tagForm.validateFields();
      const updated = await api.updateMyTags(values.tag_ids ?? []);
      setMyTags(updated);
      messageApi.success('技能标签已更新');
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
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  return (
    <div className="page-stack">
      {contextHolder}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={17}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless">
              <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                <div>
                  <Typography.Title level={3} style={{ marginBottom: 4 }}>
                    项目大厅
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    浏览正在招募或进行中的项目，并按标签筛选
                  </Typography.Text>
                </div>
                <Button type="primary" onClick={() => (requireLogin() ? setCreateOpen(true) : null)}>
                  创建项目
                </Button>
              </Flex>
            </Card>

            <Card variant="borderless">
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
            </Card>

            <Card variant="borderless" styles={{ body: { padding: 0 } }}>
              {loading ? (
                <div className="center-box">
                  <Spin size="large" />
                </div>
              ) : availableProjects.length === 0 ? (
                <div style={{ padding: '40px 0' }}>
                  <Empty description="暂无符合条件的项目" />
                </div>
              ) : (
                <List
                  dataSource={projects}
                  itemLayout="vertical"
                  renderItem={(project) => {
                    const isLeader = user?.user_id === project.leader.user_id;

                    return (
                      <List.Item
                        style={{ padding: '24px' }}
                        actions={[
                          <Link key="detail" to={`/projects/${project.project_id}`}>
                            <Button type="text" style={{ color: '#4f46e5' }}>查看详情</Button>
                          </Link>,
                          <Button
                            key="apply"
                            type="text"
                            disabled={project.status !== 'RECRUITING' || isLeader}
                            onClick={() => {
                              if (!requireLogin()) {
                                return;
                              }
                              setApplyingProject(project);
                              setApplyOpen(true);
                            }}
                          >
                            申请加入
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap size="middle" style={{ marginBottom: 4 }}>
                              <Typography.Text strong style={{ fontSize: 18 }}>{project.title}</Typography.Text>
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
                                  <Typography.Text>{project.leader.nickname}</Typography.Text>
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
                                    <Tag key={tag.tag_id} bordered={false} style={{ background: '#f1f5f9', color: '#475569' }}>
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
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={7}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless">
              <Typography.Title level={4}>当前用户</Typography.Title>
              {user ? (
                <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
                  <Flex justify="space-between">
                    <Typography.Text type="secondary">昵称</Typography.Text>
                    <Typography.Text strong>{user.nickname}</Typography.Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Typography.Text type="secondary">用户名</Typography.Text>
                    <Typography.Text>@{user.username}</Typography.Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Typography.Text type="secondary">角色</Typography.Text>
                    <Tag color="purple" style={{ margin: 0 }}>{user.role}</Tag>
                  </Flex>
                </Space>
              ) : (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  当前未登录，登录后可创建项目、设置技能标签和参与协作。
                </Typography.Text>
              )}
            </Card>

            <Card
              variant="borderless"
              title="我的技能标签"
              extra={
                <Button type="link" onClick={() => void handleUpdateMyTags()} disabled={!isAuthenticated} style={{ padding: 0 }}>
                  保存
                </Button>
              }
            >
              <Form form={tagForm} layout="vertical" initialValues={{ tag_ids: myTags.map((tag) => tag.tag_id) }}>
                <Form.Item name="tag_ids" style={{ marginBottom: 12 }}>
                  <Select
                    mode="multiple"
                    placeholder={isAuthenticated ? '请选择你的技能标签' : '登录后可编辑'}
                    disabled={!isAuthenticated}
                    options={allTags.map((tag) => ({ value: tag.tag_id, label: tag.name }))}
                  />
                </Form.Item>
              </Form>
              <Space wrap size={[0, 8]}>
                {myTags.length ? myTags.map((tag) => (
                  <Tag key={tag.tag_id} color="blue" bordered={false}>{tag.name}</Tag>
                )) : <Typography.Text type="secondary">暂无标签</Typography.Text>}
              </Space>
            </Card>

            <Card variant="borderless" title="平台公告" styles={{ header: { borderBottom: 'none' } }}>
              <Space direction="vertical" size="small">
                <Typography.Text type="secondary">• 欢迎使用 TeamSync 校园微团队协作系统</Typography.Text>
                <Typography.Text type="secondary">• 在项目详情中可进行任务分配与审核</Typography.Text>
                <Typography.Text type="secondary">• 里程碑状态由系统自动判定，不可手动修改</Typography.Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

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
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：软件工程课设" />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={4} placeholder="请输入项目描述" />
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
        title={applyingProject ? `申请加入：${applyingProject.title}` : '申请加入项目'}
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
