<template>
  <div>
    <div
      :class="['inverse-transform', { editing: isEditing }]"
      ref="container"
      @dblclick="onDblclick"
    >
      <Tlanislide
        @mount="handleMount"
        :step="$clicks"
        @stepChange="$clicks = $event"
        :presentationMode="!isEditing"
        :snapshot="savedSnapshot"
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
  debounce,
  Editor,
  getSnapshot,
  getUserPreferences,
  setUserPreferences,
  type TLStoreSnapshot,
} from "tldraw";
import { ref, watch } from "vue";
import { useCssVar, onClickOutside } from "@vueuse/core";
import { useDarkMode, useSlideContext } from "@slidev/client";
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

const { isDark } = useDarkMode();
watch(
  isDark,
  (isDark) => {
    setUserPreferences({
      ...getUserPreferences(),
      colorScheme: isDark ? "dark" : "light",
    });
  },
  { immediate: true },
);

const { $scale, $clicks } = useSlideContext();

const container = ref<HTMLElement>();

const isEditing = ref(false);

const savedSnapshot: SavedSnapshot | undefined = ALL_SNAPSHOT[props.id];

function onDblclick() {
  if (props.editable && import.meta.hot) isEditing.value = !isEditing.value;
}

onClickOutside(container, () => {
  isEditing.value = false;
});

// Ref: https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/Tldraw.vue#L163
const scale = useCssVar("--slide-scale", container);

const handleMount = (editor: Editor) => {
  function save() {
    if (isEditing.value) {
      const { document } = getSnapshot(editor.store);
      import.meta.hot?.send("tlanislide-snapshot", {
        id: props.id,
        snapshot: { document },
      });
    }
  }
  const debouncedSave = debounce(save, 500);
  editor.store.listen(debouncedSave, { source: "user", scope: "document" });

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
