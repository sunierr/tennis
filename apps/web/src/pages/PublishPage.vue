<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  FEE_TYPES,
  FEE_TYPE_LABELS,
  MATCH_FORMATS,
  MATCH_FORMAT_LABELS,
  SURFACES,
  SURFACE_LABELS,
  TRAINING_CAPACITY_MAX,
  TRAINING_CAPACITY_MIN,
  resolveCapacity,
} from '@shared/types/enums'
import type { FeeType, MatchFormat, Surface } from '@shared/types/enums'
import { formatLevel } from '@shared/level/ntrp'
import { fromShanghai, shanghaiParts } from '@shared/time/range'
import { api } from '../api'
import { DEFAULT_CITY, useMatchesStore } from '../stores/matches'
import { useUserStore } from '../stores/user'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import BaseDateTime from '../components/ui/BaseDateTime.vue'
import BaseSegmented from '../components/ui/BaseSegmented.vue'
import BaseStepper from '../components/ui/BaseStepper.vue'
import LevelRangeBar from '../components/level/LevelRangeBar.vue'

const user = useUserStore()
const matches = useMatchesStore()
const toast = useToast()

// 默认时间：明天 19:00（按上海挂钟算，跨时区访问也不会偏）
function defaultStart(): string {
  const today = shanghaiParts(new Date())
  return fromShanghai(today.year, today.month, today.day + 1, 19, 0).toISOString()
}

function defaultLevel(): { min: number; max: number } {
  const mine = user.levelTenths
  if (!mine) return { min: 30, max: 40 }
  return { min: Math.max(10, mine - 5), max: Math.min(70, mine + 5) }
}

const initialLevel = defaultLevel()

const form = ref({
  title: '',
  city: user.city ?? DEFAULT_CITY,
  venue: '',
  venueAddress: '',
  startsAt: defaultStart(),
  durationMinutes: 120,
  format: 'DOUBLES' as MatchFormat,
  // 只在「练习」赛制下生效；1 对 1 / 2 对 2 的人数由赛制写死
  capacity: 4,
  feeType: 'AA' as FeeType,
  // AA 必填、我请客恒 0、其他可留空
  fee: 60 as number | null,
  surface: 'HARD' as Surface,
  levelMinTenths: initialLevel.min,
  levelMaxTenths: initialLevel.max,
  beginnerFriendly: false,
  notes: '',
})

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const durationOptions = [60, 90, 120, 150, 180]

// 含发起人的总人数：与后端同一份规则，避免前端自己算一套
const totalPeople = computed(() => resolveCapacity(form.value.format, form.value.capacity))

