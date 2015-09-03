"use strict";
/* global __dirname */

var webpack = require('webpack');
var webpackPostcssTools = require('webpack-postcss-tools');

var CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;
var NgAnnotatePlugin = require('ng-annotate-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');

var _ = require('underscore');
var glob = require('glob');
var fs = require('fs');

function hasArg(arg) {
    var regex = new RegExp("^" + ((arg.length === 2) ? ("-\\w*"+arg[1]+"\\w*") : (arg)) + "$");
    return process.argv.filter(regex.test.bind(regex)).length > 0;
}

var BASE_PATH = __dirname + '/resources/frontend_client/app/';

// All JS files except dist and test
var JS_SRC = glob.sync(BASE_PATH + '**/*.js', { ignore: BASE_PATH + 'dist/**/*.js' });
// All CSS files in app/css and app/components
var CSS_SRC = glob.sync(BASE_PATH + 'css/**/*.css').concat(glob.sync(BASE_PATH + 'components/**/*.css'));

// Need to scan the CSS files for variable and custom media used across files
// NOTE: this requires "webpack -w" (watch mode) to be restarted when variables change :(
if (hasArg("-w") || hasArg("--watch")) {
    console.warn("Warning: in webpack watch mode you must restart webpack if you change any CSS variables or custom media queries");
}

// default NODE_ENV to production unless -d or --debug is specified
var NODE_ENV = process.env["NODE_ENV"] || (hasArg("-d") || (hasArg("--debug")) ? "development": "production");
console.log("webpack env:", NODE_ENV)

var BABEL_FEATURES = ['es7.asyncFunctions', 'es7.decorators'];

var cssMaps = { vars: {}, media: {}, selector: {} };
CSS_SRC.map(webpackPostcssTools.makeVarMap).forEach(function(map) {
    for (var name in cssMaps) _.extend(cssMaps[name], map[name]);
});


