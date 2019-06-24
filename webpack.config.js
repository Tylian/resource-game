const webpack = require( 'webpack');
const HtmlWebpackPlugin = require( 'html-webpack-plugin');

const {
  createConfig,
  match,

  // Feature blocks
  css,
  devServer,
  file,
  postcss,
  sass,
  uglify,
  typescript,
  extractText,

  // Shorthand setters
  addPlugins,
  setMode,
  entryPoint,
  env,
  setOutput,
  sourceMaps
} = require('webpack-blocks');

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

module.exports = createConfig([
  setMode(process.env.NODE_ENV || 'development'),
  entryPoint('./src/index.ts'),
  setOutput('./dist/bundle.js'),
  addPlugins([
    new HtmlWebpackPlugin({
      inject: true,
      template: 'index.html'
    })
  ]),

  match(['*.ts', '*.tsx', '!*node_modules*'], [
    typescript()
  ]),
  match(['*.scss', '*.sass', '!*node_modules*'], [
    css(),
    env('production', [ postcss({ plugins: [ autoprefixer(), cssnano() ] }), ]),
    env('development', [ postcss({ plugins: [ autoprefixer() ] }), ]),
    sass(),
    env('production', [ extractText('css/[name].css') ])
  ]),
  match(['*.gif', '*.jpg', '*.jpeg', '*.png', '*.webp'], [
    file()
  ]),
  env('development', [
    devServer(),
    sourceMaps('inline-source-map')
  ]),
  env('production', [
    uglify(),
    addPlugins([ new webpack.LoaderOptionsPlugin({ minimize: true }) ])
  ])
]);