import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
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
  Progress,
  Rate,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
  Modal,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BarChartOutlined,
  CommentOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  ContributionItem,
  CreateMilestonePayload,
  CreateTaskPayload,
  ProjectDetail,
  ProjectMemberDetail,
  ProjectReview,
  ProjectStatus,
  ReportCharts,
  Tag as TagItem,
  TaskItem,
} from '../types';
import { api } from '../api/services';
import { useAuth } from '../store/auth';
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function truncateText(value: string, maxLength: number) {
  const chars = Array.from(value);
  if (chars.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: `${chars.slice(0, maxLength).join('')}...`,
    truncated: true,
  };
}

function renderTruncatedText(
  value: string | null | undefined,
  maxLength: number,
  fallback: string,
  options?: {
    type?: 'secondary';
    strong?: boolean;
    block?: boolean;
    style?: React.CSSProperties;
  },
) {
  const content = value?.trim() ? value : fallback;
  const { text, truncated } = truncateText(content, maxLength);
  const textNode = (
    <Typography.Text
      type={options?.type}
      strong={options?.strong}
      style={{ ...(options?.block ? { display: 'block' } : undefined), ...options?.style }}
    >
      {text}
    </Typography.Text>
  );

  return truncated ? <Tooltip title={content}>{textNode}</Tooltip> : textNode;
}

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  const [reportCharts, setReportCharts] = useState<ReportCharts | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editingReview, setEditingReview] = useState<ProjectReview | null>(null);
  const [taskMilestoneFilter, setTaskMilestoneFilter] = useState<string>('all');
  const [projectForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [milestoneForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [applyForm] = Form.useForm<{ apply_reason?: string }>();

  const numericProjectId = Number(projectId);

  const loadData = useCallback(async () => {
    if (!numericProjectId) {
      return;
    }

    setLoading(true);
    setAnalyticsLoading(true);
    try {
      const [projectData, taskData, tagData] = await Promise.all([
        api.getProject(numericProjectId),
        api.getTasksByProject(numericProjectId),
        api.getTags(),
      ]);

      setProject(projectData);
      setTasks(taskData);
      setAllTags(tagData);

      if (isAuthenticated) {
        try {
          const reviewData = await api.getProjectReviews(numericProjectId);
          setReviews(reviewData);
          setReviewError(null);
        } catch (error) {
          setReviews([]);
          setReviewError(getErrorMessage(error));
        }
      } else {
        setReviews([]);
        setReviewError('登录后可查看互评详情');
      }

      if (projectData.status === 'CLOSED') {
        const [contributionResult, reportResult] = await Promise.allSettled([
          api.getProjectContributions(numericProjectId),
          api.getProjectReportCharts(numericProjectId),
        ]);

        if (contributionResult.status === 'fulfilled') {
          setContributions(contributionResult.value);
          setContributionError(null);
        } else {
          setContributions([]);
          setContributionError(getErrorMessage(contributionResult.reason));
        }

        if (reportResult.status === 'fulfilled') {
          setReportCharts(reportResult.value);
          setReportError(null);
        } else {
          setReportCharts(null);
          setReportError(getErrorMessage(reportResult.reason));
        }
      } else {
        setContributions([]);
        setReportCharts(null);
        setContributionError('项目关闭后可查看贡献度');
        setReportError('项目关闭且完成互评后可查看报表');
      }
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setAnalyticsLoading(false);
    }
  }, [isAuthenticated, messageApi, numericProjectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (taskMilestoneFilter === 'all' || taskMilestoneFilter === 'none') {
      return;
    }

    const hasMatchedMilestone = project?.milestones.some(
      (milestone) => String(milestone.milestone_id) === taskMilestoneFilter,
    );

    if (!hasMatchedMilestone) {
      setTaskMilestoneFilter('all');
    }
  }, [project?.milestones, taskMilestoneFilter]);

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
  const reviewTargets = useMemo(
    () => approvedMembers.filter((member) => member.user_id !== user?.user_id),
    [approvedMembers, user],
  );
  const ownEditableReviews = useMemo(
    () =>
      user?.role === 'TEACHER'
        ? reviews.filter((review) => review.reviewer?.user_id === user?.user_id)
        : [],
    [reviews, user],
  );
  const canCreateReview = Boolean(
    isApprovedMember && project?.status === 'CLOSED' && reviewTargets.length > 0,
  );
  const currentMembership = project?.members.find((member) => member.user_id === user?.user_id);
  const getUserHomePath = useCallback(
    (memberUserId: number) => (user?.user_id === memberUserId ? '/my-projects' : `/users/${memberUserId}`),
    [user],
  );
  const showApplyButton = Boolean(
    project &&
      (!user ||
        (project.leader.user_id !== user.user_id && currentMembership?.status !== 'APPROVED')),
  );
  const milestoneFilterOptions = useMemo(
    () => [
      { value: 'all', label: `全部任务 (${tasks.length})` },
      { value: 'none', label: `未关联里程碑 (${tasks.filter((task) => !task.milestone).length})` },
      ...(project?.milestones.map((milestone) => ({
        value: String(milestone.milestone_id),
        label: `${truncateText(milestone.title, 10).text} (${tasks.filter((task) => task.milestone?.milestone_id === milestone.milestone_id).length})`,
      })) ?? []),
    ],
    [project?.milestones, tasks],
  );
  const filteredTasks = useMemo(() => {
    if (taskMilestoneFilter === 'all') {
      return tasks;
    }

    if (taskMilestoneFilter === 'none') {
      return tasks.filter((task) => !task.milestone);
    }

    const milestoneId = Number(taskMilestoneFilter);
    return tasks.filter((task) => task.milestone?.milestone_id === milestoneId);
  }, [taskMilestoneFilter, tasks]);
  const milestoneTaskProgress = useMemo(() => {
    const progressMap = new Map<
      number,
      {
        total: number;
        done: number;
        percent: number;
      }
    >();

    tasks.forEach((task) => {
      const milestoneId = task.milestone?.milestone_id;
      if (!milestoneId) {
        return;
      }

      const current = progressMap.get(milestoneId) ?? { total: 0, done: 0, percent: 0 };
      current.total += 1;
      if (task.status === 'DONE') {
        current.done += 1;
      }
      current.percent = Math.round((current.done / current.total) * 100);
      progressMap.set(milestoneId, current);
    });

    return progressMap;
  }, [tasks]);

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
      description: milestone?.description ?? undefined,
      due_date: toDatePickerValue(milestone?.due_date),
    });
    setMilestoneModalOpen(true);
  };

  const openCreateReviewModal = (target?: ProjectMemberDetail) => {
    setEditingReview(null);
    reviewForm.setFieldsValue({
      target_id: target?.user_id,
      score: 5,
      content: '',
    });
    setReviewModalOpen(true);
  };

  const openEditReviewModal = (review: ProjectReview) => {
    setEditingReview(review);
    reviewForm.setFieldsValue({
      target_id: review.target?.user_id,
      score: review.score,
      content: review.content ?? '',
    });
    setReviewModalOpen(true);
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
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
    }
  };

  const handleReviewSubmit = async () => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const values = await reviewForm.validateFields();
      if (editingReview) {
        const result = await api.updateProjectReview(editingReview.review_id, {
          score: values.score,
          content: values.content,
        });
        messageApi.success(result.message);
      } else {
        const result = await api.createProjectReview(project.project_id, {
          target_id: values.target_id,
          score: values.score,
          content: values.content,
        });
        messageApi.success(result.message);
      }

      setReviewModalOpen(false);
      setEditingReview(null);
      reviewForm.resetFields();
      await loadData();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
    }
  };

  const handleMemberApprove = async (
    member: ProjectMemberDetail,
    status: 'APPROVED' | 'REJECTED',
  ) => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const result = await api.approveMember(project.project_id, member.user_id, status);
      messageApi.success(result.message);
      await loadData();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
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
      messageApi.error(getErrorMessage(error));
    }
  };

  const handleExportReport = async () => {
    if (!project) {
      return;
    }

    try {
      const blob = await api.exportProjectReport(project.project_id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project-${project.project_id}-report.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      messageApi.success('报表开始下载');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const handleApplyToProject = async () => {
    if (!project || !requireLogin()) {
      return;
    }

    try {
      const values = await applyForm.validateFields();
      const result = await api.applyToProject(project.project_id, values.apply_reason);
      messageApi.success(result.message);
      setApplyOpen(false);
      applyForm.resetFields();
      await loadData();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const handleTryOpenApplyModal = () => {
    if (!project) {
      return;
    }

    const approvedCount = approvedMembers.length;

    if (!isAuthenticated) {
      modalApi.info({
        title: '当前无法申请加入',
        content: '请先登录后再申请加入该项目。',
        okText: '知道了',
      });
      return;
    }

    if (project.status !== 'RECRUITING') {
      modalApi.info({
        title: '当前无法申请加入',
        content: '项目状态不是“招募中”，暂时不能申请加入。',
        okText: '知道了',
      });
      return;
    }

    if (approvedCount >= project.max_members) {
      modalApi.info({
        title: '当前无法申请加入',
        content: '项目人员已满，暂时不能继续申请加入。',
        okText: '知道了',
      });
      return;
    }

    if (currentMembership?.status === 'APPROVED') {
      modalApi.info({
        title: '当前无法申请加入',
        content: '你已经是该项目成员，无需重复申请。',
        okText: '知道了',
      });
      return;
    }

    if (currentMembership?.status === 'PENDING') {
      modalApi.info({
        title: '当前无法申请加入',
        content: '你已提交过申请，请等待队长审批。',
        okText: '知道了',
      });
      return;
    }

    applyForm.resetFields();
    setApplyOpen(true);
  };

  const taskColumns: ColumnsType<TaskItem> = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (_, task) => (
        <Space direction="vertical" size={2}>
          {renderTruncatedText(task.title, 10, '未命名任务', { strong: true })}
          {renderTruncatedText(task.description, 30, '暂无描述', { type: 'secondary' })}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_status: TaskItem['status'], record: TaskItem) => (
        <Tag color={record.is_overdue ? 'error' : taskStatusColor[record.status]}>
          {record.is_overdue ? '已过期' : taskStatusLabel[record.status]}
        </Tag>
      ),
    },
    {
      title: '执行人',
      key: 'assignee',
      render: (_, task) => task.assignee?.nickname || '未认领',
    },
    {
      title: '里程碑',
      key: 'milestone',
      render: (_, task) =>
        task.milestone
          ? renderTruncatedText(task.milestone.title, 10, '无')
          : '无',
    },
    {
      title: '截止日期',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (value: string | null) => formatDate(value),
    },
    {
      title: '任务分值',
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
            <Button
              size="small"
              type="primary"
              onClick={() => void handleTaskStatusChange(task.task_id, 'DOING')}
            >
              认领
            </Button>
          )}
          {task.status === 'DOING' && task.assignee?.user_id === user?.user_id && (
            <Button
              size="small"
              onClick={() => void handleTaskStatusChange(task.task_id, 'REVIEW')}
            >
              提交审核
            </Button>
          )}
          {isApprovedMember &&
            task.status === 'REVIEW' &&
            task.assignee?.user_id !== user?.user_id && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => void handleTaskReview(task.task_id, 'DONE')}
                >
                  通过
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => void handleTaskReview(task.task_id, 'DOING')}
                >
                  打回
                </Button>
              </>
            )}
          {isApprovedMember && (
            <Popconfirm
              title="确认删除这个任务吗？"
              onConfirm={() => void handleTaskDelete(task.task_id)}
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const teacherReviewColumns: ColumnsType<ProjectReview> = [
    {
      title: '评分人',
      key: 'reviewer',
      render: (_, review) => review.reviewer?.nickname ?? '-',
    },
    {
      title: '被评人',
      key: 'target',
      render: (_, review) => review.target?.nickname ?? '-',
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <Space>
          <Rate disabled value={score} />
          <Typography.Text>{score}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '评语',
      dataIndex: 'content',
      key: 'content',
      render: (content: string | null) => content || '无',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, review) =>
        review.reviewer?.user_id === user?.user_id ? (
          <Button type="link" onClick={() => openEditReviewModal(review)}>
            修改
          </Button>
        ) : (
          <Typography.Text type="secondary">只读</Typography.Text>
        ),
    },
  ];

  const contributionColumns: ColumnsType<ContributionItem> = [
    {
      title: '成员',
      key: 'nickname',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.nickname}</Typography.Text>
          <Typography.Text type="secondary">@{item.username}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '完成任务数',
      dataIndex: 'tasks_done',
      key: 'tasks_done',
    },
    {
      title: '任务权重和',
      dataIndex: 'total_weight',
      key: 'total_weight',
    },
    {
      title: '互评均分',
      dataIndex: 'avg_score',
      key: 'avg_score',
    },
    {
      title: '贡献度',
      dataIndex: 'contribution',
      key: 'contribution',
      render: (value: number) => <Progress percent={value} size="small" />,
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
      {modalContextHolder}

      <Breadcrumb
        items={[
          {
            title: <Link to="/projects">项目大厅</Link>,
          },
          {
            title: (
              <Tooltip title={project.title}>
                <span>{truncateText(project.title, 10).text}</span>
              </Tooltip>
            ),
          },
        ]}
      />

      <Card variant="borderless" className="page-hero-card">
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <div>
            <Space wrap align="center" size="middle">
              <Typography.Title level={2} style={{ margin: 0 }}>
                {(() => {
                  const { text, truncated } = truncateText(project.title, 10);
                  const titleNode = <span>{text}</span>;

                  return truncated ? <Tooltip title={project.title}>{titleNode}</Tooltip> : titleNode;
                })()}
              </Typography.Title>
              <Tag
                color={project.is_overdue ? 'error' : projectStatusColor[project.status]}
                style={{ margin: 0, fontSize: 14, padding: '4px 12px' }}
              >
                {project.is_overdue ? '已过期' : projectStatusLabel[project.status]}
              </Tag>
            </Space>
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 12, marginBottom: 0, fontSize: 15 }}
            >
              {renderTruncatedText(project.description, 30, '暂无项目描述')}
            </Typography.Paragraph>
          </div>

          <Space wrap size="middle">
            {isLeader && (
              <Button icon={<EditOutlined />} onClick={openProjectModal} size="large">
                编辑项目
              </Button>
            )}
            {showApplyButton && (
              <Button
                type="primary"
                onClick={handleTryOpenApplyModal}
                size="large"
              >
                申请加入
              </Button>
            )}
            {isApprovedMember && (
              <>
                <Button onClick={() => openMilestoneModal()} size="large">
                  新建里程碑
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openTaskModal()}
                  size="large"
                >
                  新建任务
                </Button>
              </>
            )}
          </Space>
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17} xxl={18}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless" title="项目概览">
              <Descriptions
                column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
                size="middle"
              >
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
                  <Typography.Text strong>
                    {approvedMembers.length}/{project.max_members}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="项目标签" span={2}>
                  <Space wrap size={[0, 8]}>
                    {project.tags.length > 0 ? (
                      project.tags.map((tag) => (
                        <Tag
                          key={tag.tag_id}
                          bordered={false}
                          style={{ background: 'rgba(255, 255, 255, 0.58)', color: '#475569' }}
                        >
                          {tag.name}
                        </Tag>
                      ))
                    ) : (
                      <Typography.Text type="secondary">暂无标签</Typography.Text>
                    )}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              variant="borderless"
              title="任务管理"
              extra={
                <Space wrap size="middle">
                  <Typography.Text type="secondary">
                    当前显示 {filteredTasks.length} / {tasks.length}
                  </Typography.Text>
                  <Select
                    value={taskMilestoneFilter}
                    onChange={setTaskMilestoneFilter}
                    options={milestoneFilterOptions}
                    style={{ minWidth: 220 }}
                    popupMatchSelectWidth={false}
                  />
                </Space>
              }
              styles={{ body: { padding: 0 } }}
            >
              <Table
                rowKey="task_id"
                dataSource={filteredTasks}
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
                    (() => {
                      const milestoneProgress = milestoneTaskProgress.get(milestone.milestone_id);

                      return (
                    <List.Item
                      style={{ padding: '20px 24px' }}
                      actions={
                        isApprovedMember
                          ? [
                              <Button
                                key="edit"
                                type="text"
                                onClick={() => openMilestoneModal(milestone.milestone_id)}
                              >
                                编辑
                              </Button>,
                              <Button
                                key="complete"
                                type="text"
                                disabled={milestone.status === 'COMPLETED'}
                                onClick={() =>
                                  void handleMilestoneAction(milestone.milestone_id, 'complete')
                                }
                              >
                                标记完成
                              </Button>,
                              <Popconfirm
                                key="delete"
                                title="确认删除这个里程碑吗？"
                                onConfirm={() =>
                                  void handleMilestoneAction(milestone.milestone_id, 'delete')
                                }
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
                            {renderTruncatedText(milestone.title, 10, '未命名里程碑', {
                              strong: true,
                              style: { fontSize: 16 },
                            })}
                            <Tag
                              color={
                                milestone.is_overdue
                                  ? 'error'
                                  : milestone.status === 'COMPLETED'
                                    ? 'success'
                                    : 'processing'
                              }
                              style={{ margin: 0 }}
                            >
                              {milestone.is_overdue ? '已过期' : milestoneStatusLabel[milestone.status]}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary">
                              截止日期：{formatDate(milestone.due_date)}
                            </Typography.Text>
                            {renderTruncatedText(milestone.description, 30, '暂无描述', {
                              type: 'secondary',
                              block: true,
                            })}
                            {milestoneProgress && (
                              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                <Typography.Text type="secondary">
                                  任务进度：{milestoneProgress.done}/{milestoneProgress.total}
                                </Typography.Text>
                                <Progress percent={milestoneProgress.percent} size="small" />
                              </Space>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                      );
                    })()
                  )}
                />
              )}
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={7} xxl={6}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card variant="borderless" title="项目成员">
              <List
                dataSource={project.members}
                locale={{ emptyText: '暂无成员' }}
                renderItem={(member) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Link to={getUserHomePath(member.user_id)} className="project-user-link">
                            <Space size={8} className="project-user-link-inner">
                              <Avatar size={20} icon={<UserOutlined />} />
                              <span className="project-user-link-text">{member.nickname}</span>
                            </Space>
                          </Link>
                          <Tag bordered={false}>{member.role}</Tag>
                          <Tag
                            bordered={false}
                            color={member.status === 'APPROVED' ? 'success' : 'warning'}
                          >
                            {member.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        member.status === 'APPROVED'
                          ? `@${member.username} · 加入时间：${formatDate(member.joined_at)}`
                          : `@${member.username}`
                      }
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
                    <Card
                      key={member.user_id}
                      size="small"
                      type="inner"
                      style={{ background: 'rgba(255, 255, 255, 0.46)' }}
                    >
                      <Flex justify="space-between" align="center">
                        <div>
                          <Typography.Text strong>{member.nickname}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            @{member.username}
                          </Typography.Paragraph>
                        </div>
                        {isLeader && (
                          <Space>
                            <Button
                              size="small"
                              type="primary"
                              ghost
                              style={{ color: '#ffffff', borderColor: '#ffffff' }}
                              onClick={() => void handleMemberApprove(member, 'APPROVED')}
                            >
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

      <Card
        variant="borderless"
        title="双盲互评、贡献度与报表"
        extra={
          project.status === 'CLOSED' ? (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => void handleExportReport()}
            >
              导出 Excel
            </Button>
          ) : null
        }
      >
        <Tabs
          items={[
            {
              key: 'reviews',
              label: (
                <Space size={6}>
                  <CommentOutlined />
                  <span>双盲互评</span>
                </Space>
              ),
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {!isAuthenticated && (
                    <Alert
                      type="info"
                      showIcon
                      message="登录后可查看互评详情，并在项目关闭后参与互评。"
                    />
                  )}

                  {isAuthenticated && !isApprovedMember && (
                    <Alert
                      type="warning"
                      showIcon
                      message="只有项目已批准成员可以参与互评。"
                    />
                  )}

                  {canCreateReview && (
                    <Card type="inner" title="提交互评">
                      <Typography.Text type="secondary">
                        项目关闭后，团队成员需要对其他每位成员进行评分。你可以从下面快速选择成员发起评分。
                      </Typography.Text>
                      <Space wrap style={{ marginTop: 16 }}>
                        {reviewTargets.map((member) => {
                          const editableReview = ownEditableReviews.find(
                            (review) => review.target?.user_id === member.user_id,
                          );
                          return (
                            <Button
                              key={member.user_id}
                              type={editableReview ? 'default' : 'primary'}
                              ghost={Boolean(editableReview)}
                              onClick={() =>
                                editableReview
                                  ? openEditReviewModal(editableReview)
                                  : openCreateReviewModal(member)
                              }
                            >
                              {editableReview
                                ? `修改对 ${member.nickname} 的评分`
                                : `评价 ${member.nickname}`}
                            </Button>
                          );
                        })}
                      </Space>
                      {user?.role === 'TEACHER' ? (
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 16, marginBottom: 0 }}
                        >
                          教师端可查看全量互评记录；若你提交过评分，也可以在下方记录表中继续修改。
                        </Typography.Paragraph>
                      ) : (
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 16, marginBottom: 0 }}
                        >
                          学生端当前只能看到自己收到的匿名互评；如果你已提交过同一成员的评分，再次提交时后端会返回冲突提示。
                        </Typography.Paragraph>
                      )}
                    </Card>
                  )}

                  {isAuthenticated &&
                    isApprovedMember &&
                    project.status !== 'CLOSED' && (
                      <Alert
                        type="info"
                        showIcon
                        message="项目关闭后才可提交互评。关闭项目时，所有任务必须为 DONE。"
                      />
                    )}

                  <Card
                    type="inner"
                    title={user?.role === 'TEACHER' ? '项目互评记录' : '我收到的匿名互评'}
                  >
                    {reviewError ? (
                      <Alert
                        type={isAuthenticated ? 'warning' : 'info'}
                        showIcon
                        message={reviewError}
                      />
                    ) : reviews.length === 0 ? (
                      <Empty description="当前暂无可展示的互评数据" />
                    ) : user?.role === 'TEACHER' ? (
                      <Table
                        rowKey="review_id"
                        dataSource={reviews}
                        columns={teacherReviewColumns}
                        pagination={{ pageSize: 5 }}
                        scroll={{ x: 900 }}
                      />
                    ) : (
                      <List
                        dataSource={reviews}
                        renderItem={(review) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Rate disabled value={review.score} />
                                  <Typography.Text>{review.score} 分</Typography.Text>
                                </Space>
                              }
                              description={
                                <Space direction="vertical" size={4}>
                                  <Typography.Text type="secondary">
                                    {review.content || '无评语'}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">
                                    时间：{formatDate(review.created_at, 'YYYY-MM-DD HH:mm')}
                                  </Typography.Text>
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    )}
                  </Card>
                </Space>
              ),
            },
            {
              key: 'contributions',
              label: (
                <Space size={6}>
                  <BarChartOutlined />
                  <span>贡献度</span>
                </Space>
              ),
              children:
                project.status !== 'CLOSED' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="项目关闭后才展示贡献度结果。"
                  />
                ) : analyticsLoading ? (
                  <div className="center-box">
                    <Spin size="large" />
                  </div>
                ) : contributionError ? (
                  <Alert type="warning" showIcon message={contributionError} />
                ) : contributions.length === 0 ? (
                  <Empty description="暂无贡献度数据" />
                ) : (
                  <Table
                    rowKey="user_id"
                    dataSource={contributions}
                    columns={contributionColumns}
                    pagination={false}
                    scroll={{ x: 760 }}
                  />
                ),
            },
            {
              key: 'report',
              label: (
                <Space size={6}>
                  <DownloadOutlined />
                  <span>报表</span>
                </Space>
              ),
              children:
                project.status !== 'CLOSED' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="项目关闭且成员完成互评后，可查看报表与导出 Excel。"
                  />
                ) : analyticsLoading ? (
                  <div className="center-box">
                    <Spin size="large" />
                  </div>
                ) : reportError ? (
                  <Alert type="warning" showIcon message={reportError} />
                ) : !reportCharts ? (
                  <Empty description="暂无报表数据" />
                ) : (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {(
                        [
                          ['TODO', reportCharts.taskStatusCount.TODO],
                          ['DOING', reportCharts.taskStatusCount.DOING],
                          ['REVIEW', reportCharts.taskStatusCount.REVIEW],
                          ['DONE', reportCharts.taskStatusCount.DONE],
                        ] as const
                      ).map(([status, count]) => (
                        <Col xs={24} sm={12} xl={6} key={status}>
                          <Card type="inner">
                            <Statistic title={`任务 ${status}`} value={count} />
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={12}>
                        <Card type="inner" title="成员任务统计">
                          <List
                            dataSource={reportCharts.memberTaskStats}
                            renderItem={(item) => (
                              <List.Item>
                                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                  <Flex justify="space-between">
                                    <Typography.Text strong>{item.nickname}</Typography.Text>
                                    <Typography.Text type="secondary">
                                      DONE {item.DONE} / TOTAL{' '}
                                      {item.TODO + item.DOING + item.REVIEW + item.DONE}
                                    </Typography.Text>
                                  </Flex>
                                  <Progress
                                    percent={
                                      item.TODO + item.DOING + item.REVIEW + item.DONE > 0
                                        ? Math.round(
                                            (item.DONE /
                                              (item.TODO +
                                                item.DOING +
                                                item.REVIEW +
                                                item.DONE)) *
                                              100,
                                          )
                                        : 0
                                    }
                                  />
                                  <Space wrap>
                                    <Tag>TODO {item.TODO}</Tag>
                                    <Tag color="processing">DOING {item.DOING}</Tag>
                                    <Tag color="warning">REVIEW {item.REVIEW}</Tag>
                                    <Tag color="success">DONE {item.DONE}</Tag>
                                  </Space>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Col>

                      <Col xs={24} xl={12}>
                        <Card type="inner" title="互评摘要">
                          <List
                            dataSource={reportCharts.reviewSummary}
                            renderItem={(item) => (
                              <List.Item>
                                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                  <Flex justify="space-between">
                                    <Typography.Text strong>{item.nickname}</Typography.Text>
                                    <Typography.Text>{item.avg_score.toFixed(2)} 分</Typography.Text>
                                  </Flex>
                                  <Progress percent={Math.round((item.avg_score / 5) * 100)} />
                                  <Typography.Text type="secondary">
                                    被评分次数：{item.count}
                                  </Typography.Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={12}>
                        <Card type="inner" title="里程碑进度">
                          {reportCharts.milestoneProgress.length === 0 ? (
                            <Empty description="暂无里程碑数据" />
                          ) : (
                            <List
                              dataSource={reportCharts.milestoneProgress}
                              renderItem={(milestone) => (
                                <List.Item>
                                  <List.Item.Meta
                                    title={
                                      <Space>
                                        <Typography.Text strong>
                                          {milestone.title}
                                        </Typography.Text>
                                        <Tag
                                          color={
                                            milestone.is_overdue
                                              ? 'error'
                                              : milestone.status === 'COMPLETED'
                                                ? 'success'
                                                : 'processing'
                                          }
                                        >
                                          {milestone.is_overdue ? '已过期' : milestoneStatusLabel[milestone.status]}
                                        </Tag>
                                      </Space>
                                    }
                                    description={`截止日期：${formatDate(milestone.due_date)}`}
                                  />
                                </List.Item>
                              )}
                            />
                          )}
                        </Card>
                      </Col>

                      <Col xs={24} xl={12}>
                        <Card type="inner" title="贡献度快照">
                          <List
                            dataSource={reportCharts.contributions}
                            renderItem={(item) => (
                              <List.Item>
                                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                  <Flex justify="space-between">
                                    <Typography.Text strong>{item.nickname}</Typography.Text>
                                    <Typography.Text>{item.contribution}%</Typography.Text>
                                  </Flex>
                                  <Progress percent={item.contribution} />
                                  <Typography.Text type="secondary">
                                    已完成任务 {item.tasks_done} 个，权重和 {item.total_weight}，
                                    互评均分 {item.avg_score}
                                  </Typography.Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        title="申请加入项目"
        open={applyOpen}
        onOk={() => void handleApplyToProject()}
        onCancel={() => {
          setApplyOpen(false);
          applyForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form layout="vertical" form={applyForm}>
          <Form.Item label="申请理由" name="apply_reason">
            <Input.TextArea rows={4} placeholder="介绍一下你能为这个项目带来的帮助" maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑项目"
        open={projectModalOpen}
        onOk={() => void handleProjectUpdate()}
        onCancel={() => setProjectModalOpen(false)}
        destroyOnHidden
      >
        <Form layout="vertical" form={projectForm}>
          <Form.Item
            label="项目名称"
            name="title"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            label="项目状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { value: 'RECRUITING', label: '招募中' },
                { value: 'ACTIVE', label: '进行中' },
                { value: 'CLOSED', label: '已关闭' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="截止日期"
            name="deadline"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
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
          <Form.Item
            label="任务标题"
            name="title"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
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
          <Form.Item
            label="权重"
            name="weight"
            rules={[{ required: true, message: '请输入权重' }]}
          >
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
          <Form.Item
            label="里程碑标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="里程碑描述" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            label="截止日期"
            name="due_date"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingReview ? '修改评分' : '提交互评'}
        open={reviewModalOpen}
        onOk={() => void handleReviewSubmit()}
        onCancel={() => {
          setReviewModalOpen(false);
          setEditingReview(null);
          reviewForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form layout="vertical" form={reviewForm} initialValues={{ score: 5 }}>
          {editingReview ? (
            <Form.Item label="被评成员">
              <Input value={editingReview.target?.nickname ?? '当前记录'} disabled />
            </Form.Item>
          ) : (
            <Form.Item
              label="被评成员"
              name="target_id"
              rules={[{ required: true, message: '请选择被评成员' }]}
            >
              <Select
                options={reviewTargets.map((member) => ({
                  value: member.user_id,
                  label: `${member.nickname} (@${member.username})`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            label="评分"
            name="score"
            rules={[{ required: true, message: '请选择评分' }]}
          >
            <Rate count={5} />
          </Form.Item>
          <Form.Item label="评语" name="content">
            <Input.TextArea rows={4} placeholder="可选，补充你的评价内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
