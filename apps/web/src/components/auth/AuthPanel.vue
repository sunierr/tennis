<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CurrentUser } from '@shared/types/user'
import { LEVEL_OPTIONS, formatLevel, parseLevel } from '@shared/level/ntrp'
import { useUserStore } from '../../stores/user'
import { errorMessage } from '../../utils/error'
import { DEFAULT_CITY } from '../../stores/matches'
import BaseModal from '../ui/BaseModal.vue'
import LevelDots from '../level/LevelDots.vue'

// 登录/注册面板：既被 /login 页复用，也能在「未登录点报名」时就地弹起。
// 字段只用账号 + 密码（无验证码）；注册时可选填昵称、自评水平、城市。
const props = withDefaults(defineProps<{ mode?: 'login' | 'register' }>(), { mode: 'login' })

const emit = defineEmits<{
  close: []
  success: [user: CurrentUser]
}>()

const userStore = useUserStore()

const mode = ref<'login' | 'register'>(props.mode)
const submitting = ref(false)
const error = ref<string | null>(null)

const form = ref({
  account: '',
  password: '',
  nickname: '',
  city: '',
  levelText: '',
})

const title = computed(() => (mode.value === 'login' ? '欢迎回来' : '加入 Match Point'))
const copy = computed(() =>
  mode.value === 'login' ? '登录后即可报名约球、发布自己的球局。' : '用账号密码创建球友档案，水平相近才好约。',
)
const previewLevel = computed(() => parseLevel(form.value.levelText))

function switchMode(): void {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = null
}

function validate(): string | null {
  if (!form.value.account.trim()) return '请输入账号'
  if (!form.value.password) return '请输入密码'
  if (mode.value === 'register') {
    if (!form.value.nickname.trim()) return '请填写昵称'
    if (form.value.password.length < 6) return '密码至少 6 位'
    if (form.value.account.trim().length < 4) return '账号需为 4-32 位字母、数字或 _ . @ -'
  }
  return null
}

async function submit(): Promise<void> {
  error.value = validate()
  if (error.value) return
  submitting.value = true
  try {
    const user =
      mode.value === 'login'
        ? await userStore.login({ account: form.value.account.trim(), password: form.value.password })
        : await userStore.register({
            account: form.value.account.trim(),
            password: form.value.password,
            nickname: form.value.nickname.trim(),
            levelTenths: previewLevel.value ?? undefined,
            city: form.value.city.trim() || undefined,
          })
    emit('success', user)
  } catch (caught) {
    error.value = errorMessage(caught, '操作失败，请检查账号和密码')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal :title="title" @close="emit('close')">
    <p class="copy">{{ copy }}</p>

    <form class="form" @submit.prevent="submit">
      <label v-if="mode === 'register'" class="field">
        <span class="field__label">昵称</span>
        <input v-model="form.nickname" class="input" maxlength="20" placeholder="球友怎么称呼你" />
      </label>

      <label class="field">
        <span class="field__label">账号</span>
        <input v-model="form.account" class="input" autocomplete="username" placeholder="4-32 位字母、数字或 _ . @ -" />
      </label>

      <label class="field">
        <span class="field__label">密码</span>
        <input
          v-model="form.password"
          class="input"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="至少 6 位"
        />
      </label>

      <template v-if="mode === 'register'">
        <label class="field">
          <span class="field__label">自评水平（可稍后在个人资料里填写）</span>
          <select v-model="form.levelText" class="input">
            <option value="">暂不填写</option>
            <option v-for="option in LEVEL_OPTIONS" :key="option" :value="`${option / 10}`">
              {{ formatLevel(option) }} 级
            </option>
          </select>
        </label>
        <div v-if="previewLevel" class="level-preview">
          <LevelDots :tenths="previewLevel" size="sm" />
          <span class="field__label">自评水平，用于推荐水平相近的球局</span>
        </div>

        <label class="field">
          <span class="field__label">城市（可选）</span>
          <input v-model="form.city" class="input" :placeholder="DEFAULT_CITY" maxlength="32" />
        </label>
      </template>

      <p v-if="error" class="field__error">{{ error }}</p>

      <button class="btn btn--court submit" type="submit" :disabled="submitting">
        {{ submitting ? '处理中…' : mode === 'login' ? '登录' : '注册并登录' }}
      </button>
    </form>

    <button class="switch" @click="switchMode">
      {{ mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录' }}
    </button>
  </BaseModal>
</template>

<style scoped>
.copy {
  color: var(--muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-6);
}

.form {
  display: grid;
  gap: var(--space-5);
}

.level-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.submit {
  width: 100%;
}

.switch {
  width: 100%;
  margin-top: var(--space-5);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--green);
}
</style>