import {
  Alert,
  Avatar,
  Button,
  Empty,
  Flex,
  List,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { CalendarOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/services';
import { useAuth } from '../store/auth';
import type { ProjectStatus, ProjectSummary, Tag as SkillTag, User } from '../types';
import { formatDate, projectStatusLabel } from '../utils/format';

const projectStatusColor: Record<ProjectStatus, string> = {
  RECRUITING: 'blue',
  ACTIVE: 'green',
  CLOSED: 'default',
};

interface ProfileSummary {
  user_id: number;
  username?: string;
  nickname: string;
  email?: string;
  role?: User['role'];
  created_at?: string;
}

export function UserHomePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [repositories, setRepositories] = useState<ProjectSummary[]>([]);
  const [skillTags, setSkillTags] = useState<SkillTag[]>([]);

  const parsedUserId = userId ? Number(userId) : null;
  const isValidUserId = userId ? Number.isInteger(parsedUserId) && parsedUserId > 0 : true;
  const isOwnProfile = !userId || (user ? parsedUserId === user.user_id : true);
  const targetUserId = isOwnProfile ? user?.user_id ?? null : parsedUserId;

  useEffect(() => {
    if (!isValidUserId) {
      setLoading(false);
      setProfile(null);
      setRepositories([]);
      setSkillTags([]);
      return;
    }

    if (isOwnProfile && !user) {
      setLoading(false);
      setProfile(null);
      setRepositories([]);
      setSkillTags([]);
      return;
    }

    if (!targetUserId) {
      setLoading(false);
      setProfile(null);
      setRepositories([]);
      setSkillTags([]);
      return;
    }

    const loadPageData = async () => {
      setLoading(true);
      try {
        const [allProjects, myTagData] = await Promise.all([
          api.getProjects(),
          isOwnProfile ? api.getMyTags() : Promise.resolve([] as SkillTag[]),
        ]);

        const relatedProjects = allProjects.filter(
          (project) =>
            project.leader.user_id === targetUserId ||
            project.members.some(
              (member) => member.user_id === targetUserId && member.status !== 'REJECTED',
            ),
        );

        const leaderProject = allProjects.find((project) => project.leader.user_id === targetUserId);

        const nextProfile: ProfileSummary | null = isOwnProfile && user
          ? {
              user_id: user.user_id,
              username: user.username,
              nickname: user.nickname,
              email: user.email,
              role: user.role,
              created_at: user.created_at,
            }
          : leaderProject
            ? {
                user_id: leaderProject.leader.user_id,
                username: leaderProject.leader.username,
                nickname: leaderProject.leader.nickname,
              }
            : relatedProjects.length > 0
              ? {
                  user_id: targetUserId,
                  nickname: `用户 ${targetUserId}`,
                }
              : null;

        setProfile(nextProfile);
        setRepositories(relatedProjects);
        setSkillTags(myTagData);
      } finally {
        setLoading(false);
      }
    };

    void loadPageData();
  }, [isOwnProfile, isValidUserId, targetUserId, user]);

  const repositoryStats = useMemo(() => {
    if (!targetUserId) {
      return { owned: 0, joined: 0 };
    }

    const owned = repositories.filter((project) => project.leader.user_id === targetUserId).length;
    const joined = repositories.filter(
      (project) =>
        project.leader.user_id !== targetUserId &&
        project.members.some((member) => member.user_id === targetUserId && member.status !== 'REJECTED'),
    ).length;

    return { owned, joined };
  }, [repositories, targetUserId]);

  if (loading) {
    return (
      <div className="project-list-state">
        <Spin size="large" />
      </div>
    );
  }

  if (!isValidUserId) {
    return (
      <div className="project-list-state">
        <Empty description="用户主页地址无效" />
      </div>
    );
  }

  if (isOwnProfile && !isAuthenticated) {
    return (
      <div className="page-stack">
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
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="project-list-state">
        <Empty description="暂时找不到该用户的公开主页信息" />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar-column">
          <div className="profile-card">
            <Avatar size={96} icon={<UserOutlined />} className="profile-avatar" />
            <Typography.Title level={2} className="profile-name">
              {profile.nickname}
            </Typography.Title>
            {profile.username ? (
              <Typography.Text type="secondary" className="profile-username">
                @{profile.username}
              </Typography.Text>
            ) : null}

            <div className="profile-stats">
              <div className="profile-stat-item">
                <Typography.Text strong>{repositories.length}</Typography.Text>
                <Typography.Text type="secondary">项目</Typography.Text>
              </div>
              <div className="profile-stat-item">
                <Typography.Text strong>{repositoryStats.owned}</Typography.Text>
                <Typography.Text type="secondary">创建</Typography.Text>
              </div>
              <div className="profile-stat-item">
                <Typography.Text strong>{repositoryStats.joined}</Typography.Text>
                <Typography.Text type="secondary">参与</Typography.Text>
              </div>
            </div>

            <div className="profile-meta-list">
              {profile.email ? (
                <div className="profile-meta-item">
                  <MailOutlined />
                  <span>{profile.email}</span>
                </div>
              ) : null}
              {profile.created_at ? (
                <div className="profile-meta-item">
                  <CalendarOutlined />
                  <span>加入于 {formatDate(profile.created_at)}</span>
                </div>
              ) : null}
              {profile.role ? (
                <div className="profile-meta-item">
                  <UserOutlined />
                  <span>{profile.role === 'TEACHER' ? '教师' : '学生'}</span>
                </div>
              ) : null}
            </div>

            <div className="profile-skill-section">
              <Typography.Text strong>技能标签</Typography.Text>
              <div className="profile-skill-tags">
                {isOwnProfile ? (
                  skillTags.length > 0 ? (
                    skillTags.map((tag) => (
                      <Tag key={tag.tag_id} bordered={false} className="profile-skill-tag">
                        {tag.name}
                      </Tag>
                    ))
                  ) : (
                    <Typography.Text type="secondary">暂未设置技能标签</Typography.Text>
                  )
                ) : (
                  <Typography.Text type="secondary">暂未公开技能标签</Typography.Text>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="profile-main-column">
          <div className="profile-main-header">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 4 }}>
                {isOwnProfile ? '个人主页' : `${profile.nickname} 的主页`}
              </Typography.Title>
            </div>
          </div>

          <div className="profile-repo-section">
            <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="profile-repo-header">
              <Space size="middle" wrap>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  项目
                </Typography.Title>
                {isOwnProfile ? (
                  <Link to="/projects?create=1">
                    <Button type="primary">创建项目</Button>
                  </Link>
                ) : null}
              </Space>
              <Typography.Text type="secondary">
                共 {repositories.length} 个项目
              </Typography.Text>
            </Flex>

            {repositories.length === 0 ? (
              <div className="project-list-state profile-empty-state">
                <Empty description="当前没有可展示的项目" />
              </div>
            ) : (
              <List
                className="project-rect-list profile-repo-list"
                dataSource={repositories}
                itemLayout="vertical"
                renderItem={(project) => {
                  const isOwner = project.leader.user_id === profile.user_id;

                  return (
                    <List.Item className="project-list-item profile-repo-item" style={{ padding: '22px 24px' }}>
                      <div className="profile-repo-title-row">
                        <Space wrap size="small">
                          <Link to={`/users/${project.leader.user_id}`} className="profile-inline-user-link">
                            <Space size={8}>
                              <Avatar size={20} icon={<UserOutlined />} />
                              <span>{project.leader.nickname}</span>
                            </Space>
                          </Link>
                          <Typography.Text type="secondary">/</Typography.Text>
                          <Link to={`/projects/${project.project_id}`} className="profile-repo-name-link">
                            {project.title}
                          </Link>
                        </Space>
                        <Space wrap>
                          <Tag color={projectStatusColor[project.status]} style={{ margin: 0 }}>
                            {projectStatusLabel[project.status]}
                          </Tag>
                          {isOwner ? <Tag style={{ margin: 0 }}>队长</Tag> : <Tag style={{ margin: 0 }}>队员</Tag>}
                        </Space>
                      </div>

                      <Typography.Paragraph type="secondary" className="profile-repo-description">
                        {project.description || '暂无项目描述'}
                      </Typography.Paragraph>

                      <Flex gap="large" wrap="wrap" className="profile-repo-meta">
                        <Space>
                          <Typography.Text type="secondary">截止日期：</Typography.Text>
                          <Typography.Text>{formatDate(project.deadline)}</Typography.Text>
                        </Space>
                        <Space>
                          <Typography.Text type="secondary">成员：</Typography.Text>
                          <Typography.Text>
                            {project.member_count}/{project.max_members}
                          </Typography.Text>
                        </Space>
                        <Space>
                          <Typography.Text type="secondary">任务：</Typography.Text>
                          <Typography.Text>{project.task_count}</Typography.Text>
                        </Space>
                      </Flex>

                      {project.tags.length > 0 ? (
                        <Space wrap className="profile-repo-tags">
                          {project.tags.map((tag) => (
                            <Tag key={tag.tag_id} bordered={false} className="profile-skill-tag">
                              {tag.name}
                            </Tag>
                          ))}
                        </Space>
                      ) : null}
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
