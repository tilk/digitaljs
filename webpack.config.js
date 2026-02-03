const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const outputDirectory = 'dist';

const tests = [
    {name: 'fulladder', title: 'Full Adder'},
    {name: 'serialadder', title: 'Serial Adder'},
    {name: 'cycleadder', title: 'Accumulating Adder'},
    {name: 'arithconst', title: 'Fused arithmetic with constants'},
    {name: 'lfsr', title: 'Linear Feedback Shift Register'},
    {name: 'sextium', title: 'Sextium III Processor'},
    {name: 'rom', title: 'Async ROM'},
    {name: 'ram', title: 'Simple RAM'},
    {name: 'fsm', title: 'Finite State Machine'},
    {name: 'gates', title: 'All available gates'},
    {name: 'biggate', title: 'N-ary gates'},
    {name: 'muxsparse', title: 'Sparse mux'},
    {name: 'io', title: 'Input/Output types'},
    {name: 'horner', title: 'Benchmark example'},
    {name: 'latch', title: 'Level-triggered D-latch example'},
    {name: 'warnings', title: 'Warnings example'}
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
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.svg|\.png/,
                type: 'asset'
            },
            {
                test: require.resolve('jquery'),
                loader: 'expose-loader',
                options: {
                    exposes: ['$']
                }
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
//        new BundleAnalyzerPlugin()
    ].concat(tests.map(t => new HtmlWebpackPlugin({
            title: t.title,
            template: 'examples/template.html',
            test: JSON.stringify(require('./examples/' + t.name + '.json')),
            filename: 'test/' + t.name + '.html',
            inject: 'head'
    })))
}

