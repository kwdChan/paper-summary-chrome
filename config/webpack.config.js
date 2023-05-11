'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');
const webpack = require('webpack');


// Merge webpack configuration files
const config = (env, argv) =>
   merge(common, {
    entry: {
      popup: PATHS.src + '/popup.js',
      contentScript: PATHS.src + '/contentScript.js',
      background: PATHS.src + '/background.js',
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        WEB_URL: (argv.mode === 'production') ? JSON.stringify("https://paper-summary.vercel.app"): JSON.stringify("http://localhost:3000"),

      })
    ]
  });

module.exports = config;
