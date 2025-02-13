import { Anipres } from "anipres";
import { css, fontFamilyFallback } from "../public/XiaolaiSC-Regular.ttf";
import "anipres/anipres.css";

function App() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
      }}
    >
      <style>{`
        @font-face {
          font-family: 'Excalifont-Regular';
          src: url('/Excalifont-Regular.woff2');
          font-weight: normal;
          font-style: normal;
        }

        .tl-container {
          --tl-font-draw: Excalifont-Regular, '${css.family}', ${fontFamilyFallback}, 'tldraw_draw';
        }
      `}</style>
      <Anipres />
    </div>
  );
}

export default App;
