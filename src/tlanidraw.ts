import { type Editor } from "tldraw"

export function setup(editor: Editor) {
  editor.createShape({
    type: "text",
    x: 100,
    y: 100,
    props: {
      text: "Hello, world!",
    },
  })
}
