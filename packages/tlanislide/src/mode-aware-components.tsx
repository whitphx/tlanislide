import {
  DefaultActionsMenu,
  DefaultDebugMenu,
  DefaultHelperButtons,
  DefaultKeyboardShortcutsDialog,
  DefaultMainMenu,
  DefaultMenuPanel,
  DefaultMinimap,
  DefaultNavigationPanel,
  DefaultPageMenu,
  DefaultQuickActions,
  DefaultStylePanel,
  DefaultToolbar,
  DefaultZoomMenu,
  useValue,
} from "tldraw";
import type { Atom, TLComponents } from "tldraw";

const BASE_COMPONENTS: TLComponents = {
  // ContextMenu: DefaultContextMenu,  // XXX: Maybe due to Tldraw's bug, when this is overridden, the shapes are not rendered.
  ActionsMenu: DefaultActionsMenu,
  HelpMenu: null,
  ZoomMenu: DefaultZoomMenu,
  MainMenu: DefaultMainMenu,
  Minimap: DefaultMinimap,
  StylePanel: DefaultStylePanel,
  PageMenu: DefaultPageMenu,
  NavigationPanel: DefaultNavigationPanel,
  Toolbar: DefaultToolbar,
  KeyboardShortcutsDialog: DefaultKeyboardShortcutsDialog,
  QuickActions: DefaultQuickActions,
  HelperButtons: DefaultHelperButtons,
  // DebugPanel: DefaultDebugPanel,  // This is a Tldraw's internal component that can't be specified for override.
  DebugMenu: DefaultDebugMenu,
  MenuPanel: DefaultMenuPanel,
  SharePanel: null,
  CursorChatBubble: null,
  TopPanel: null,
};

export function createModeAwareDefaultComponents(
  $presentationMode: Atom<boolean>,
): TLComponents {
  const components: TLComponents = {};
  Object.entries(BASE_COMPONENTS).forEach(([key, Component]) => {
    if (Component == null) {
      return;
    }

    const WrappedComponent = (props: object) => {
      const presentationMode = useValue($presentationMode);
      return !presentationMode && <Component {...props} />;
    };

    // @ts-expect-error: Complex type system.
    components[key] = WrappedComponent;
  });

  return components as TLComponents;
}
