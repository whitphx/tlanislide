<script lang="ts">
import { createRoot } from "react-dom/client";
import { setVeauryOptions, applyPureReactInVue } from "veaury";
import {
  Tlanislide as TlanislideReact,
  type TlanislideRef as TlanislideReactRef,
} from "tlanislide";

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
import { ref, useTemplateRef, watch } from "vue";
import { useCssVar, onClickOutside } from "@vueuse/core";
import { onSlideEnter, useDarkMode, useSlideContext } from "@slidev/client";
import "tlanislide/tlanislide.css";
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

const tlanislideRef = useTemplateRef<{
  __veauryReactRef__?: TlanislideReactRef;
}>("tlanislide");
function rerender() {
  if (tlanislideRef.value && tlanislideRef.value.__veauryReactRef__) {
    tlanislideRef.value.__veauryReactRef__.rerunStep();
  }
}

onSlideEnter(() => {
  rerender();
  // An immediate rerender is sometimes not enough to make the slide rerender.
  // So we do a second rerender after a short delay.
  setTimeout(() => {
    rerender();
  }, 100);
});

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

      setTimeout(() => {
        rerender();
      });
      // An immediate rerender is sometimes not enough to make the slide rerender.
      // So we do a second rerender after a short delay.
      setTimeout(() => {
        rerender();
      }, 100);
    },
    { immediate: true },
  );
};
</script>

<template>
  <div
    :class="['container', 'inverse-transform', { editing: isEditing }]"
    ref="container"
    @dblclick="onDblclick"
  >
    <Tlanislide
      ref="tlanislide"
      @mount="handleMount"
      :step="$clicks"
      @stepChange="$clicks = $event"
      :presentationMode="!isEditing"
      :snapshot="savedSnapshot"
    />
  </div>
</template>

<style scoped>
/*
  Super thanks to https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/tldraw.css
  It is MIT licensed as below:

  ```
  MIT License

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  ```
*/

/*
  Slides are CSS transformed at parent level, and Tldraw breaks on such transformations.
  Inverse the transformation to make Tldraw work correctly. (note that `all: unset` only partially works)
*/
.inverse-transform {
  width: calc(var(--slide-scale) * 100%);
  height: calc(var(--slide-scale) * 100%);
  transform: scale(calc(1 / var(--slide-scale)))
    translate(
      calc(calc(var(--slide-scale) - 1) * -50%),
      calc(calc(var(--slide-scale) - 1) * -50%)
    );
}

.container :deep(.tl-theme__light, .tl-theme__dark) {
  --color-background: rgba(0, 0, 0, 0);
}

.container:not(.editing) :deep(.tl-container__focused) {
  outline: none;
}
</style>
