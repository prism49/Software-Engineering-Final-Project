import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/services';
import { useAuth } from '../store/auth';
import type {
  CreateMilestonePayload,
  CreateTaskPayload,
  ProjectDetail,
  ProjectMemberDetail,
  ProjectStatus,
  Tag as TagItem,
  TaskItem,
} from '../types';
import {
  formatDate,
  milestoneStatusLabel,
  projectStatusLabel,
  taskStatusLabel,
  toDatePickerValue,
} from '../utils/format';

const taskStatusColor: Record<string, string> = {
  TODO: 'default',
  DOING: 'processing',
  REVIEW: 'warning',
  DONE: 'success',
};

const projectStatusColor: Record<ProjectStatus, string> = {
  RECRUITING: 'blue',
  ACTIVE: 'green',
  CLOSED: 'default',
};

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [projectForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [milestoneForm] = Form.useForm();

  const numericProjectId = Number(projectId);

  const loadData = useCallback(async () => {
    if (!numericProjectId) {
      return;
    }

    setLoading(true);
    try {
      const [projectData, taskData, tagData] = await Promise.all([
        api.getProject(numericProjectId),
        api.getTasksByProject(numericProjectId),
        api.getTags(),
      ]);
      setProject(projectData);
      setTasks(taskData);
      setAllTags(tagData);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [messageApi, numericProjectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const approvedMembers = useMemo(
    () => (project?.members ?? []).filter((member) => member.status === 'APPROVED'),
    [project],
  );
  const pendingMembers = useMemo(
    () => (project?.members ?? []).filter((member) => member.status === 'PENDING'),
    [project],
  );
  const isApprovedMember = approvedMembers.some((member) => member.user_id === user?.user_id);
  const isLeader = project?.leader.user_id === user?.user_id;

  const requireLogin = useCallback(() => {
    if (!isAuthenticated) {
      messageApi.info('请先登录后再操作');
      navigate('/auth');
      return false;
    }
    return true;
  }, [isAuthenticated, messageApi, navigate]);

  const openProjectModal = () => {
    if (!project) {
      return;
    }
    projectForm.setFieldsValue({
      title: project.title,
      description: project.description ?? undefined,
      status: project.status,
      deadline: toDatePickerValue(project.deadline),
      tag_ids: project.tags.map((tag) => tag.tag_id),
    });
    setProjectModalOpen(true);
  };

  const openTaskModal = (task?: TaskItem) => {
    setEditingTask(task ?? null);
    taskForm.setFieldsValue({
      title: task?.title,
      description: task?.description ?? undefined,
      milestone_id: task?.milestone?.milestone_id,
      assignee_id: task?.assignee?.user_id,
      weight: task?.weight ?? 1,
      due_date: toDatePickerValue(task?.due_date),
    });
    setTaskModalOpen(true);
  };

  const openMilestoneModal = (milestoneId?: number) => {
    const milestone = project?.milestones.find((item) => item.milestone_id === milestoneId);
    setEditingMilestoneId(milestoneId ?? null);
    milestoneForm.setFieldsValue({
      title: milestone?.title,
      description: undefined,
      due_date: toDatePickerValue(milestone?.due_date),
    });
    setMilestoneModalOpen(true);
  };

  const handleProjectUpdate = async () => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const values = await projectForm.validateFields();
      const result = await api.updateProject(project.project_id, {
        ...values,
        deadline: values.deadline.format('YYYY-MM-DD'),
      });
      messageApi.success(result.message);
      setProjectModalOpen(false);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleTaskSubmit = async () => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const values = await taskForm.validateFields();
      const payload: CreateTaskPayload = {
        title: values.title,
        description: values.description,
        milestone_id: values.milestone_id,
        assignee_id: values.assignee_id,
        weight: values.weight,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
      };

      if (editingTask) {
        await api.updateTask(editingTask.task_id, payload);
        messageApi.success('任务已更新');
      } else {
        await api.createTask(project.project_id, payload);
        messageApi.success('任务已创建');
      }

      setTaskModalOpen(false);
      setEditingTask(null);
      taskForm.resetFields();
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleMilestoneSubmit = async () => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const values = await milestoneForm.validateFields();
      const payload: CreateMilestonePayload = {
        title: values.title,
        description: values.description,
        due_date: values.due_date.format('YYYY-MM-DD'),
      };

      if (editingMilestoneId) {
        const result = await api.updateMilestone(editingMilestoneId, payload);
        messageApi.success(result.message);
      } else {
        await api.createMilestone(project.project_id, payload);
        messageApi.success('里程碑已创建');
      }

      setMilestoneModalOpen(false);
      setEditingMilestoneId(null);
      milestoneForm.resetFields();
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleTaskStatusChange = async (taskId: number, status: 'DOING' | 'REVIEW') => {
    if (!requireLogin()) {
      return;
    }

    try {
      const result = await api.updateTask(taskId, { status });
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleTaskReview = async (taskId: number, action: 'DONE' | 'DOING') => {
    if (!requireLogin()) {
      return;
    }

    try {
      const result = await api.reviewTask(taskId, action);
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    if (!requireLogin()) {
      return;
    }

    try {
      const result = await api.deleteTask(taskId);
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleMemberApprove = async (member: ProjectMemberDetail, status: 'APPROVED' | 'REJECTED') => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const result = await api.approveMember(project.project_id, member.user_id, status);
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleMilestoneAction = async (
    milestoneId: number,
    action: 'complete' | 'delete',
  ) => {
    if (!requireLogin()) {
      return;
    }

    try {
      const result =
        action === 'complete'
          ? await api.completeMilestone(milestoneId)
          : await api.deleteMilestone(milestoneId);
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const taskColumns: ColumnsType<TaskItem> = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (_, task) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{task.title}</Typography.Text>
          <Typography.Text type="secondary">{task.description || '暂无描述'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskItem['status']) => (
        <Tag color={taskStatusColor[status]}>{taskStatusLabel[status]}</Tag>
      ),
    },
    {
      title: '执行人',
      key: 'assignee',
      render: (_, task) => task.assignee?.nickname || '未指派',
    },
    {
      title: '里程碑',
      key: 'milestone',
      render: (_, task) => task.milestone?.title || '无',
    },
    {
      title: '截止日期',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (value: string | null) => formatDate(value),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 80,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, task) => (
        <Space wrap>
          {isApprovedMember && (
            <Button size="small" onClick={() => openTaskModal(task)}>
              编辑
            </Button>
          )}
          {isApprovedMember && task.status === 'TODO' && (
            <Button size="small" type="primary" onClick={() => void handleTaskStatusChange(task.task_id, 'DOING')}>
              认领
            </Button>
          )}
          {task.status === 'DOING' && task.assignee?.user_id === user?.user_id && (
            <Button size="small" onClick={() => void handleTaskStatusChange(task.task_id, 'REVIEW')}>
              提交审核
            </Button>
          )}
          {isApprovedMember && task.status === 'REVIEW' && task.assignee?.user_id !== user?.user_id && (
            <>
              <Button size="small" type="primary" onClick={() => void handleTaskReview(task.task_id, 'DONE')}>
                通过
              </Button>
              <Button size="small" danger onClick={() => void handleTaskReview(task.task_id, 'DOING')}>
                打回
              </Button>
            </>
          )}
          {isApprovedMember && (
            <Popconfirm title="确认删除这个任务吗？" onConfirm={() => void handleTaskDelete(task.task_id)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <Empty description="项目不存在或加载失败" />
      </Card>
    );
  }

  return (
    <div className="page-stack">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: <Link to="/projects">项目大厅</Link>,
          },
          {
            title: project.title,
          },
        ]}
      />

      <Card variant="borderless">
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <div>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              style={{ paddingInline: 0, marginBottom: 8, color: '#64748b' }}
              onClick={() => navigate('/projects')}
            >
              返回项目大厅
            </Button>
            <Space wrap align="center" size="middle">
              <Typography.Title level={2} style={{ margin: 0 }}>
                {project.title}
              </Typography.Title>
              <Tag color={projectStatusColor[project.status]} style={{ margin: 0, fontSize: 14, padding: '4px 12px' }}>
                {projectStatusLabel[project.status]}
              </Tag>
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 15 }}>
              {project.description || '暂无项目描述'}
            </Typography.Paragraph>
          </div>

          <Space wrap size="middle">
            {isLeader && (
              <Button icon={<EditOutlined />} onClick={openProjectModal} size="large">
                编辑项目
              </Button>
            )}
            {isApprovedMember && (
              <>
                <Button onClick={() => openMilestoneModal()} size="large">新建里程碑</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()} size="large">
                  新建任务
                </Button>
              </>
            )}
          </Space>
        </Flex>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={16}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless" title="项目概览">
              <Descriptions column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }} size="middle">
                <Descriptions.Item label="队长">
                  <Typography.Text strong>{project.leader.nickname}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="截止日期">
                  <Typography.Text strong>{formatDate(project.deadline)}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="任务总数">
                  <Typography.Text strong>{project.task_count}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="成员规模">
                  <Typography.Text strong>{approvedMembers.length}/{project.max_members}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="项目标签" span={2}>
                  <Space wrap size={[0, 8]}>
                    {project.tags.length > 0 ? project.tags.map((tag) => (
                      <Tag key={tag.tag_id} bordered={false} style={{ background: '#f1f5f9', color: '#475569' }}>
                        {tag.name}
                      </Tag>
                    )) : <Typography.Text type="secondary">暂无标签</Typography.Text>}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card variant="borderless" title="任务管理" styles={{ body: { padding: 0 } }}>
              <Table
                rowKey="task_id"
                dataSource={tasks}
                columns={taskColumns}
                locale={{ emptyText: '暂无任务' }}
                pagination={{ pageSize: 6 }}
                scroll={{ x: 980 }}
              />
            </Card>

            <Card variant="borderless" title="里程碑">
              {project.milestones.length === 0 ? (
                <Empty description="暂无里程碑" style={{ padding: '40px 0' }} />
              ) : (
                <List
                  dataSource={project.milestones}
                  renderItem={(milestone) => (
                    <List.Item
                      style={{ padding: '20px 24px' }}
                      actions={
                        isApprovedMember
                          ? [
                              <Button key="edit" type="text" onClick={() => openMilestoneModal(milestone.milestone_id)}>
                                编辑
                              </Button>,
                              <Button
                                key="complete"
                                type="text"
                                disabled={milestone.status === 'COMPLETED'}
                                onClick={() => void handleMilestoneAction(milestone.milestone_id, 'complete')}
                              >
                                标记完成
                              </Button>,
                              <Popconfirm
                                key="delete"
                                title="确认删除这个里程碑吗？"
                                onConfirm={() => void handleMilestoneAction(milestone.milestone_id, 'delete')}
                              >
                                <Button type="text" danger>
                                  删除
                                </Button>
                              </Popconfirm>,
                            ]
                          : []
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap size="middle">
                            <Typography.Text strong style={{ fontSize: 16 }}>{milestone.title}</Typography.Text>
                            <Tag color={milestone.status === 'COMPLETED' ? 'success' : 'processing'} style={{ margin: 0 }}>
                              {milestoneStatusLabel[milestone.status]}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Typography.Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                            截止日期：{formatDate(milestone.due_date)}
                          </Typography.Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={8}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless" title="项目成员">
              <List
                dataSource={project.members}
                locale={{ emptyText: '暂无成员' }}
                renderItem={(member) => (
                  <List.Item
                    actions={
                      isLeader && member.status === 'PENDING'
                        ? [
                            <Button
                              key="approve"
                              type="link"
                              onClick={() => void handleMemberApprove(member, 'APPROVED')}
                            >
                              批准
                            </Button>,
                            <Button
                              key="reject"
                              type="link"
                              danger
                              onClick={() => void handleMemberApprove(member, 'REJECTED')}
                            >
                              拒绝
                            </Button>,
                          ]
                        : []
                    }
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Typography.Text strong>{member.nickname}</Typography.Text>
                          <Tag bordered={false}>{member.role}</Tag>
                          <Tag bordered={false} color={member.status === 'APPROVED' ? 'success' : 'warning'}>{member.status}</Tag>
                        </Space>
                      }
                      description={`@${member.username} · 加入时间：${formatDate(member.joined_at)}`}
                    />
                  </List.Item>
                )}
              />
            </Card>

            <Card variant="borderless" title="待审批申请">
              {pendingMembers.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <Typography.Text type="secondary">当前没有待审批申请。</Typography.Text>
                </div>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {pendingMembers.map((member) => (
                    <Card key={member.user_id} size="small" type="inner" style={{ background: '#f8fafc' }}>
                      <Flex justify="space-between" align="center">
                        <div>
                          <Typography.Text strong>{member.nickname}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            @{member.username}
                          </Typography.Paragraph>
                        </div>
                        {isLeader && (
                          <Space>
                            <Button size="small" type="primary" ghost onClick={() => void handleMemberApprove(member, 'APPROVED')}>
                              批准
                            </Button>
                            <Button
                              size="small"
                              danger
                              ghost
                              onClick={() => void handleMemberApprove(member, 'REJECTED')}
                            >
                              拒绝
                            </Button>
                          </Space>
                        )}
                      </Flex>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        title="编辑项目"
        open={projectModalOpen}
        onOk={() => void handleProjectUpdate()}
        onCancel={() => setProjectModalOpen(false)}
        destroyOnHidden
      >
        <Form layout="vertical" form={projectForm}>
          <Form.Item label="项目名称" name="title" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="项目状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { value: 'RECRUITING', label: '招募中' },
                { value: 'ACTIVE', label: '进行中' },
                { value: 'CLOSED', label: '已关闭' },
              ]}
            />
          </Form.Item>
          <Form.Item label="截止日期" name="deadline" rules={[{ required: true, message: '请选择截止日期' }]}>
            <DatePicker style={{ width: '100%' }} />
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
        title={editingTask ? '编辑任务' : '新建任务'}
        open={taskModalOpen}
        onOk={() => void handleTaskSubmit()}
        onCancel={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
          taskForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form layout="vertical" form={taskForm} initialValues={{ weight: 1 }}>
          <Form.Item label="任务标题" name="title" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="任务描述" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="所属里程碑" name="milestone_id">
            <Select
              allowClear
              options={project.milestones.map((milestone) => ({
                value: milestone.milestone_id,
                label: milestone.title,
              }))}
            />
          </Form.Item>
          <Form.Item label="指派成员" name="assignee_id">
            <Select
              allowClear
              options={approvedMembers.map((member) => ({
                value: member.user_id,
                label: `${member.nickname} (@${member.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="权重" name="weight" rules={[{ required: true, message: '请输入权重' }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="截止日期" name="due_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingMilestoneId ? '编辑里程碑' : '新建里程碑'}
        open={milestoneModalOpen}
        onOk={() => void handleMilestoneSubmit()}
        onCancel={() => {
          setMilestoneModalOpen(false);
          setEditingMilestoneId(null);
          milestoneForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form layout="vertical" form={milestoneForm}>
          <Form.Item label="里程碑标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="里程碑描述" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="截止日期" name="due_date" rules={[{ required: true, message: '请选择截止日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
