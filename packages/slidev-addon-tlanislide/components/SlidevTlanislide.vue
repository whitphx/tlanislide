<template>
  <div>
    <div class="inverse-transform" ref="container" @dblclick="onDblclick">
      <Tlanislide
        @mount="handleMount"
        :step="$clicks"
        @stepChange="$clicks = $event"
        :presentationMode="!isEditing"
        :store="store"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { createRoot } from "react-dom/client";
import { setVeauryOptions, applyPureReactInVue } from "veaury";
import { Tlanislide as TlanislideReact } from "tlanislide";

setVeauryOptions({
  react: {
    createRoot,
  },
});

export default {
  components: {
    // Tlanislide: applyReactInVue(TlanislideReact),
    Tlanislide: applyPureReactInVue(TlanislideReact),
  },
};
</script>

<script setup lang="ts">
// Inspired by slidev-addon-tldraw:
// https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/Tldraw.vue#L163
import {
  createTLStore,
  defaultShapeUtils,
  debounce,
  Editor,
  getSnapshot,
  loadSnapshot,
  type TLStoreSnapshot,
} from "tldraw";
import { ref, shallowRef, watch } from "vue";
import { useCssVar, onClickOutside } from "@vueuse/core";
import { useSlideContext } from "@slidev/client";
import { customShapeUtils } from "tlanislide";
import "tlanislide/tlanislide.css";
import "./tlanislide.css";
// @ts-expect-error virtual import
import ALL_SNAPSHOT from "/@slidev-tlanislide-snapshot";

interface SavedSnapshot {
  document: TLStoreSnapshot;
}

const props = withDefaults(
  defineProps<{
    id: string;
    editable?: boolean;
  }>(),
  {
    editable: true,
  },
);

const container = ref<HTMLElement>();

const isEditing = ref(false);

const savedSnapshot: SavedSnapshot | undefined = ALL_SNAPSHOT[props.id];

function onDblclick() {
  if (props.editable && import.meta.hot) isEditing.value = !isEditing.value;
}

onClickOutside(container, () => {
  isEditing.value = false;
});

function save() {
  if (isEditing.value) {
    const { document } = getSnapshot(store);
    import.meta.hot?.send("tlanislide-snapshot", {
      id: props.id,
      snapshot: { document },
    });
  }
}
const debouncedSave = debounce(save, 500);

const store = createTLStore({
  shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
});
if (savedSnapshot) {
  loadSnapshot(store, savedSnapshot);
}
store.listen(debouncedSave, { source: "user", scope: "all" });

const editorRef = shallowRef<Editor>();

// Ref: https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/Tldraw.vue#L163
const scale = useCssVar("--slide-scale", container);
const { $scale, $clicks } = useSlideContext();

const handleMount = (editor: Editor) => {
  editorRef.value = editor;

  watch(
    $scale,
    (newScale) => {
      scale.value = String(newScale);
    },
    { immediate: true },
  );
};
</script>

<style scoped></style>
