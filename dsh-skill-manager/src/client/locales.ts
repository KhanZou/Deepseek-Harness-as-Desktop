/** `skillManager` namespace dictionaries for the skill manager dialog. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'skillManager'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'dialog.title': '技能设置',
  'dialog.loading': '正在加载技能…',
  'dialog.failed': '技能加载失败：{message}',
  'dialog.empty': '该项目未安装任何技能。',
  'section.project': '项目技能',
  'section.global': '全局技能',
  'section.project.hint': '仅当前项目生效（.dsh/skills、.agents/skills）',
  'section.global.hint': '所有项目生效（~/.dsh/skills、~/.agents/skills）',
  'badge.dsh': '.dsh',
  'badge.agents': '.agents',
  'badge.bundled': '内置',
  'row.userOnly': '仅用户',
  'row.modelAndUser': '模型+用户',
  'toggle.enable': '启用 {name}',
  'toggle.disable': '禁用 {name}',
  'action.copy': '复制配置',
  'action.apply': '应用配置',
  'action.refresh': '刷新',
  'action.close': '关闭',
  'action.copied': '配置已复制到剪贴板',
  'action.copyFailed': '复制失败：{message}',
  'action.applied': '配置已应用到该项目',
  'action.applyFailed': '应用失败：{message}',
  'action.clipboardUnavailable': '无法读取剪贴板：{message}',
  'action.pending': '处理中…',
  'footer.project': '项目：{path}',
} satisfies Record<string, string>

/** The skillManager namespace key union. */
export type SkillManagerKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'dialog.title': 'Skill Settings',
  'dialog.loading': 'Loading skills…',
  'dialog.failed': 'Failed to load skills: {message}',
  'dialog.empty': 'No skills are installed in this project.',
  'section.project': 'Project skills',
  'section.global': 'Global skills',
  'section.project.hint': 'This project only (.dsh/skills, .agents/skills)',
  'section.global.hint': 'Every project (~/.dsh/skills, ~/.agents/skills)',
  'badge.dsh': '.dsh',
  'badge.agents': '.agents',
  'badge.bundled': 'bundled',
  'row.userOnly': 'user-only',
  'row.modelAndUser': 'model+user',
  'toggle.enable': 'Enable {name}',
  'toggle.disable': 'Disable {name}',
  'action.copy': 'Copy config',
  'action.apply': 'Apply config',
  'action.refresh': 'Refresh',
  'action.close': 'Close',
  'action.copied': 'Config copied to clipboard',
  'action.copyFailed': 'Copy failed: {message}',
  'action.applied': 'Config applied to this project',
  'action.applyFailed': 'Apply failed: {message}',
  'action.clipboardUnavailable': 'Clipboard unavailable: {message}',
  'action.pending': 'Working…',
  'footer.project': 'Project: {path}',
} satisfies Record<SkillManagerKey, string>
