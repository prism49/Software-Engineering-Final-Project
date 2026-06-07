import { describe, it, expect } from 'vitest';
import {
  formatDate,
  toDatePickerValue,
  projectStatusLabel,
  taskStatusLabel,
  milestoneStatusLabel,
} from '../utils/format';

describe('formatDate', () => {
  it('返回 ISO 日期格式', () => {
    expect(formatDate('2026-06-01')).toBe('2026-06-01');
  });

  it('自定义格式 YYYY/MM/DD', () => {
    expect(formatDate('2026-06-01', 'YYYY/MM/DD')).toBe('2026/06/01');
  });

  it('undefined 返回"未设置"', () => {
    expect(formatDate(undefined)).toBe('未设置');
  });

  it('null 返回"未设置"', () => {
    expect(formatDate(null)).toBe('未设置');
  });

  it('空字符串返回"未设置"', () => {
    expect(formatDate('')).toBe('未设置');
  });

  it('解析完整时间戳', () => {
    const result = formatDate('2026-06-01T10:30:00Z', 'YYYY-MM-DD HH:mm');
    expect(result).toContain('2026-06-01');
  });
});

describe('toDatePickerValue', () => {
  it('有效日期返回 dayjs 对象', () => {
    const result = toDatePickerValue('2026-06-01');
    expect(result).not.toBeNull();
    expect(result!.format('YYYY-MM-DD')).toBe('2026-06-01');
  });

  it('null 返回 null', () => {
    expect(toDatePickerValue(null)).toBeNull();
  });

  it('undefined 返回 null', () => {
    expect(toDatePickerValue(undefined)).toBeNull();
  });
});

describe('状态标签常量', () => {
  it('projectStatusLabel 包含所有项目状态', () => {
    expect(projectStatusLabel).toEqual({
      RECRUITING: '招募中',
      ACTIVE: '进行中',
      CLOSED: '已关闭',
    });
  });

  it('taskStatusLabel 包含所有任务状态', () => {
    expect(taskStatusLabel).toEqual({
      TODO: '待领取',
      DOING: '进行中',
      REVIEW: '待审核',
      DONE: '已完成',
    });
  });

  it('milestoneStatusLabel 包含所有里程碑状态', () => {
    expect(milestoneStatusLabel).toEqual({
      ACTIVE: '进行中',
      COMPLETED: '已完成',
    });
  });
});