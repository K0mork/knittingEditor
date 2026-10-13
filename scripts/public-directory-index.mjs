import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** 開発時だけ、public配下のディレクトリURLを既存の静的HTMLへ渡す。 */
export function publicDirectoryIndex() {
  return {
    name: 'knitting-editor:public-directory-index',
    apply: 'serve',
    configureServer(server) {
      const publicDir = server.config.publicDir;
      if (!publicDir) return;
      server.middlewares.use(async (request, _response, next) => {
        if (!request.url || !['GET', 'HEAD'].includes(request.method ?? '')) return next();
        const queryIndex = request.url.indexOf('?');
        const pathname = queryIndex < 0 ? request.url : request.url.slice(0, queryIndex);
        const query = queryIndex < 0 ? '' : request.url.slice(queryIndex);
        let decoded;
        try {
          decoded = decodeURIComponent(pathname);
        } catch {
          return next();
        }
        if (decoded === '/' || !decoded.endsWith('/')) return next();
        const file = resolve(publicDir, `.${decoded}`, 'index.html');
        if (!file.startsWith(`${publicDir}${sep}`)) return next();
        try {
          if ((await stat(file)).isFile()) request.url = `${pathname}index.html${query}`;
        } catch (error) {
          if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') return next(error);
        }
        next();
      });
    },
  };
}
