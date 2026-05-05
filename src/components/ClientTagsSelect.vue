<template>
  <div class="tags-wrap">
    <n-select
      v-model:value="selected"
      :options="tagsStore.asOptions"
      multiple
      clearable
      placeholder="Додати теги..."
      :render-tag="renderTag"
      :render-label="renderTagOption"
      @update:value="onUpdate"
    />
    <n-button size="small" quaternary circle style="margin-left: 4px;" @click="showCreate = true">
      <template #icon><n-icon><AddOutline /></n-icon></template>
    </n-button>
  </div>

  <n-modal v-model:show="showCreate" preset="card" title="Новий тег" style="width: 360px;" :mask-closable="false">
    <n-form ref="createFormRef" :model="newTag" :rules="createRules" label-placement="top">
      <n-form-item label="Назва" path="name">
        <n-input v-model:value="newTag.name" placeholder="Важливий клієнт" @keydown.enter="saveTag" />
      </n-form-item>
      <n-form-item label="Колір">
        <n-space>
          <div
            v-for="color in PALETTE"
            :key="color"
            class="color-swatch"
            :style="{ background: color, outline: newTag.color === color ? '2px solid #333' : 'none' }"
            @click="newTag.color = color"
          />
        </n-space>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showCreate = false">Скасувати</n-button>
        <n-button type="primary" :loading="creating" @click="saveTag">Створити</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import { NSelect, NButton, NIcon, NModal, NForm, NFormItem, NInput, NSpace, NTag } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { useTagsStore } from '@/stores/tags.js'
import { TagService } from '@/services/TagService.js'
import { db } from '@/db/index.js'
import { TAG_PALETTE } from '@/constants/tags.js'
import { renderTagOption } from '@/utils/renderTagOption.js'

const props = defineProps({ clientId: { type: [Number, String], required: true } })
const emit = defineEmits(['change'])

const PALETTE = TAG_PALETTE

const tagsStore = useTagsStore()
const message = useMessage()

const selected = ref([])
const showCreate = ref(false)
const creating = ref(false)
const createFormRef = ref(null)
const newTag = ref({ name: '', color: PALETTE[4] })

const createRules = {
  name: { required: true, message: 'Введіть назву тегу', trigger: 'blur' },
}

function renderTag({ option, handleClose }) {
  return h(NTag, {
    style: { background: option.color, color: '#fff', border: 'none' },
    closable: true,
    size: 'small',
    onClose: handleClose,
  }, { default: () => option.label })
}

async function onUpdate(ids) {
  await TagService.setClientTags(props.clientId, ids ?? [])
  emit('change')
}

async function saveTag() {
  await createFormRef.value.validate()
  creating.value = true
  try {
    const id = await tagsStore.create(newTag.value.name.trim(), newTag.value.color)
    showCreate.value = false
    newTag.value = { name: '', color: PALETTE[4] }
    message.success('Тег створено')
    selected.value = [...selected.value, id]
    await onUpdate(selected.value)
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  const [, clientTagLinks] = await Promise.all([
    tagsStore.list.length === 0 ? tagsStore.fetchAll() : Promise.resolve(),
    db.clientTags.where('clientId').equals(Number(props.clientId)).toArray(),
  ])
  selected.value = clientTagLinks.map(l => l.tagId)
})
</script>

<style scoped>
.tags-wrap {
  display: flex;
  align-items: center;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.color-swatch:hover {
  transform: scale(1.2);
}
</style>
