const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CleanWebpackPlugin = require("clean-webpack-plugin");

const outputDirectory = 'dist';

module.exports = {
    output: {
        path: path.resolve(__dirname, outputDirectory),
        filename: 'main.js',
        library: 'digitaljs',
        libraryTarget: 'umd',
        umdNamedDefine: true,
        globalObject: 'this'
    },
    entry: "./src/index.js",
    devtool: "source-map",
    resolve: {
        extensions: ['.js', '.jsx', '.json', '.css'],
        alias: {
            '@app': path.resolve(__dirname, 'src/')
        }
    },
    module: {
        rules: [
            {
                test: /\.css/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
/*            {
                test: /\.png/,
                use: [
                    'file-loader'
                ]
            },*/
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
                    presets: ['env'],
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
        new CleanWebpackPlugin([outputDirectory]),
        new HtmlWebpackPlugin({
            title: 'Full Adder',
            template: 'src/test/template.html',
            test: JSON.stringify(require('./src/test/fulladder.json')),
            filename: 'test/fulladder.html',
            inject: 'head'
        })
    ]
}

