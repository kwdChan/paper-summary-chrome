'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');
const webpack = require('webpack');

// Merge webpack configuration files
const config = (env, argv) =>
   merge(common, {
    entry: {
      popup: PATHS.src + '/popup.ts',
      contentScript: PATHS.src + '/contentScript.ts',
      background: PATHS.src + '/background.ts',
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        WEB_URL: (argv.mode === 'production') ? JSON.stringify("https://review-express-v1.vercel.app"): JSON.stringify("http://localhost:3000"),

      })
    ]
  });

module.exports = config;
