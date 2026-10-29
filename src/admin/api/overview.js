/**
 * 管理端概览 API
 * 四组数字：用户、生成、免费 token 池、反馈（md/40 §4.2）。
 */
import { adminGet } from './http'

/** 概览 `{ users, readings, tokens: { freeBudget }, feedback }` */
export function fetchAdminOverview() {
  return adminGet('/admin/overview')
}
