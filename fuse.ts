import { src, task, context } from 'fuse-box/sparky';
import { FuseBox, JSONPlugin, WebIndexPlugin, SassPlugin, CSSPlugin, CSSResourcePlugin, QuantumPlugin } from 'fuse-box';
import { promises as fs } from 'fs';
import { join as pathJoin, basename } from 'path';

class Context {
  isProduction = false;
  getConfig() {
    return FuseBox.init({
      homeDir: 'src',
      target: 'browser@es6',
      output: 'dist/$name.js',
      hash: this.isProduction,
      sourceMaps: {
        project: !this.isProduction,
        vendor: !this.isProduction
      },
      plugins: [
        WebIndexPlugin({
          template: 'index.html',
          path: '.'
        }),
        JSONPlugin(),
        [
          SassPlugin(),
          CSSResourcePlugin({ dist: 'dist/resources' }),
          CSSPlugin(),
        ],
        this.isProduction && QuantumPlugin({
          bakeApiIntoBundle: 'vendor',
          css: true,
          treeshake: true,
          uglify: true
        }),
      ],
    });
  }
  createAppBundle(fuse) {
    const app = fuse.bundle('app');
    if(!this.isProduction) {
      app.watch();
      app.hmr();
    }
    app.instructions('>[index.ts]');
    return app;
  }
  createVendorBundle(fuse) {
    const app = fuse
      .bundle("vendor")
      .instructions("~index.ts");
    return app;    
  }
}

context(Context);

task('default', ['data'], async (context: Context) => {
  const fuse = context.getConfig();
  fuse.dev({ open: true, port: 8080 });
  context.createVendorBundle(fuse);
  context.createAppBundle(fuse);
  return fuse.run();
});

task('dist', ['clean', 'data'], async (context: Context) => {
  context.isProduction = true;
  const fuse = context.getConfig();
  context.createVendorBundle(fuse);
  context.createAppBundle(fuse);
  return fuse.run();
});

task('clean', async () => {
  return src('dist/')
    .clean('dist/')
    .exec();
});

// ----------------------------------------------------------------------------

async function handleDirectory(directory, obj, prefix) {
  for(let entry of await fs.readdir(directory, { withFileTypes: true })) {
    let entryPath = pathJoin(directory, entry.name);
    if(entry.isDirectory()) {
      handleDirectory(entryPath, obj, [...prefix, entry.name]);
    } else {
      let contents = await fs.readFile(entryPath, 'utf8');
      let key = [...prefix, basename(entry.name, '.json')].join('.');
      obj[key] = JSON.parse(contents);
    }
  }
}

task('data', async () => {
  const basePath = pathJoin(__dirname, 'src', 'data');

  let obj = { };
  for(let entry of await fs.readdir(basePath, { withFileTypes: true })) {
    if(entry.isDirectory()) {
      obj[entry.name] = {};
      await handleDirectory(pathJoin(basePath, entry.name), obj[entry.name], []);
    }
  }

  let json = JSON.stringify(obj, null, '  ');
  return fs.writeFile(pathJoin(basePath, 'data.json'), json);
});