import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MatchDetail, MatchListItem, MatchListQuery, MatchSort } from '@shared/types/match'
import type { CancelMatchResult, JoinResult, LeaveResult } from '@shared/types/match'
import { api } from '../api'
import { errorMessage } from '../utils/error'

// 原型里的 5 个 chip，加上「水平合适」（走 fit=me）
export type FilterKey = 'today' | 'weekend' | 'free' | 'beginnerFriendly' | 'friendlyLevel'

export const DEFAULT_CITY = '深圳'
const PAGE_SIZE = 9
// 切一个 chip 就重新拉全量：候选集已被「城市 + 时间窗 + 水平」压到几百条量级
let requestSeq = 0

export const useMatchesStore = defineStore('matches', () => {
  // —— 列表查询条件：放 store 里，从详情页返回时筛选状态不丢 ——
  const city = ref(DEFAULT_CITY)
  const filters = ref<FilterKey[]>([])
  const sort = ref<MatchSort>('recommend')

  const items = ref<MatchListItem[]>([])
  const total = ref(0)
  const hasMore = ref(false)
  const page = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // —— 详情 ——
  const detail = ref<MatchDetail | null>(null)
  const detailLoading = ref(false)

  // 报名成功后播一次脉冲动画的卡片 id
  const pulseId = ref<number | null>(null)

  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  function hasFilter(key: FilterKey): boolean {
    return filters.value.includes(key)
  }

  function buildQuery(): MatchListQuery {
    return {
      city: city.value.trim() || undefined,
      datePreset: hasFilter('today') ? 'today' : hasFilter('weekend') ? 'weekend' : undefined,
      free: hasFilter('free') ? true : undefined,
      beginnerFriendly: hasFilter('beginnerFriendly') ? true : undefined,
      fit: hasFilter('friendlyLevel') ? 'me' : undefined,
      sort: sort.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    }
  }

  // 列表与详情是两份数据，任何字段变更都要同步，否则返回列表会看到旧人数
  function patch(id: number, changes: Partial<MatchListItem>): void {
    const item = items.value.find((candidate) => candidate.id === id)
    if (item) Object.assign(item, changes)
    if (detail.value?.id === id) Object.assign(detail.value, changes)
  }

  function snapshot(id: number): Partial<MatchListItem> | null {
    const source = items.value.find((candidate) => candidate.id === id) ?? detail.value
    if (!source || source.id !== id) return null
    return {
      participantCount: source.participantCount,
      isFull: source.isFull,
      spotsLeft: source.spotsLeft,
      status: source.status,
    }
  }

  async function fetchList(): Promise<void> {
    const seq = (requestSeq += 1)
    loading.value = true
    error.value = null
    try {
      const result = await api.matches.list(buildQuery())
      // 快速连点 chip 时丢弃过期响应，避免旧结果覆盖新结果
      if (seq !== requestSeq) return
      items.value = result.items
      total.value = result.total
      hasMore.value = result.hasMore
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = errorMessage(caught)
      items.value = []
      total.value = 0
      hasMore.value = false
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value) return
    page.value += 1
    const seq = (requestSeq += 1)
    loading.value = true
    try {
      const result = await api.matches.list(buildQuery())
      if (seq !== requestSeq) return
      items.value = [...items.value, ...result.items]
      hasMore.value = result.hasMore
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = errorMessage(caught)
      page.value -= 1
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  function applyFilters(next: FilterKey[]): Promise<void> {
    filters.value = next
    page.value = 1
    return fetchList()
  }

  function setCity(next: string): Promise<void> {
    city.value = next
    page.value = 1
    return fetchList()
  }

  function setSort(next: MatchSort): Promise<void> {
    sort.value = next
    page.value = 1
    return fetchList()
  }

  async function fetchDetail(id: number): Promise<MatchDetail | null> {
    detailLoading.value = true
    try {
      detail.value = await api.matches.detail(id)
      return detail.value
    } catch (caught) {
      detail.value = null
      error.value = errorMessage(caught)
      return null
    } finally {
      detailLoading.value = false
    }
  }

  function pulse(id: number): void {
    pulseId.value = id
    setTimeout(() => {
      if (pulseId.value === id) pulseId.value = null
    }, 700)
  }

  // 报名：先乐观 +1，失败回滚 —— 热门局里「点了没反应」比偶尔回滚更伤体验
  async function join(id: number, note?: string): Promise<JoinResult> {
    const before = snapshot(id)
    const current = items.value.find((candidate) => candidate.id === id) ?? detail.value
    if (current) {
      const count = current.participantCount + 1
      patch(id, {
        participantCount: count,
        isFull: count >= current.capacity,
        spotsLeft: Math.max(0, current.capacity - count),
      })
    }
    try {
      const result = await api.matches.join(id, note ? { note } : undefined)
      patch(id, {
        participantCount: result.participantCount,
        isFull: result.isFull,
        spotsLeft: result.spotsLeft,
      })
      pulse(id)
      return result
    } catch (caught) {
      if (before) patch(id, before)
      throw caught
    }
  }

  async function leave(id: number): Promise<LeaveResult> {
    const before = snapshot(id)
    const current = items.value.find((candidate) => candidate.id === id) ?? detail.value
    if (current) {
      const count = Math.max(0, current.participantCount - 1)
      patch(id, {
        participantCount: count,
        isFull: count >= current.capacity,
        spotsLeft: Math.max(0, current.capacity - count),
      })
    }
    try {
      const result = await api.matches.leave(id)
      patch(id, {
        participantCount: result.participantCount,
        isFull: result.isFull,
        spotsLeft: result.spotsLeft,
      })
      return result
    } catch (caught) {
      if (before) patch(id, before)
      throw caught
    }
  }

  async function cancelMatch(id: number): Promise<CancelMatchResult> {
    const before = snapshot(id)
    patch(id, { status: 'CANCELLED' })
    try {
      return await api.matches.cancel(id)
    } catch (caught) {
      if (before) patch(id, before)
      throw caught
    }
  }

  return {
    city,
    filters,
    sort,
    items,
    total,
    hasMore,
    page,
    loading,
    error,
    detail,
    detailLoading,
    pulseId,
    isEmpty,
    hasFilter,
    fetchList,
    loadMore,
    applyFilters,
    setCity,
    setSort,
    fetchDetail,
    join,
    leave,
    cancelMatch,
  }
})