function normalizeFee(raw: string): number | null {
  if (raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const levelSummary = computed(() => `${formatLevel(form.value.levelMinTenths)} - ${formatLevel(form.value.levelMaxTenths)} 级`)

function validate(): boolean {
  const next: Record<string, string> = {}
  if (form.value.title.trim().length < 2) next.title = '标题至少 2 个字'
  if (!form.value.city.trim()) next.city = '请填写城市'
  if (form.value.venue.trim().length < 2) next.venue = '请填写场地名称'
  if (!form.value.startsAt) next.startsAt = '请选择日期与时间'
  else if (new Date(form.value.startsAt).getTime() <= Date.now()) next.startsAt = '开赛时间需要晚于现在'
  if (form.value.feeType === 'AA' && (form.value.fee === null || form.value.fee <= 0)) {
    next.fee = 'AA 需要填写大于 0 的人均金额'
  }
  if (form.value.levelMinTenths > form.value.levelMaxTenths) next.level = '最低水平不能高于最高水平'
  errors.value = next
  return Object.keys(next).length === 0
}

async function submit(): Promise<void> {
  if (!validate()) {
    toast.error(Object.values(errors.value)[0])
    return
  }
  submitting.value = true
  try {
    const created = await api.matches.create({
      title: form.value.title.trim(),
      city: form.value.city.trim(),
      venue: form.value.venue.trim(),
      venueAddress: form.value.venueAddress.trim() || undefined,
      startsAt: form.value.startsAt,
      durationMinutes: form.value.durationMinutes,
      format: form.value.format,
      capacity: form.value.format === 'TRAINING' ? form.value.capacity : undefined,
      feeType: form.value.feeType,
      fee: form.value.fee ?? undefined,
      surface: form.value.surface,
      levelMinTenths: form.value.levelMinTenths,
      levelMaxTenths: form.value.levelMaxTenths,
      beginnerFriendly: form.value.beginnerFriendly,
      notes: form.value.notes.trim() || undefined,
    })
    toast.success('约球已发布，等球友加入！')
    // 列表缓存里補上新局，返回发现页立刻能看到
    void matches.fetchList()
    go(ROUTE_NAMES.matchDetail, { id: created.id })
  } catch (caught) {
    toast.error(errorMessage(caught, '发布失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="container content">
    <header class="head">
      <h1>发布一场约球</h1>
      <p>填写信息，邀请水平相近的球友一起上场。</p>
    </header>

    <form class="card form" @submit.prevent="submit">
      <label class="field full">
        <span class="field__label">约球主题</span>
        <input v-model="form.title" class="input" maxlength="60" placeholder="例如：南山晚风局 · 轻松双打" />
        <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
      </label>

      <label class="field">
        <span class="field__label">城市</span>
        <input v-model="form.city" class="input" maxlength="32" placeholder="深圳" />
        <span v-if="errors.city" class="field__error">{{ errors.city }}</span>
      </label>

      <label class="field">
        <span class="field__label">场地名称</span>
        <input v-model="form.venue" class="input" maxlength="80" placeholder="南山网球中心 · 3号场" />
        <span v-if="errors.venue" class="field__error">{{ errors.venue }}</span>
      </label>

      <label class="field full">
        <span class="field__label">场地地址（可选）</span>
        <input v-model="form.venueAddress" class="input" maxlength="160" placeholder="用于方便球友导航" />
      </label>

      <BaseDateTime v-model="form.startsAt" :error="errors.startsAt" />

      <label class="field">
        <span class="field__label">时长</span>
        <select v-model.number="form.durationMinutes" class="input">
          <option v-for="option in durationOptions" :key="option" :value="option">约 {{ option / 60 }} 小时</option>
        </select>
      </label>

      <BaseSegmented
        v-model="form.format"
        class="full"
        :options="MATCH_FORMATS"
        :labels="MATCH_FORMAT_LABELS"
        label="赛制"
      />

      <BaseStepper
        v-if="form.format === 'TRAINING'"
        v-model="form.capacity"
        :min="TRAINING_CAPACITY_MIN"
        :max="TRAINING_CAPACITY_MAX"
        label="人数上限"
        suffix=" 人"
      />

      <p class="hint" :class="{ full: form.format !== 'TRAINING' }">
        发起人也占 1 个名额，本场共 <b class="num">{{ totalPeople }}</b> 人。
      </p>

      <BaseSegmented
        v-model="form.feeType"
        class="full"
        :options="FEE_TYPES"
        :labels="FEE_TYPE_LABELS"
        label="球场费用"
      />

      <label v-if="form.feeType !== 'TREAT'" class="field">
        <span class="field__label">
          {{ form.feeType === 'AA' ? '人均金额（元）' : '人均金额（元，可留空）' }}
        </span>
        <input
          class="input num"
          type="number"
          min="0"
          step="5"
          :value="form.fee ?? ''"
          @input="form.fee = normalizeFee(($event.target as HTMLInputElement).value)"
        />
        <span v-if="errors.fee" class="field__error">{{ errors.fee }}</span>
      </label>

      <p v-else class="hint">你来承担场地费，其他球友 0 元。</p>

      <label class="field">
        <span class="field__label">场地类型</span>
        <select v-model="form.surface" class="input">
          <option v-for="surface in SURFACES" :key="surface" :value="surface">{{ SURFACE_LABELS[surface] }}</option>
        </select>
      </label>

      <div class="field full">
        <LevelRangeBar
          v-model:min="form.levelMinTenths"
          v-model:max="form.levelMaxTenths"
          :error="errors.level ?? null"
        />
      </div>

      <label class="field full checkbox">
        <input v-model="form.beginnerFriendly" type="checkbox" />
        <span>新手友好（欢迎第一次上场的球友）</span>
      </label>

      <label class="field full">
        <span class="field__label">留言（可选）</span>
        <textarea v-model="form.notes" class="input" rows="3" maxlength="400" placeholder="例如：球后一起喝咖啡，AA 场地费" />
      </label>

      <div class="form-actions">
        <button class="btn btn--ghost" type="button" @click="go(ROUTE_NAMES.discover)">先不发布</button>
        <button class="btn btn--court" type="submit" :disabled="submitting">
          {{ submitting ? '发布中…' : `发布约球（${levelSummary}）` }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-7);
  padding-bottom: var(--space-8);
}

h1 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
}

.head p {
  color: var(--muted);
  font-size: var(--text-base);
  margin-top: var(--space-2);
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  padding: var(--space-6);
  margin-top: var(--space-6);
}

.full {
  grid-column: 1 / -1;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-base);
}

.hint {
  color: var(--muted);
  font-size: var(--text-xs);
  align-self: end;
}

.hint b {
  color: var(--court);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

textarea.input {
  resize: vertical;
}

@media (max-width: 560px) {
  .form {
    grid-template-columns: 1fr;
  }

  .full {
    grid-column: auto;
  }
}
</style>