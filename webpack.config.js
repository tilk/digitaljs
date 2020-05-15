const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CleanWebpackPlugin = require("clean-webpack-plugin");
const babelenv = require('@babel/preset-env');

const outputDirectory = 'dist';

const tests = [
    {name: 'fulladder', title: 'Full Adder'},
    {name: 'serialadder', title: 'Serial Adder'},
    {name: 'cycleadder', title: 'Accumulating Adder'},
    {name: 'lfsr', title: 'Linear Feedback Shift Register'},
    {name: 'sextium', title: 'Sextium III Processor'},
    {name: 'rom', title: 'Async ROM'},
    {name: 'ram', title: 'Simple RAM'},
    {name: 'fsm', title: 'Finite State Machine'},
    {name: 'gates', title: 'All available gates'}
];

module.exports = {
    output: {
        path: path.resolve(__dirname, outputDirectory),
        filename: 'main.js',
        library: 'digitaljs',
        libraryTarget: 'umd',
        umdNamedDefine: true,
        globalObject: 'this'
    },
    entry: "./src/index.mjs",
    devtool: "source-map",
    module: {
        rules: [
            { // workaround for Webpack borkedness
                test: /\.mjs/,
                type: "javascript/auto"
            },
            {
                test: /\.css/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.svg|\.png/,
                use: [
                    'base64-inline-loader?limit=1000&name=[name].[ext]'
                ]
            },
            {
                test: /\.js/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: [babelenv],
                }
            }, {
                test: require.resolve('jquery'),
                use: [{
                    loader: 'expose-loader',
                    options: '$'
                }]
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
    ].concat(tests.map(t => new HtmlWebpackPlugin({
            title: t.title,
            template: 'examples/template.html',
            test: JSON.stringify(require('./examples/' + t.name + '.json')),
            filename: 'test/' + t.name + '.html',
            inject: 'head'
    })))
}

