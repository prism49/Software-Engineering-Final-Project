import dayjs from 'dayjs';

export function formatDate(value?: string | null, format = 'YYYY-MM-DD') {
  if (!value) {
    return '未设置';
  }
  return dayjs(value).format(format);
}

export function toDatePickerValue(value?: string | null) {
  return value ? dayjs(value) : null;
}

export const projectStatusLabel = {
  RECRUITING: '招募中',
  ACTIVE: '进行中',
  CLOSED: '已关闭',
} as const;

export const taskStatusLabel = {
  TODO: '待领取',
  DOING: '进行中',
  REVIEW: '待审核',
  DONE: '已完成',
} as const;

export const milestoneStatusLabel = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
} as const;
