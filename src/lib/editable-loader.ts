import { glob } from 'astro/loaders';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Astro 7.3's glob loader returns early for an empty directory before pruning
 * its cache or installing a watcher. Keep deletion and first-entry edits valid. */
export function editableGlob(options: Parameters<typeof glob>[0]): ReturnType<typeof glob> {
  const loader = glob(options);
  return {
    ...loader,
    async load(context) {
      const root = fileURLToPath(context.config.root);
      for (const entry of context.store.values()) {
        if (entry.filePath && !existsSync(path.resolve(root, entry.filePath))) context.store.delete(entry.id);
      }
      await loader.load(context);
      if (!context.watcher || [...context.store.keys()].length) return;
      const watcher = context.watcher;
      const base = path.resolve(root, options.base?.toString() || '.');
      let loading = false;
      const firstEntry = async (file: string) => {
        if (loading || !file.endsWith('.md') || !existsSync(base) || !existsSync(file)) return;
        const relative = path.relative(realpathSync(base), realpathSync(file));
        if (relative.startsWith('..') || path.isAbsolute(relative)) return;
        loading = true;
        try {
          await loader.load(context);
          watcher.off('add', firstEntry);
          watcher.off('change', firstEntry);
        } catch (error) {
          context.logger.error(String(error));
        } finally { loading = false; }
      };
      watcher.add(base);
      watcher.on('add', firstEntry);
      watcher.on('change', firstEntry);
    },
  };
}
