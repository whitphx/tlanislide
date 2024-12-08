import { Tldraw, type Editor } from "tldraw";
import { setup } from "./tlanidraw";
import "tldraw/tldraw.css";

function App() {
  const handleMount = (editor: Editor) => {
    setup(editor);
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw onMount={handleMount} />
    </div>
  );
}

export default App;
