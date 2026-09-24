<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LEVEL_OPTIONS, formatLevel, parseLevel } from '@shared/level/ntrp'
import { useUserStore } from '../stores/user'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import LevelDots from '../components/level/LevelDots.vue'

const user = useUserStore()
const toast = useToast()

// 表单以本地副本编辑，保存成功后再以服务端返回为准回填
const form = ref({
  nickname: user.user?.nickname ?? '',
  levelText: user.levelTenths ? formatLevel(user.levelTenths) : '',
  city: user.city ?? '',
  district: user.user?.district ?? '',
  bio: user.user?.bio ?? '',
})

const saving = ref(false)
const previewLevel = computed(() => parseLevel(form.value.levelText))

watch(
  () => user.user,
  (next) => {
    if (!next) return
    form.value = {
      nickname: next.nickname,
      levelText: next.levelTenths ? formatLevel(next.levelTenths) : '',
      city: next.city ?? '',
      district: next.district ?? '',
      bio: next.bio ?? '',
    }
  },
)

const initials = computed(() => (user.nickname || '球友').slice(0, 2).toUpperCase())

async function save(): Promise<void> {
  if (!form.value.nickname.trim()) {
    toast.error('昵称不能为空')
    return
  }
  saving.value = true
  try {
    await user.updateProfile({
      nickname: form.value.nickname.trim(),
      levelTenths: previewLevel.value ?? undefined,
      city: form.value.city.trim() || undefined,
      district: form.value.district.trim() || undefined,
      bio: form.value.bio.trim() || undefined,
    })
    toast.success('资料已更新')
  } catch (caught) {
    toast.error(errorMessage(caught, '保存失败'))
  } finally {
    saving.value = false
  }
}

function logout(): void {
  user.logout()
  toast.success('已退出登录')
  go(ROUTE_NAMES.discover)
}
</script>

<template>
  <div class="container content">
    <header class="card head">
      <span class="avatar">{{ initials }}</span>
      <div>
        <h1>{{ user.nickname || '球友' }}</h1>
        <p class="head-meta">
          自评水平
          <b class="num">{{ formatLevel(user.levelTenths) }}</b>
          <LevelDots :tenths="user.levelTenths" size="sm" />
        </p>
      </div>
      <div class="head-actions">
        <button class="btn btn--ghost" @click="go(ROUTE_NAMES.myRegistrations)">我的报名</button>
        <button class="btn btn--ghost" @click="go(ROUTE_NAMES.myMatches)">我发布的</button>
      </div>
    </header>

    <div v-if="user.needLevelSetup" class="notice">
      <p class="notice-title">填写自评水平，才能匹配水平相近的球友</p>
      <p class="notice-copy">水平是约球匹配的核心，随便填个大概也行。</p>
    </div>

    <form class="card form" @submit.prevent="save">
      <h2>个人资料</h2>

      <label class="field">
        <span class="field__label">昵称</span>
        <input v-model="form.nickname" class="input" maxlength="20" />
      </label>

      <div class="field">
        <span class="field__label">自评水平（NTRP）</span>
        <select v-model="form.levelText" class="input">
          <option value="">暂不填写</option>
          <option v-for="option in LEVEL_OPTIONS" :key="option" :value="formatLevel(option)">
            {{ formatLevel(option) }} 级
          </option>
        </select>
        <div class="level-preview">
          <LevelDots :tenths="previewLevel" size="sm" />
          <span class="field__label">1.0 - 7.0，0.5 一档</span>
        </div>
      </div>

      <label class="field">
        <span class="field__label">城市</span>
        <input v-model="form.city" class="input" maxlength="32" placeholder="深圳" />
      </label>

      <label class="field">
        <span class="field__label">区域（可选）</span>
        <input v-model="form.district" class="input" maxlength="32" placeholder="南山区" />
      </label>

      <label class="field full">
        <span class="field__label">一句话介绍（可选）</span>
        <textarea v-model="form.bio" class="input" rows="3" maxlength="140" placeholder="例如：左右手都会，喜欢双打网前" />
      </label>

      <div class="form-actions">
        <button class="btn btn--ghost" type="button" @click="logout">退出登录</button>
        <button class="btn btn--court" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存资料' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-7);
  padding-bottom: var(--space-8);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6);
  flex-wrap: wrap;
}

.avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 50%;
  background: var(--ball);
  color: var(--ink);
  font-weight: 850;
}

h1 {
  font-size: var(--text-lg);
  letter-spacing: -0.04em;
}

.head-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--muted);
  font-size: var(--text-sm);
  margin-top: var(--space-2);
}

.head-meta b {
  color: var(--court);
}

.head-actions {
  display: flex;
  gap: var(--space-3);
  margin-left: auto;
  flex-wrap: wrap;
}

.notice {
  background: var(--white);
  border: 1px solid var(--ball);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  margin-top: var(--space-5);
}

.notice-title {
  font-weight: 850;
}

.notice-copy {
  color: var(--muted);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  padding: var(--space-6);
  margin-top: var(--space-5);
}

.form h2 {
  grid-column: 1 / -1;
  font-size: var(--text-md);
  letter-spacing: -0.03em;
}

.full {
  grid-column: 1 / -1;
}

.level-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
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

  .head-actions {
    margin-left: 0;
  }
}
</style>