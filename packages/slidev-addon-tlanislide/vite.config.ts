// Load and save Tldraw snapshots from/to the file system via Vite plugin.
// This implmentation is based on the slidev-addon-graph plugin:
// https://github.com/antfu/slidev-addon-graph/blob/5c7dbfbf198c401477f9b50ce4de4e9e50243d16/vite.config.ts
import fs from "node:fs"
import { join } from "node:path";
import process from 'node:process'
import { defineConfig } from "vite";

let root = process.cwd();
function resolveSnapshotPath() {
  return join(root, '.slidev/tlanislide/snapshots');
}

export default defineConfig({
  plugins: [
    {
      name: 'tlanislide-server',
      configureServer(server) {
        root = server.config.root;
        server.ws.on('connection', (socket, req) => {
          socket.on('message', async (data) => {
            const payload = JSON.parse(data.toString());
            if (payload.type === 'custom' && payload.event === 'tlanislide-snapshot') {
              const snapshotDir = resolveSnapshotPath();
              const snapshotData = JSON.stringify(payload.data.snapshot, null, 2)
              fs.mkdirSync(snapshotDir, { recursive: true });
              fs.writeFileSync(
                join(snapshotDir, `${payload.data.id}.json`),
                snapshotData,
              )
            }
          });
        });
      },
      configResolved(config) {
        root = config.root;
      },
      resolveId(id) {
        if (id === '/@slidev-tlanislide-snapshot') {
          return id
        }
      },
      load(id) {
        if (id === '/@slidev-tlanislide-snapshot') {
          const path = resolveSnapshotPath()
          const files = fs.existsSync(path) ? fs.readdirSync(path) : []
          return [
            '',
            ...files.map((file, idx) => {
              return `import v${idx} from ${JSON.stringify(join(path, file))}`
            }),
            'const snapshots = {',
            files.map((file, idx) => {
              return `  ${JSON.stringify(file.replace(/\.json$/, ''))}: v${idx}`
            }).join(',\n'),
            '}',

            'export default snapshots',

            'if (import.meta.hot) {',
            '  import.meta.hot.accept(({ default: newSnapshots }) => {',
            '    Object.assign(snapshots, newSnapshots)',
            '  })',
            '}',
          ].join('\n')
        }
      },
    },
  ]
});
