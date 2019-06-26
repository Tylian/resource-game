const webpack = require( 'webpack');
const HtmlWebpackPlugin = require( 'html-webpack-plugin');
const path = require('path');

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
  sourceMaps,
  optimization,
  setEnv
} = require('webpack-blocks');

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

module.exports = createConfig([
  setMode(process.env.NODE_ENV || 'development'),
  entryPoint('./src/index.ts'),
  setOutput({
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
    chunkFilename: '[name].bundle.js',
    jsonpScriptType: 'module'
  }),
  optimization({
    splitChunks: {
      cacheGroups: {
        data: {
          chunks: 'initial',
          name: 'data',
          test: /data[\\/].*?\.json$/,
          enforce: true
        },
        vendor: {
          chunks: 'initial',
          name: 'vendor',
          test: /node_modules/,
          enforce: true
        },
      }
    },
    runtimeChunk: 'single'
  }),
  addPlugins([
    new HtmlWebpackPlugin({
      inject: true,
      template: 'index.html'
    })
  ]),
  setEnv({
    NODE_ENV: process.env.NODE_ENV
  }),
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