var config = module.exports = {
    // output a bundle for the app JS and a bundle for styles
    // eventually we should have multiple (single file) entry points for various pieces of the app to enable code splitting
    entry: {
        vendor: __dirname + '/resources/frontend_client/vendor.js',
        app: JS_SRC,
        styles: [
            __dirname + '/resources/frontend_client/vendor.css'
        ].concat(CSS_SRC)
    },

    // output to "dist"
    output: {
        path: __dirname + '/resources/frontend_client/app/dist',
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        filename: '[name].bundle.js?[hash]',
        publicPath: '/app/dist'
    },

    module: {
        loaders: [
            // JavaScript
            { test: /\.js$/, exclude: /node_modules/, loader: 'babel', query: { cacheDirectory: '.babel_cache', optional: BABEL_FEATURES }},
            { test: /\.js$/, exclude: /node_modules|\.spec\.js/, loader: 'eslint' },
            // CSS
            { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader?-restructuring&compatibility!cssnext-loader') }
            // { test: /\.css$/, loader: 'style-loader!css-loader!cssnext-loader' }
        ],
        noParse: [
            /node_modules\/(angular|ng-|ace|react-onclickoutside|moment|underscore|jquery|d3)/ // doesn't include 'crossfilter', 'dc', and 'tether' due to use of 'require'
        ]
    },

    resolve: {
        // modulesDirectories: [],
        alias: {
            'metabase':             __dirname + '/resources/frontend_client/app',

            // angular
            'angular':              __dirname + '/node_modules/angular/angular.min.js',
            'angular-cookies':      __dirname + '/node_modules/angular-cookies/angular-cookies.min.js',
            'angular-resource':     __dirname + '/node_modules/angular-resource/angular-resource.min.js',
            'angular-route':        __dirname + '/node_modules/angular-route/angular-route.min.js',
            // angular 3rd-party
            'angular-ui-bootstrap': __dirname + '/node_modules/angular-ui-bootstrap/ui-bootstrap-tpls.min.js',
            'angular-cookie':       __dirname + '/node_modules/angular-cookie/angular-cookie.min.js',
            'angular-http-auth':    __dirname + '/node_modules/angular-http-auth/src/http-auth-interceptor.js',
            'angular-ui-ace':       __dirname + '/node_modules/angular-ui-ace/src/ui-ace.js',
            // ace
            'ace/ace':              __dirname + '/node_modules/ace-builds/src-min-noconflict/ace.js',
            'ace/ext-language_tools':__dirname+ '/node_modules/ace-builds/src-min-noconflict/ext-language_tools.js',
            'ace/mode-sql':         __dirname + '/node_modules/ace-builds/src-min-noconflict/mode-sql.js',
            'ace/snippets/sql':     __dirname + '/node_modules/ace-builds/src-min-noconflict/snippets/sql.js',
            // react
            'react-onclickoutside': __dirname + '/node_modules/react-onclickoutside/index.js',
            'fixed-data-table':     __dirname + '/node_modules/fixed-data-table/dist/fixed-data-table.min.js',
            // misc
            'moment':               __dirname + '/node_modules/moment/min/moment.min.js',
            'tether':               __dirname + '/node_modules/tether/dist/js/tether.min.js',
            'underscore':           __dirname + '/node_modules/underscore/underscore-min.js',
            'jquery':               __dirname + '/node_modules/jquery/dist/jquery.min.js',
            'd3':                   __dirname + '/node_modules/d3/d3.min.js',
            'crossfilter':          __dirname + '/node_modules/crossfilter/index.js',
            'dc':                   __dirname + '/node_modules/dc/dc.min.js',
            'd3-tip':               __dirname + '/node_modules/d3-tip/index.js',
            'humanize':             __dirname + '/node_modules/humanize-plus/public/src/humanize.js'
        }
    },

    plugins: [
        // Automatically annotates angular functions (from "function($foo) {}" to "['$foo', function($foo) {}]")
        // so minification doesn't break dependency injections
        // new NgAnnotatePlugin({ add: true }),
        // Separates out modules common to multiple entry points into a single common file that should be loaded first.
        // Not currently useful but necessary for code-splitting
        new CommonsChunkPlugin({
            name: 'vendor',
            minChunks: Infinity // (with more entries, this ensures that no other module goes into the vendor chunk)
        }),
        // Extracts initial CSS into a standard stylesheet that can be loaded in parallel with JavaScript
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        new ExtractTextPlugin('[name].bundle.css?[contenthash]'),
        new HtmlWebpackPlugin({
            filename: '../../index.html',
            template: 'resources/frontend_client/index_template.html',
            inject: 'head'
        }),
        new webpack.DefinePlugin({
            'process.env': { NODE_ENV: JSON.stringify(NODE_ENV) }
        })
    ],

    // CSSNext configuration
    cssnext: {
        features: {
            // pass in the variables and custom media we scanned for before
            customProperties: { variables: cssMaps.vars },
            customMedia: { extensions: cssMaps.media }
        },
        import: {
            path: ['resources/frontend_client/app/css']
        },
        compress: false
    },

};

if (NODE_ENV === "hot") {
    config.entry.app.unshift(
        'webpack-dev-server/client?http://localhost:8080',
        'webpack/hot/only-dev-server'
    );

    config.output.publicPath = "http://localhost:8080" + config.output.publicPath;

    config.module.loaders.unshift(
        { test: /\.react.js$/, exclude: /node_modules/, loaders: ['react-hot', 'babel?'+BABEL_FEATURES.map(function(f) { return 'optional[]='+f; }).join('&')] }
    );

    config.plugins.unshift(
        new webpack.NoErrorsPlugin()
    );
}

// development environment:
if (NODE_ENV === "development" || NODE_ENV === "hot") {
    // replace minified files with un-minified versions
    for (var name in config.resolve.alias) {
        var minified = config.resolve.alias[name];
        var unminified = minified.replace(/[.-]min/, '');
        if (minified !== unminified && fs.existsSync(unminified)) {
            config.resolve.alias[name] = unminified;
        }
    }

    // SourceMaps
    // Normal source map works better but takes longer to build
    // config.devtool = 'source-map';
    // Eval source map doesn't work with CSS but is faster to build
    // config.devtool = 'eval-source-map';
}
