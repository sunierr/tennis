<script setup lang="ts">
// 发帖页：正文 + 图片（最多 9 张，即时预览可删可排序）+ 标签（最多 3 个，带热门推荐）。
// 图片在选中的那一刻就开始上传，提交时拿到的已经是绝对地址。
import { onMounted, ref } from 'vue'
import { POST_IMAGE_MAX, POST_TAG_MAX } from '@shared/types/enums'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go, goBack } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import ImagePicker from '../components/community/ImagePicker.vue'
import TagInput from '../components/community/TagInput.vue'

const toast = useToast()

const content = ref('')
const imageUrls = ref<string[]>([])
const tags = ref<string[]>([])
const suggestions = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    // 推荐词只是辅助输入，拉不到就不显示
    suggestions.value = (await api.tags.hot()).map((tag) => tag.name)
  } catch {
    suggestions.value = []
  }
})

function validate(): boolean {
  if (!content.value.trim() && imageUrls.value.length === 0) {
    error.value = '请填写正文或添加图片'
    return false
  }
  if (uploading.value) {
    error.value = '还有图片在上传，请稍候'
    return false
  }
  error.value = ''
  return true
}

async function submit(): Promise<void> {
  if (!validate()) return
  submitting.value = true
  try {
    const created = await api.posts.create({
      content: content.value.trim(),
      imageUrls: imageUrls.value,
      tags: tags.value,
    })
    toast.success('已发布')
    go(ROUTE_NAMES.postDetail, { id: created.id })
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
      <h1>发布动态</h1>
      <p>分享球局、心得或装备，最多 {{ POST_IMAGE_MAX }} 张图片与 {{ POST_TAG_MAX }} 个标签。</p>
    </header>

    <form class="card form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">正文</span>
        <textarea
          v-model="content"
          class="input"
          rows="5"
          maxlength="2000"
          placeholder="今天打了什么球？有什么想和球友分享的？"
          data-testid="post-content"
          @input="error = ''"
        />
        <span class="counter num">{{ content.length }}/2000</span>
      </label>

      <ImagePicker v-model="imageUrls" @busy="uploading = $event" />

      <TagInput v-model="tags" :suggestions="suggestions" />

      <p v-if="error" class="field__error">{{ error }}</p>

      <div class="actions">
        <button class="btn btn--ghost" type="button" @click="goBack(ROUTE_NAMES.community)">取消</button>
        <button class="btn btn--court" type="submit" :disabled="submitting || uploading" data-testid="post-submit">
          {{ submitting ? '发布中…' : '发布' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-6);
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
  gap: var(--space-5);
  padding: var(--space-6);
  margin-top: var(--space-6);
  max-width: 640px;
}

textarea.input {
  resize: vertical;
}

.counter {
  justify-self: end;
  color: var(--muted);
  font-size: var(--text-xs);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>